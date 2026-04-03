/**
 * 四平台差异化写作规则 — 内建知识库
 * 来源：腾讯 SkillsHub 平台规范研究 + 行业最佳实践
 */

export type PlatformId = 'weibo' | 'wechat' | 'xiaohongshu' | 'wecom';

export interface PlatformRule {
  id: PlatformId;
  name: string;
  icon: string;
  position: string;       // 平台定位
  style: string;          // 写作风格
  wordRange: [number, number]; // 字数区间
  hashtagRule: string;    // Hashtag 用法
  ctaTemplate: string;    // 行动号召模板
  formatTips: string;     // 排版提示
  toneGuide: string;      // 语气指导
  sampleStructure: string; // 结构模板
}

export const PLATFORM_RULES: Record<PlatformId, PlatformRule> = {
  weibo: {
    id: 'weibo',
    name: '微博',
    icon: '🔥',
    position: '热点传播 · 公域舆论场 · 粉丝互动',
    style: '品牌官方发言人视角，克制、凝练、大气，减少第一人称“我”，增加第三人称“周生生”、“我们”',
    wordRange: [60, 100],
    hashtagRule: '必须添加 1-2 个 #话题# 标签（含品牌话题 + 热点话题）',
    ctaTemplate: '官方邀请预约 / 互动提问 + @品牌官方微博 + 话题标签',
    formatTips: '固定三段式：宏观意象引导 + 核心系列推介 + 官方邀请预约',
    toneGuide: '克制、凝练、大气，品牌官方发言人',
    sampleStructure: `【宏观意象引导】
【核心系列推介】（点出设计与寓意）
【官方邀请预约】（转化动作）
#品牌话题# #热点话题#`,
  },

  wechat: {
    id: 'wechat',
    name: '微信公众号',
    icon: '💎',
    position: '深度内容沉淀 · 品牌私域 · 垂直深度',
    style: '价值感、深度专业、排版精致、品牌调性统一',
    wordRange: [800, 1500],
    hashtagRule: '不适用（微信搜索靠文章关键词布局，无话题标签机制）',
    ctaTemplate: '文末引导：小程序跳转 / 阅读原文 / 关注公众号',
    formatTips: '结构化分段 + 小标题 + 14-16px字号 + 1.5倍行距 + 配色≤3种',
    toneGuide: '品牌资深专栏作家、有温度的专业、叙事化',
    sampleStructure: `【标题：系列名+核心卖点+情感修饰】

引言段（场景代入 / 情绪引子）

## 产品亮点 1
详细描述 + 工艺/材质

## 产品亮点 2
详细描述 + 使用场景

## 搭配建议
单戴叠搭 + 送礼指引

👉 点击小程序，探索更多新品 →`,
  },

  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    position: '种草决策 · 生活方式分享 · 真实评测',
    style: '生活方式 OOTD 博主视角，强烈的生活场景代入感（足金+龙鳞≈新中式/老钱风；PROMESSA≈职场通勤/西装）',
    wordRange: [300, 450],
    hashtagRule: '必须添加 3-5 个精准标签（品牌标签 + 产品标签 + 场景标签）',
    ctaTemplate: '评论区互动提问（"你们觉得哪款更好看？"）',
    formatTips: '强制约束：必须包含“穿搭场景描述”模块，且比例不低于总篇幅的40%',
    toneGuide: '精致生活方式博主/穿搭搭子、真实种草、不硬推',
    sampleStructure: `【标题：数字+emoji+核心关键词，≤20字】

【引入语：情绪或痛点切入】

📌 穿搭场景分享（占全文40%以上）
结合具体衣服材质、颜色、妆容、出名场景（如新中式、极简风、通勤）进行沉浸式描述…

✨ 产品工艺细节（占全文30%）
具体工艺的真实感受（如捶打纹、哑光质感）…

💡 搭配建议（占全文20%）
叠搭技巧…

【互动引导】（占全文10%）
#主要标签 #场景标签 #OOTD`,
  },

  wecom: {
    id: 'wecom',
    name: '企微朋友圈',
    icon: '🤝',
    position: '私域精细运营 · 一对一互动 · CRM转化',
    style: '贴心且专业的周生生专属顾问，强制采用 Bullet points 提炼核心卖点',
    wordRange: [40, 100],
    hashtagRule: '不适用（企微无话题机制）',
    ctaTemplate: '结合线下服务标签（免费清洗、专属顾问预约、备婚季限时礼遇、一对一试戴）',
    formatTips: '格式严格化：【活动/系列名】+ 核心卖点(Bullet) + 明确CTA（带服务价值）',
    toneGuide: '贴心、专业、直接、带有极强的服务感和促单转化钩子',
    sampleStructure: `【活动/系列名称】
补充一句价值点/稀缺性
- 核心卖点或者工艺细节 1
- 核心卖点或者工艺细节 2
👉 【明确服务 CTA】（欢迎私信预约一对一试戴/免费清洗服务）`,
  },
};

// 获取全部平台 ID 列表
export const PLATFORM_IDS: PlatformId[] = ['weibo', 'wechat', 'xiaohongshu', 'wecom'];

// 获取平台名称映射
export const PLATFORM_NAMES: Record<PlatformId, string> = {
  weibo: '微博',
  wechat: '微信公众号',
  xiaohongshu: '小红书',
  wecom: '企微朋友圈',
};
