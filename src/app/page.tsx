"use client";

import React, { useState, useEffect, useRef } from 'react';

type PlatformId = 'weibo' | 'wechat' | 'xiaohongshu' | 'wecom';

interface ReviewDimResult { name: string; pass: boolean; note: string; }
interface ReviewResult { score: number; totalDimensions: number; passCount: number; dimensions: ReviewDimResult[]; verdict: string; rounds: number; }
interface PlatformOutput { platform: string; title: string; content: string; hashtags: string[]; wordCount: string; cta: string; review: ReviewResult; }
interface GenerateResult { success: boolean; subject: string; engine: 'claude-api' | 'template'; matchedKeywords: string[]; imageAnalysis: string[]; relevantBrandSections: string[]; platforms: Record<PlatformId, PlatformOutput>; }

interface HistoryItem {
  filename: string;
  time: string;
  engine: string;
  brief: string;
  subject: string;
  platformTitles: Record<string, string>;
  raw: string;
}

const PLATFORM_TABS: { id: PlatformId; name: string; icon: string }[] = [
  { id: 'weibo', name: '微博', icon: '🔥' },
  { id: 'wechat', name: '微信公众号', icon: '💎' },
  { id: 'xiaohongshu', name: '小红书', icon: '📕' },
  { id: 'wecom', name: '企微朋友圈', icon: '🤝' },
];

