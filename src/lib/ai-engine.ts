/**
 * Harness AI 混合引擎
 * 
 * 架构：
 *   生成文案 → Claude Sonnet 4.6（API易中转，文笔最好）
 *   审查质量 → Gemini 3.1 Flash（API易中转，快速精准）
 *   降级策略 → 若 Gemini 失败则 Claude 兼做审查
 * 
 * 均通过 API易（api.apiyi.com）中转，共用同一 API Key
 */
import { PLATFORM_RULES, type PlatformId } from './platform-rules';

// ==================== 引擎初始化 ====================

// 强制使用 API易 中转地址，避免被系统全局 ANTHROPIC_BASE_URL 覆盖
const APIYI_BASE_URL = 'https://api.apiyi.com';


/**
 * OpenAI 兼容 API 调用（用于 Claude/DeepSeek 等）
 */
async function callOpenAICompatible(
  baseURL: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1024,
): Promise<string | null> {
  try {
    const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
    console.log(`[OpenAI Compatible] → URL: ${url}`);
    console.log(`[OpenAI Compatible] → Model: ${model}`);
    console.log(`[OpenAI Compatible] → Key prefix: ${apiKey.substring(0, 10)}...`);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      cache: 'no-store' as RequestCache,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[OpenAI Compatible] ${res.status}: ${errBody}`);
      return null;
    }

    const data = await res.json();
    console.log(`[OpenAI Compatible] ✓ 成功响应, model: ${data.model}`);
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[OpenAI Compatible] 调用失败:', err);
    return null;
  }
}

/**
 * Gemini 原生格式调用（适配 API易）
 * endpoint: https://api.apiyi.com/v1beta/models/{model}:generateContent?key={apiKey}
 */
async function callGeminiNative(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userMessage: string,
): Promise<string | null> {
  try {
    const baseURL = APIYI_BASE_URL;
    const url = `${baseURL.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      console.error(`[Gemini] ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[Gemini] 调用失败:', err);
    return null;
  }
}

// ==================== Gemini Vision 图片理解 ====================

export interface ImageInput {
  name: string;
  mimeType: string;
  base64: string;
}

/**
 * 用 gemini-3.1-flash-lite-preview 分析产品图片
 * 返回结构化的产品描述，供 Claude 生成文案使用
 */
export async function analyzeImagesWithGemini(
  images: ImageInput[],
): Promise<string> {
  if (!images || images.length === 0) return '';

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const model = process.env.REVIEW_MODEL || 'gemini-3.1-flash-lite-preview';

  try {
    // 通过 OpenAI 兼容接口发送视觉请求（API易支持此格式）
    const url = `${APIYI_BASE_URL}/v1/chat/completions`;
    
    // 构造 OpenAI vision 格式的 content 数组
    const contentParts: Array<{type: string; text?: string; image_url?: {url: string}}> = [];
    
    // 最多发 4 张图
    for (const img of images.slice(0, 4)) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`,
        },
      });
    }
    
    contentParts.push({
      type: 'text',
      text: `你是周生生珠宝品牌的专业产品分析师。
请分析这${images.length}张产品图，提取以下信息（用中文回答，如图片中没有某项信息则跳过）：

1. 产品名称与系列：识别产品系列名称、IP联名（如三丽鸥/帕恰狗/大眼蛙）、产品品类
2. 材质与工艺：足金/铂金/钻石/K金、工艺特点
3. 设计风格：传统/现代/可爱萌趣/轻奢极简/婚嫁喜庆等
4. 货号（如图片中有标注）
5. 视觉亮点：最吸引眼球的设计细节
6. 适用场景：日常佩戴/节日礼品/婚嫁/纪念日等

直接用简洁的结构化文字输出。`,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Gemini Vision] 分析失败 ${res.status}:`, errText.substring(0, 200));
      return '';
    }

    const data = await res.json();
    const analysis = data.choices?.[0]?.message?.content?.trim() || '';
    console.log(`[Gemini Vision] ✓ 分析完成 (${images.length}张图), ${analysis.length}字`);
    return analysis;
  } catch (err) {
    console.error('[Gemini Vision] 异常:', err);
    return '';
  }
}

// ==================== 引擎可用性检查 ====================

/** Claude 是否可用（生成引擎） */
export function isGenerateEngineAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** 审查引擎是否可用（Gemini 或独立 DeepSeek） */
export function isReviewEngineAvailable(): boolean {
  // Gemini 审查：复用 ANTHROPIC_API_KEY（同一 API易密钥）
  return !!(process.env.ANTHROPIC_API_KEY);
}

/** 任何一个 AI 引擎可用即视为 AI 模式 */
export function isAIAvailable(): boolean {
  return isGenerateEngineAvailable();
}

/** 获取当前引擎配置描述 */
export function getEngineInfo(): {
  generate: string;
  review: string;
} {
  const genModel = process.env.GENERATE_MODEL || 'claude-sonnet-4-6';
  const revModel = process.env.REVIEW_MODEL || 'gemini-3.1-flash-lite-preview';

  return {
    generate: isGenerateEngineAvailable()
      ? genModel
      : 'template',
    review: isGenerateEngineAvailable()
      ? revModel
      : 'rules',
  };
}

// ==================== 文案生成（Claude） ====================

export async function generateWithAI(
  platformId: PlatformId,
  subject: string,
  brief: string,
  brandContext: string,
  matchedKeywords: string[],
  imageClues: string[],
  imageAnalysisText: string = '',
): Promise<{
  platform: string;
  title: string;
  content: string;
  hashtags: string[];
  wordCount: string;
  cta: string;
} | null> {
  const rule = PLATFORM_RULES[platformId];
  const keywordsStr = matchedKeywords.length > 0 ? matchedKeywords.join('、') : '无特定品牌词';

  // 图片信息：Gemini分析结果优先，否则用文件名猜测
  let imageInfo = '';
  if (imageAnalysisText) {
    imageInfo = '\n\n《产品图片视觉分析（AI看图得出，请将下列具体信息自然融入文案）》\n' + imageAnalysisText;
  } else if (imageClues.length > 0) {
    imageInfo = '\n参考图片信息：' + imageClues.join('；');
  }

  // 根据平台计算严格的字数上限，用于 max_tokens 控制
  const maxContentChars = rule.wordRange[1];
  // 粗略估算：1个中文字约等于2个token，再加上JSON结构开销
  const estimatedMaxTokens = Math.min(Math.ceil(maxContentChars * 2.5) + 300, 4096);

  // 工艺叙事动态注入
  let craftsmanshipInjection = '';
  const searchStr = brief + ' ' + keywordsStr;
  if (searchStr.includes('足金') || searchStr.includes('传承')) {
    craftsmanshipInjection = `\n【工艺细节强制调用】当前包含“足金/传承”标签，你必须在文案中穿插具体的工艺细节，如：“龙鳞浮雕”、“手工捶打纹理”、“哑光质感”等，禁止简单泛泛而谈“黄金好漂亮”。`;
  }

  const systemPrompt = `[Role]: 你是周生生品牌高级文案总监，擅长平衡“雅致匠心”与“渠道转化”。

[Knowledge]:
检索数据库中关于产品的工艺细节。
${brandContext || '（暂无品牌库上下文，请依据已知的周生生品牌信息写作）'}${craftsmanshipInjection}

[Context]:
你当前的任务是为【${rule.name}】平台撰写文案。
渠道定位：${rule.position}
命中关键词：${keywordsStr}

[Constraint]:
1. 风格对齐：必须严格遵守周生生“优雅、有温度、专业”形象。
2. 单词红黑榜：
   - 【正面池（奖励权重，优先使用）】：生生不息、周而复始、臻选、匠心、温润、流转、叙事、信物、雅致
   - 【负面池（绝对禁止，强拦截）】：绝绝子、yyds、真心推荐、买它、爆款、入股不亏、家人们、谁懂啊、匠心独运、情不自禁、完美诠释、极致奢华、独特魅力、品质生活、彰显品味、精心打造
3. 渠道适配：
   - 风格：${rule.style}
   - 语气：${rule.toneGuide}
   - 排版：${rule.formatTips}
   - Hashtag：${rule.hashtagRule}
   - CTA：${rule.ctaTemplate}
   - 参考结构：\n${rule.sampleStructure}
4. 字数红线：正文严格控制在 ${rule.wordRange[0]}-${rule.wordRange[1]} 个中文字之间。过长或过短均判不合格。
5. 内容底线：绝对禁止输出大纲、写作建议、占位符（如[插入链接]），必须是直接可发布的成品。禁止出现「介绍方向：」「建议：」等字眼。

[Output]:
输出符合要求的 JSON（不要代码块包裹，必须直接可用）：
{"title":"标题","content":"正文内容","hashtags":["标签1","标签2"],"cta":"CTA行动号召"}`;

  const userMessage = `请为以下需求生成【${rule.name}】平台的最终文案：\n\nBrief：${brief}${imageInfo}`;

  // 通过 OpenAI 兼容格式调用（适配 API易等中转平台）
  const genBaseURL = APIYI_BASE_URL;
  const genKey = process.env.ANTHROPIC_API_KEY;
  const genModel = process.env.GENERATE_MODEL || 'claude-sonnet-4-6';

  if (genBaseURL && genKey) {
    // 确保使用 /v1 端点
    const apiBase = genBaseURL.endsWith('/v1') ? genBaseURL : `${genBaseURL}/v1`;
    try {
      const rawText = await callOpenAICompatible(
        apiBase,
        genKey,
        genModel,
        systemPrompt,
        userMessage,
        estimatedMaxTokens,
      );

      if (rawText) {
        // 清理 markdown 代码块包裹
        let jsonStr = rawText.replace(/^```(?:json)?[\s\n]*/i, '').replace(/[\s\n]*```$/i, '').trim();
        
        // 尝试直接解析
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          // Claude 可能在 JSON string 值中包含未转义的换行符，修复它
          // 找到 JSON 中字符串值内的裸换行并替换为 \\n
          jsonStr = jsonStr.replace(/"([^"]*?)"/g, (match) => {
            return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
          });
          try {
            parsed = JSON.parse(jsonStr);
          } catch (e2) {
            console.error(`[Generate] ${rule.name} JSON 二次解析仍失败:`, e2);
            console.error(`[Generate] 原始返回:`, rawText.substring(0, 300));
            // 最后尝试：逐字段手动提取
            try {
              // 提取 title：从 "title":"  到下一个  ","
              const titleStart = rawText.indexOf('"title"');
              const contentStart = rawText.indexOf('"content"');
              const hashtagStart = rawText.indexOf('"hashtags"');
              const ctaStart = rawText.indexOf('"cta"');
              
              let title = subject;
              let content = brief;
              let hashtags: string[] = [];
              let cta = '';
              
              if (titleStart >= 0 && contentStart > titleStart) {
                const tValStart = rawText.indexOf(':', titleStart) + 1;
                const tStr = rawText.substring(tValStart, contentStart).trim().replace(/^"/, '').replace(/",?\s*$/, '');
                title = tStr;
              }
              
              if (contentStart >= 0 && hashtagStart > contentStart) {
                const cValStart = rawText.indexOf(':', contentStart) + 1;
                const cStr = rawText.substring(cValStart, hashtagStart).trim().replace(/^"/, '').replace(/",?\s*$/, '');
                content = cStr.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '\t');
              }
              
              if (hashtagStart >= 0) {
                const hBracketStart = rawText.indexOf('[', hashtagStart);
                const hBracketEnd = rawText.indexOf(']', hBracketStart);
                if (hBracketStart >= 0 && hBracketEnd > hBracketStart) {
                  const hStr = rawText.substring(hBracketStart + 1, hBracketEnd);
                  hashtags = hStr.match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
                }
              }
              
              if (ctaStart >= 0) {
                const ctaValStart = rawText.indexOf(':', ctaStart) + 1;
                const ctaEnd = rawText.indexOf('}', ctaStart);
                if (ctaEnd > ctaValStart) {
                  cta = rawText.substring(ctaValStart, ctaEnd).trim().replace(/^"/, '').replace(/"?\s*$/, '');
                }
              }
              
              parsed = { title, content, hashtags, cta };
              console.log(`[Generate] ${rule.name} 正则兜底提取成功, title: ${title.substring(0, 30)}...`);
            } catch {
              console.error(`[Generate] ${rule.name} 正则兜底也失败了`);
              return null;
            }
          }
        }

        return {
          platform: rule.name,
          title: parsed.title || subject,
          content: parsed.content || brief,
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
          wordCount: `${parsed.content?.length || 0}字`,
          cta: parsed.cta || rule.ctaTemplate,
        };
      }
    } catch (err) {
      console.error(`[Generate] ${rule.name} 生成失败:`, err);
      return null;
    }
  }

  return null;
}

// ==================== 对抗修正：根据审查意见重写 ====================

export async function reviseWithAI(
  platformId: PlatformId,
  originalDraft: { title: string; content: string; hashtags: string[]; cta: string },
  reviewFeedback: { name: string; pass: boolean; note: string }[],
  brief: string,
  brandContext: string,
): Promise<{
  platform: string;
  title: string;
  content: string;
  hashtags: string[];
  wordCount: string;
  cta: string;
} | null> {
  const rule = PLATFORM_RULES[platformId];
  const failedDims = reviewFeedback.filter(d => !d.pass);

  if (failedDims.length === 0) return null; // 全部通过，无需修正

  const failedFeedback = failedDims.map(d => `- ${d.name}：${d.note}`).join('\n');

  const systemPrompt = `你是周生生品牌的内容修正专家。你的任务是根据审查意见修正一篇【${rule.name}】平台的文案。

## 修正原则
1. **只修不通过的维度**，通过的部分尽量保留原貌
2. 修正后的文案仍然必须是可直接发布的成品
3. 字数严格控制在 ${rule.wordRange[0]}-${rule.wordRange[1]} 字
4. 保持品牌调性：治愈、灵动、质感
5. 禁止出现任何写作指导文字

## ${rule.name}平台规范
- 风格：${rule.style}
- 语气：${rule.toneGuide}
- 排版：${rule.formatTips}

## 品牌知识库
${brandContext.substring(0, 800) || '（无）'}`;

  const userMessage = `以下是一篇被审查打回的【${rule.name}】文案，请根据审查意见修正后重新输出。

## 原稿
标题：${originalDraft.title}
正文：${originalDraft.content}
标签：${originalDraft.hashtags.join(' ')}
CTA：${originalDraft.cta}

## 审查不通过维度（共${failedDims.length}项）
${failedFeedback}

## 原始 Brief
${brief}

请根据审查意见修正后，严格按以下 JSON 输出（不要代码块包裹）：
{"title":"修正后标题","content":"修正后正文","hashtags":["标签1","标签2"],"cta":"修正后CTA"}`;

  const genBaseURL = APIYI_BASE_URL;
  const genKey = process.env.ANTHROPIC_API_KEY;
  const genModel = process.env.GENERATE_MODEL || 'claude-sonnet-4-6';
  const maxTokens = Math.min(Math.ceil(rule.wordRange[1] * 2.5) + 300, 4096);

  if (genBaseURL && genKey) {
    const apiBase = genBaseURL.endsWith('/v1') ? genBaseURL : `${genBaseURL}/v1`;
    try {
      const rawText = await callOpenAICompatible(apiBase, genKey, genModel, systemPrompt, userMessage, maxTokens);
      if (rawText) {
        let jsonStr = rawText.replace(/^```(?:json)?[\s\n]*/i, '').replace(/[\s\n]*```$/i, '').trim();
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          jsonStr = jsonStr.replace(/"([^"]*?)"/g, (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r'));
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            console.error(`[Revise] ${rule.name} JSON 解析失败`);
            return null;
          }
        }
        console.log(`[Revise] ${rule.name} ✓ 修正完成, 修复 ${failedDims.length} 项`);
        return {
          platform: rule.name,
          title: parsed.title || originalDraft.title,
          content: parsed.content || originalDraft.content,
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : originalDraft.hashtags,
          wordCount: `${parsed.content?.length || 0}字`,
          cta: parsed.cta || originalDraft.cta,
        };
      }
    } catch (err) {
      console.error(`[Revise] ${rule.name} 修正失败:`, err);
    }
  }

  return null;
}
// ==================== EASYCLAW 审查（DeepSeek 或 Claude 降级） ====================

export async function reviewWithAI(
  platformId: PlatformId,
  content: string,
  brandContext: string,
): Promise<{
  score: number;
  totalDimensions: number;
  passCount: number;
  dimensions: { name: string; pass: boolean; note: string }[];
  verdict: string;
  rounds: number;
} | null> {
  const rule = PLATFORM_RULES[platformId];

  const systemPrompt = `你是周生生品牌的内容审查专家（代号：暴躁参谋）。你以极其严格的标准审查${rule.name}平台的营销文案草稿。

## 你的审查原则
- 你是"找问题"的人，不是"说好话"的人。
- 如果不满足标准，果断打低分并要求重写。

## 五个核心审查维度

### 1. 品牌度自查 (Brand ToV Check)
- 文案是否体现了“匠心 / 雅致”？
- 是否自然地使用了正面词汇库（如温润、叙事、流转）？
- 致命错误：是否使用了“廉价网感词”（如绝绝子、yyds、买它、爆款、入股不亏、家人们）或者陈腐词（匠心独运、极致奢华）？如果有，直接判 fail。

### 2. 渠道适配自查 (Channel Logic)
- **如果是小红书**：有没有写具体的 OOTD / 穿搭场景？占比是否过低（没有达到40%）？
- **如果是企微**：是否超过 100 字？排版是否是极简 Bullet Points？
- **如果是微博**：是否是客观的官方发言人视角？

### 3. 字数与格式铁律 (Format & Constraint)
- **字数硬指标**：正文必须在 ${rule.wordRange[0]}-${rule.wordRange[1]} 个中文字之间。超出或不足直接判 fail。
- 内容必须是直接可发布的成品，有没有出现策划用语（例如“建议：”、“小标题：”）、有没有使用占位符？如果有直接 fail。

### 4. 转化自查 (Conversion Hooks)
- 结尾是否有明确的、具体的 CTA？
- 特别是企微渠道，有没有加入线下服务标签（如“预约一对一试戴”、“免费清洗”、“备婚礼遇”）？只写“欢迎选购”不够，必须是明确的服务与行动转化。

### 5. 弃读率与可读性 (Readability)
- 每一句是否过长？是否符合“短句排比，留白呼吸”的诗意节奏？
- 画面感强不强？是不是纯粹的空洞抒情堆砌？开头有没有迅速抓住眼球？

## 评分规则
- 5项全部 pass 且没有任何负面词 → score 9-10分
- 1项 fail → score 7-8分
- 2项 fail → score 5-7分
- 3项以上 fail → score 5分以下`;

  // 计算实际字数提供给审查模型
  const contentChars = content.replace(/[\s\n#@]/g, '').length;

  const userMessage = `审查以下【${rule.name}】平台文案（字数要求 ${rule.wordRange[0]}-${rule.wordRange[1]} 字，实际约 ${contentChars} 字）：

文案内容：
${content}

品牌知识库参考：
${brandContext.substring(0, 500)}

请严格按以下 JSON 格式输出（不要代码块包裹，note 字段用简短中文说明原因）：
{"score":8.5,"dimensions":[{"name":"标题吸引力","pass":true,"note":"说明"},{"name":"品牌调性一致","pass":true,"note":"说明"},{"name":"平台规范合规","pass":true,"note":"说明"},{"name":"弃读率风控","pass":true,"note":"说明"},{"name":"CTA转化检查","pass":true,"note":"说明"}],"verdict":"审查结论"}`;

  // ── 审查引擎：优先 Gemini Flash（同一 API易密钥），降级 Claude ──
  const reviewKey = process.env.ANTHROPIC_API_KEY || '';
  const reviewModel = process.env.REVIEW_MODEL || 'gemini-3.1-flash-lite-preview';

  if (reviewKey) {
    try {
      const rawText = await callGeminiNative(
        reviewKey,
        reviewModel,
        systemPrompt,
        userMessage,
      );

      if (rawText) {
        let jsonStr = rawText.replace(/^```(?:json)?[\s\n]*/i, '').replace(/[\s\n]*```$/i, '').trim();
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          // 修复换行符
          jsonStr = jsonStr.replace(/"([^"]*?)"/g, (match) => {
            return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          });
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            console.error(`[Review] JSON 解析失败:`, rawText.substring(0, 200));
            return null;
          }
        }
        const dims = parsed.dimensions || [];

        // ── 程序化字数硬拦截：不信任 LLM 的字数判断 ──
        const complianceDim = dims.find((d: { name: string }) => d.name === '平台规范合规');
        if (complianceDim) {
          const isWordCountOk = contentChars >= rule.wordRange[0] && contentChars <= rule.wordRange[1];
          if (!isWordCountOk) {
            complianceDim.pass = false;
            complianceDim.note = `字数不合规：实际${contentChars}字，要求${rule.wordRange[0]}-${rule.wordRange[1]}字`;
            console.log(`[Review] ${rule.name} 程序化字数拦截: ${contentChars}字 (要求${rule.wordRange[0]}-${rule.wordRange[1]})`);
          }
        }

        const passCount = dims.filter((d: { pass: boolean }) => d.pass).length;
        // 根据 passCount 重新算分
        const adjustedScore = passCount === 5 ? (parsed.score || 9)
          : passCount === 4 ? Math.min(parsed.score || 8, 7.5)
          : passCount === 3 ? Math.min(parsed.score || 6, 6)
          : Math.min(parsed.score || 4, 4);

        return {
          score: adjustedScore,
          totalDimensions: 5,
          passCount,
          dimensions: dims,
          verdict: passCount === 5 ? (parsed.verdict || '审查通过') : `${5 - passCount}项不通过，需修正`,
          rounds: 1,
        };
      }
    } catch (err) {
      console.error(`[Gemini Review] ${rule.name} 审查失败:`, err);
    }
  }

  // 降级：用 Claude 同一通道做审查
  const genBaseURL = APIYI_BASE_URL;
  if (genBaseURL && reviewKey) {
    const apiBase = genBaseURL.endsWith('/v1') ? genBaseURL : `${genBaseURL}/v1`;
    try {
      const rawText = await callOpenAICompatible(
        apiBase,
        reviewKey,
        process.env.GENERATE_MODEL || 'claude-sonnet-4-6',
        systemPrompt,
        userMessage,
        1024,
      );

      if (rawText) {
        let jsonStr2 = rawText.replace(/^```(?:json)?[\s\n]*/i, '').replace(/[\s\n]*```$/i, '').trim();
        let parsed2;
        try {
          parsed2 = JSON.parse(jsonStr2);
        } catch {
          jsonStr2 = jsonStr2.replace(/"([^"]*?)"/g, (match) => {
            return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
          });
          try {
            parsed2 = JSON.parse(jsonStr2);
          } catch {
            console.error(`[Claude Review] JSON 解析失败:`, rawText.substring(0, 200));
            return null;
          }
        }
        const dims = parsed2.dimensions || [];
        const passCount = dims.filter((d: { pass: boolean }) => d.pass).length;

        return {
          score: parsed2.score || 8,
          totalDimensions: 5,
          passCount,
          dimensions: dims,
          verdict: parsed2.verdict || '审查完成',
          rounds: 1,
        };
      }
    } catch (err) {
      console.error(`[Claude Review Fallback] ${rule.name} 审查失败:`, err);
    }
  }

  return null;
}
