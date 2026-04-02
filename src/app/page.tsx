"use client";

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  // 模拟从品牌数据库里提取到的生成结果
  const handleGenerate = () => {
    setIsGenerating(true);
    // 模拟网络请求时间
    setTimeout(() => {
      setContent(
        "【周生生 x 三丽鸥家族新品上市】\n\n当呆萌大眼蛙遇上活力满满的帕恰狗，这场可爱风暴你准备好迎接了吗？\n\n本次带来的联名足金串珠，利用匠心拉丝勾勒出精灵般的圆润造型，单戴随心叠搭都超级出彩。元气大眼蛙为你串起好运与治愈，戴上墨镜的酷飒帕恰狗更是日常穿搭的最佳点缀！\n\n即刻莅临门店或是跳转小程序探索，把喜欢的大明星带回家，在每一个平凡的朝夕里，加载溢出的可爱与福运！#blingbling周生生 #周生生Charme #三丽鸥家族"
      );
      setIsGenerating(false);
    }, 1500);
  };

  // 模拟 EASYCLAW 对抗性检查
  const handleReview = () => {
    setIsReviewing(true);
    setReviews([]); // reset
    
    setTimeout(() => {
      setReviews([
        {
          id: 1,
          type: "compliance",
          title: "合规性扫描 (Compliance)",
          text: "检测到敏感词“最”。按照广告法，“最佳点缀”存在合规风险。",
          tags: ["合规警告", "需修改"]
        },
        {
          id: 2,
          type: "consistency",
          title: "品牌调性对抗 (Consistency)",
          text: "本次主题表现良好，符合年轻元气感的 IP 联名基调。词境“溢出的可爱与福运”完全符合品牌数据库高频词表现。",
          tags: ["完美契合", "IP联名风格"]
        },
        {
          id: 3,
          type: "logic",
          title: "结构逻辑 (Logic)",
          text: "整体逻辑通顺。引入语（呆萌大眼蛙遇上...）有呼唤感。落款话题带有标准 #blingbling周生生 规范。",
          tags: ["通过"]
        }
      ]);
      setIsReviewing(false);
    }, 2000);
  };

  return (
    <div className="layout">
      {/* 工作区 Harness Zone */}
      <div className="panel workspace">
        <div className="workspace-header">
          <div>
            <h1 className="workspace-title">Chow Sang Sang Copywriter</h1>
            <p className="workspace-subtitle">Powered by Harness AI</p>
          </div>
          <div className="brand-select">
            {/* 保留未来可能的多品牌选择 */}
          </div>
        </div>
        
        <div className="editor-area">
          <textarea 
            className="editor-textarea" 
            placeholder="输入你的初稿、核心词汇，或者直接让 AI 基于「周生生品牌数据库」为你写出大纲..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          ></textarea>
          
          <div className="controls">
            <button 
              className="btn btn-secondary"
              onClick={() => setContent('')}
            >
              清空工作台
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "生成中..." : "✦ 一键生成品牌文案"}
            </button>
            <button 
              className="btn btn-primary"
              style={{background: 'var(--success)', color: '#fff', boxShadow: '0 4px 15px rgba(42, 157, 143, 0.3)'}}
              onClick={handleReview}
              disabled={isReviewing || !content}
            >
              {isReviewing ? "审核中..." : "执行 EASYCLAW 审查"}
            </button>
          </div>
        </div>
      </div>

      {/* EASYCLAW 审查监控面板 */}
      <div className="panel easyclaw-sidebar">
        <div className="easyclaw-header">
          <div className="status-indicator"></div>
          <div className="easyclaw-logo">EASYCLAW</div>
        </div>
        
        <div className="review-container">
          {reviews.length === 0 && !isReviewing && (
            <div style={{color: 'var(--text-secondary)', textAlign: 'center', marginTop: '50px', fontSize: '0.9rem'}}>
              输入文案并执行审查，<br/>EASYCLAW 将从合规、调性、逻辑对抗验证内容。
            </div>
          )}

          {isReviewing && (
            <div style={{color: 'var(--brand-gold)', textAlign: 'center', marginTop: '50px', fontSize: '0.9rem', animation: 'pulse 1.5s infinite'}}>
              <p>正在拉取周生生品牌参数...</p>
              <p>红蓝对抗检测进行中...</p>
            </div>
          )}

          {reviews.map((rev) => (
            <div key={rev.id} className={`review-card ${rev.type}`}>
              <div className="review-title">{rev.title}</div>
              <div className="review-content">{rev.text}</div>
              <div>
                {rev.tags.map((tag: string, idx: number) => (
                  <span key={idx} className={`tag ${rev.type === 'compliance' ? 'error' : ''}`}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
