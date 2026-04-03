import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 品牌数据库的绝对路径（本地 PSSD 外置硬盘）
const BRAND_DB_PATH = '/Volumes/PSSD/周生生/BRAND_DATABASE.md';
const BRAND_DB_MULTIMODAL_PATH = '/Volumes/PSSD/周生生/BRAND_DATABASE_MULTIMODAL.md';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'structured'; // structured | multimodal

  try {
    const targetPath = mode === 'multimodal' ? BRAND_DB_MULTIMODAL_PATH : BRAND_DB_PATH;

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json(
        { error: `品牌数据库文件未找到: ${targetPath}` },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(targetPath, 'utf-8');

    // 提取图片引用列表（仅多模态模式）
    const imageRefs: string[] = [];
    if (mode === 'multimodal') {
      const imgRegex = /!\[.*?\]\((\.\/assets\/[^)]+)\)/g;
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        imageRefs.push(match[1]);
      }
    }

    // 按 ## 标题分割成独立的知识块
    const sections = content
      .split(/^## /m)
      .filter(s => s.trim())
      .map(s => {
        const lines = s.split('\n');
        const title = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        return { title, body };
      });

    return NextResponse.json({
      mode,
      totalSections: sections.length,
      totalImages: imageRefs.length,
      sections,
      raw: content.substring(0, 500) + '...',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
