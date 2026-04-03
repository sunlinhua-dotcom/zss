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
    style: '轻松及时、观点鲜明、社交感强、能引发共鸣或讨论',
    wordRange: [60, 100],
    hashtagRule: '必须添加 1-2 个 #话题# 标签（含品牌话题 + 热点话题）',
    ctaTemplate: '互动提问 + @品牌官方微博 + 话题标签',
    formatTips: 'emoji 分割 + 短句为主 + 配图说明 + @互动',
    toneGuide: '活泼、快节奏、有观点、适度玩梗',
    sampleStructure: `【hook 开头·引发好奇】
正文（2-3 段短句，每段 emoji 分割）
互动提问
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
    toneGuide: '品牌感、有温度的专业、叙事化',
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
    style: '真诚经验分享、精致视觉、POV第一视角、高互动',
    wordRange: [300, 450],
    hashtagRule: '必须添加 3-5 个精准标签（品牌标签 + 产品标签 + 场景标签）',
    ctaTemplate: '评论区互动提问（\"你们觉得哪款更好看？\"）',
    formatTips: 'emoji 丰富 + 段落清晰 + 首图精美 + 文末互动问题',
    toneGuide: '闺蜜推荐、真实种草、有细节、不硬推',
    sampleStructure: `【标题：数字+emoji+核心关键词，≤20字】

姐妹们！这波真的被戳到了 🫠

📌 关于这个系列
第一人称真实体验描述…

✨ 最打动我的 3 个细节
1️⃣ 细节一…
2️⃣ 细节二…
3️⃣ 细节三…

💡 搭配心得
上手实拍分享…

你们更喜欢哪款？评论区告诉我！👇

#品牌标签 #产品标签 #场景标签 #种草标签`,
  },

  wecom: {
    id: 'wecom',
    name: '企微朋友圈',
    icon: '🤝',
    position: '私域精细运营 · 一对一互动 · CRM转化',
    style: '贴心、专业、直接、服务感、弱广告感',
    wordRange: [40, 100],
    hashtagRule: '不适用（企微无话题机制）',
    ctaTemplate: '直接行动引导："私信我领取专属优惠" / "扫码预约到店"',
    formatTips: '极简精炼 + 配实拍图 + 口语化 + 不超过3行',
    toneGuide: '像朋友推荐、服务感、有温度但不啰嗦',
    sampleStructure: `【一句话核心推荐】
补充一句价值点/稀缺性
👉 行动引导（私信/预约/链接）`,
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