export default function Home() {
  const [brief, setBrief] = useState('');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformId>('weibo');
  const [brandStatus, setBrandStatus] = useState('⏳ 检测中...');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeView, setActiveView] = useState<'generate' | 'brand' | 'history'>('generate');

  const [brandDbInfo, setBrandDbInfo] = useState<{ sections: number; size: number; assetCount: number; lastModified: string } | null>(null);
  const [uploadingBrand, setUploadingBrand] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ filename: string; textExtracted: number; status: string }[]>([]);
  const [brandDragOver, setBrandDragOver] = useState(false);

  // 历史记录
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  // 新手引导
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // 复制状态
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const brandFileInputRef = useRef<HTMLInputElement>(null);

  const loadBrandInfo = () => {
    fetch('/api/brand-data?mode=structured').then(res => res.json()).then(data => {
      setBrandStatus(data.totalSections ? `✅ 品牌库挂载 · ${data.totalSections}模块` : '⚠️ 品牌库为空');
    }).catch(() => setBrandStatus('❌ 品牌库不可用'));

    fetch('/api/upload').then(res => res.json()).then(data => {
      if (data.exists) setBrandDbInfo({ sections: data.sections, size: data.size, assetCount: data.assetCount, lastModified: data.lastModified });
    }).catch(() => {});
  };

  const loadHistory = () => {
    setHistoryLoading(true);
    fetch('/api/history').then(res => res.json()).then(data => {
      setHistoryList(data.history || []);
    }).catch(() => {}).finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadBrandInfo();
    // 首次使用检测
    const seen = localStorage.getItem('harness_guide_seen');
    if (!seen) setShowGuide(true);
  }, []);

  const closeGuide = () => {
    localStorage.setItem('harness_guide_seen', '1');
    setShowGuide(false);
    setGuideStep(0);
  };

  // 切换到历史时自动加载
  useEffect(() => {
    if (activeView === 'history') loadHistory();
  }, [activeView]);

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    });
  };

  const handleBrandUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;
    setUploadingBrand(true);
    const formData = new FormData();
    fileArray.forEach(f => formData.append('files', f));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { setUploadResults(prev => [...data.results, ...prev]); loadBrandInfo(); }
    } catch { } finally { setUploadingBrand(false); }
  };

  const handleFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (newFiles.length === 0) return;
    setUploadedImages(prev => [...prev, ...newFiles]);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        setImagePreviews(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (!brief) return;
    setIsGenerating(true);
    setResult(null);
    try {
      // 自动从 Brief 第一句提取主题（用于文件命名）
      const autoSubject = brief.split(/[。！？\n]/)[0]?.trim().substring(0, 20) || '内容生成';

      const imageData = imagePreviews.map((dataUrl, i) => ({
        name: uploadedImages[i]?.name || `image_${i}.jpg`,
        mimeType: uploadedImages[i]?.type || 'image/jpeg',
        base64: dataUrl.split(',')[1] || '',
      }));

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: autoSubject, brief, imageData }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setActivePlatform('weibo');
        // 生成完成后刷新历史（如果在历史视图）
        if (activeView === 'history') loadHistory();
      }
    } catch { } finally { setIsGenerating(false); }
  };

  const currentOutput = result?.platforms[activePlatform];

  return (
    <>
    <div className="layout">
      {/* ========== 左侧面板 ========== */}
      <div className="panel left-panel">
        <div className="header-section">
          <h1 className="brief-title">DIGIREPUB 周生生</h1>
          <p className="brief-subtitle">全域品牌内容智能引擎 ✦</p>
        </div>

        <div className="brand-status-bar">
          <span className="brand-status-dot"></span>
          <span className="brand-status-text">{brandStatus}</span>
        </div>

        <div className="view-switcher">
          <button className={`view-btn ${activeView === 'generate' ? 'active' : ''}`} onClick={() => setActiveView('generate')}>Creative Protocol</button>
          <button className={`view-btn ${activeView === 'brand' ? 'active' : ''}`} onClick={() => setActiveView('brand')}>Brand Library</button>
          <button className={`view-btn ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>历史记录</button>
        </div>

        {activeView === 'generate' ? (
          <div className="brief-form">
            <div className="form-group form-group-flex">
              <label className="form-label">Creative Brief</label>
              <textarea
                className="form-textarea"
                value={brief}
                onChange={e => setBrief(e.target.value)}
                disabled={isGenerating}
                placeholder="请输入创作简报，描述产品特性、目标受众、营销诉求、风格要求等。系统将自动结合品牌知识库生成四平台文案。"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Visual Assets (Optional)</label>
              <div
                className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
                onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} style={{ display: 'none' }} />
                {imagePreviews.length === 0 ? (
                  <div className="upload-placeholder">
                    <span className="upload-icon">✦</span>
                    <span style={{ fontSize: '0.8rem' }}>上传产品图，AI 将自动识别产品信息</span>
                  </div>
                ) : (
                  <div className="image-preview-grid">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="preview-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="preview" />
                        <button className="preview-remove" onClick={e => { e.stopPropagation(); removeImage(i); }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button className="btn-generate" onClick={handleGenerate} disabled={isGenerating || !brief}>
              {isGenerating ? 'Synthesizing...' : 'Generate Scripts ✦'}
            </button>
          </div>
        ) : activeView === 'brand' ? (
          <div className="brief-form">
            {brandDbInfo && (
              <div className="brand-stats-mini" style={{ marginBottom: '16px' }}>
                <div className="stat-mini-box">
                  <div className="stat-mini-val">{brandDbInfo.sections}</div>
                  <div className="stat-mini-lbl">Modules</div>
                </div>
                <div className="stat-mini-box">
                  <div className="stat-mini-val">{brandDbInfo.assetCount}</div>
                  <div className="stat-mini-lbl">Assets</div>
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Upload Documents</label>
              <div
                className={`upload-zone ${brandDragOver ? 'drag-over' : ''}`}
                onDrop={e => { e.preventDefault(); setBrandDragOver(false); handleBrandUpload(e.dataTransfer.files); }}
                onDragOver={e => { e.preventDefault(); setBrandDragOver(true); }}
                onDragLeave={() => setBrandDragOver(false)}
                onClick={() => brandFileInputRef.current?.click()}
              >
                <input ref={brandFileInputRef} type="file" multiple onChange={e => { if (e.target.files) handleBrandUpload(e.target.files); }} style={{ display: 'none' }} />
                <div className="upload-placeholder">
                  <span className="upload-icon">📂</span>
                  <span>{uploadingBrand ? 'Processing...' : 'Upload DOCX, PPTX, PDF'}</span>
                </div>
              </div>
            </div>
            {uploadResults.length > 0 && (
              <div className="upload-results">
                {uploadResults.map((r, i) => (
                  <div key={i} className="upload-result-item">
                    <span className="upload-result-name">{r.filename}</span>
                    <span className={`upload-result-status ${r.status === 'success' ? 'ok' : 'err'}`}>{r.status === 'success' ? `✓ ${r.textExtracted}字` : '✗ 失败'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ========== 历史记录面板 ========== */
          <div className="brief-form">
            <div className="history-header">
              <span className="form-label">生成历史</span>
              <button className="history-refresh-btn" onClick={loadHistory} disabled={historyLoading}>
                {historyLoading ? '加载中...' : '↻ 刷新'}
              </button>
            </div>
            <div className="history-list">
              {historyList.length === 0 && !historyLoading && (
                <div className="history-empty">暂无历史记录</div>
              )}
              {historyList.map((item, i) => (
                <div
                  key={i}
                  className={`history-item ${selectedHistory?.filename === item.filename ? 'active' : ''}`}
                  onClick={() => setSelectedHistory(item)}
                >
                  <div className="history-item-time">{item.time}</div>
                  <div className="history-item-brief">{item.brief || item.subject}</div>
                  <div className="history-item-engine">{item.engine}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========== 中间面板 ========== */}
      <div className="center-panel">
        {activeView === 'history' && selectedHistory ? (
          /* 历史记录详情 */
          <div className="history-detail">
            <div className="history-detail-header">
              <h3 className="history-detail-title">{selectedHistory.subject}</h3>
              <span className="history-detail-time">{selectedHistory.time}</span>
            </div>
            <div className="history-raw-content">
              <pre>{selectedHistory.raw}</pre>
            </div>
            <button className="btn-copy-history" onClick={() => handleCopy(selectedHistory.raw, 'history_raw')}>
              {copiedStates['history_raw'] ? '✓ 已复制' : '📄 复制全文'}
            </button>
          </div>
        ) : (
          <>
            <div className="platform-tabs">
              {PLATFORM_TABS.map(tab => (
                <button key={tab.id} className={`platform-tab ${activePlatform === tab.id ? 'active' : ''}`} onClick={() => setActivePlatform(tab.id)}>
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-name">{tab.name}</span>
                </button>
              ))}
            </div>

            <div className="output-container">
              {!result ? (
                <div className="output-empty">
                  <h3>Creative Workspace</h3>
                  <p>在左侧输入 Brief，点击生成按钮开始创作。</p>
                </div>
              ) : currentOutput && (
                <div className="output-card">
                  <div className="output-meta-bar">
                    <span className="engine-badge">{result.engine === 'claude-api' ? '✦ Sonnet 4.6 Engine' : '✦ Template Engine'}</span>
                    <span>{currentOutput.wordCount}</span>
                  </div>

                  <div className="content-block">
                    <div className="content-block-header">
                      <span className="content-label">Title</span>
                      <button className={`btn-copy ${copiedStates['title'] ? 'copied' : ''}`} onClick={() => handleCopy(currentOutput.title, 'title')}>
                        {copiedStates['title'] ? '✓ Copied' : '📄 Quick Copy'}
                      </button>
                    </div>
                    <h3 className="output-title-text">{currentOutput.title}</h3>
                  </div>

                  <div className="content-block">
                    <div className="content-block-header">
                      <span className="content-label">Content</span>
                      <button className={`btn-copy ${copiedStates['body'] ? 'copied' : ''}`} onClick={() => handleCopy(currentOutput.content, 'body')}>
                        {copiedStates['body'] ? '✓ Copied' : '📄 Quick Copy'}
                      </button>
                    </div>
                    <div className="output-body">
                      {currentOutput.content}
                    </div>
                  </div>

                  {currentOutput.hashtags.length > 0 && (
                    <div className="content-block" style={{ marginBottom: '16px' }}>
                      <div className="content-block-header">
                        <span className="content-label">Hashtags</span>
                        <button className={`btn-copy ${copiedStates['tags'] ? 'copied' : ''}`} onClick={() => handleCopy(currentOutput.hashtags.join(' '), 'tags')}>
                          {copiedStates['tags'] ? '✓ Copied' : '📄 Quick Copy'}
                        </button>
                      </div>
                      <div className="output-hashtags">
                        {currentOutput.hashtags.map((t, i) => <span key={i} className="hashtag">{t}</span>)}
                      </div>
                    </div>
                  )}

                  <div className="output-cta-bar">
                    <strong>CTA Trigger:</strong> {currentOutput.cta}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ========== 右侧面板 ========== */}
      <div className="panel right-panel">
        <h2 className="side-title">Audit & Analytics</h2>

        {currentOutput?.review && activeView !== 'history' && (
          <div className="review-card">
            <div className="review-header">
              <span className="content-label">EASYCLAW SCORE</span>
              <span className="review-rounds">{currentOutput.review.rounds} Round(s)</span>
            </div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className={`review-score ${currentOutput.review.score >= 8 ? 'high' : 'mid'}`}>{currentOutput.review.score} / 10</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>{currentOutput.review.verdict}</span>
            </div>
            <div className="review-dimensions">
              {currentOutput.review.dimensions.map((dim, i) => (
                <div key={i} className="review-dim">
                  <div className="dim-icon">{dim.pass ? '✅' : '⚠️'}</div>
                  <div className="dim-text-group">
                    <span className="dim-name">{dim.name}</span>
                    <span className="dim-note">{dim.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result?.matchedKeywords && result.matchedKeywords.length > 0 && activeView !== 'history' && (
          <div className="analysis-card">
            <h3 className="content-label" style={{ marginBottom: '12px' }}>Brand DNA Matches</h3>
            {result.matchedKeywords.map((tag, i) => (
              <div key={i} className="analysis-item">✦ {tag}</div>
            ))}
          </div>
        )}

        {result?.relevantBrandSections && result.relevantBrandSections.length > 0 && activeView !== 'history' && (
          <div className="analysis-card">
            <h3 className="content-label" style={{ marginBottom: '12px' }}>Knowledge Modules</h3>
            {result.relevantBrandSections.map((sec, i) => (
              <div key={i} className="analysis-item">📚 {sec}</div>
            ))}
          </div>
        )}

        {/* 历史记录统计 */}
        {activeView === 'history' && (
          <div className="analysis-card">
            <h3 className="content-label" style={{ marginBottom: '12px' }}>历史统计</h3>
            <div className="analysis-item">📋 总计 {historyList.length} 条记录</div>
            <div className="analysis-item">🤖 Claude API 驱动</div>
          </div>
        )}
      </div>
    </div>

    {showGuide && (() => {
      const steps = [
        {
          icon: '🧠',
          title: '欢迎使用 DIGIREPUB 内容工作台',
          desc: '这是一个专为周生生品牌打造的 AI 文案生成系统，支持四大平台一键生成，并内置智能审查与对抗修正机制。',
          tip: null as string | null,
        },
        {
          icon: '📝',
          title: '第一步：输入创作 Brief',
          desc: '在左侧「Creative Protocol」面板的文本框中，用自然语言描述本次内容需求。无需填写主题，只需一段 Brief 即可。',
          tip: '示例：「本周推广帕恰狗串珠新品，受众是18-25岁年轻女性，主打可爱治愈风，三丽鸥联名款。」',
        },
        {
          icon: '🖼️',
          title: '第二步：上传产品图（可选）',
          desc: 'Brief 下方可拖拽或点击上传产品图片。系统会用 Gemini Vision 自动识别产品系列、工艺、色彩等视觉信息，并融入文案生成。',
          tip: '支持 JPG / PNG / WEBP，可同时上传多张图片。',
        },
        {
          icon: '🔄',
          title: '第三步：生成 + 对抗审查',
          desc: '点击「生成文案」后，系统自动完成：① Claude 生成初稿 ② Gemini 五维度审查 ③ 若有不通过项，回传意见给 Claude 修正 ④ 二次审查通过后出库。',
          tip: '右侧审查报告显示「2 Rounds」代表对抗修正已触发。生成历史可在「历史记录」标签查看。',
        },
      ];
      const step = steps[guideStep];
      const isLast = guideStep === steps.length - 1;
      return (
        <div className="guide-overlay" onClick={closeGuide}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <button className="guide-close" onClick={closeGuide}>✕</button>
            <div className="guide-steps-indicator">
              {steps.map((_, i) => (
                <span key={i} className={`guide-dot ${i === guideStep ? 'active' : i < guideStep ? 'done' : ''}`} onClick={() => setGuideStep(i)} />
              ))}
            </div>
            <div className="guide-icon">{step.icon}</div>
            <h2 className="guide-title">{step.title}</h2>
            <p className="guide-desc">{step.desc}</p>
            {step.tip && (
              <div className="guide-tip">
                <span className="guide-tip-label">💡 提示</span>
                <p>{step.tip}</p>
              </div>
            )}
            <div className="guide-actions">
              {guideStep > 0 && (
                <button className="guide-btn-secondary" onClick={() => setGuideStep(s => s - 1)}>← 上一步</button>
              )}
              <button className="guide-btn-primary" onClick={() => isLast ? closeGuide() : setGuideStep(s => s + 1)}>
                {isLast ? '开始使用 →' : '下一步 →'}
              </button>
            </div>
            <button className="guide-skip" onClick={closeGuide}>跳过引导</button>
          </div>
        </div>
      );
    })()}
    </>
  );
}
