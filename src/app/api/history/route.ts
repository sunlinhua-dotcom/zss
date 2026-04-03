import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = (() => {
  const inProject = path.join(process.cwd(), 'outputs');
  const localPath = '/Volumes/PSSD/周生生/outputs';
  if (fs.existsSync(localPath)) return localPath;
  if (!fs.existsSync(inProject)) fs.mkdirSync(inProject, { recursive: true });
  return inProject;
})();

export async function GET() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return NextResponse.json({ history: [] });
    }

    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.endsWith('.txt'))
      .sort()
      .reverse(); // 最新的在前

    const history = files.map(filename => {
      const filepath = path.join(OUTPUT_DIR, filename);
      const content = fs.readFileSync(filepath, 'utf-8');

      // 从文件内容提取元数据
      const lines = content.split('\n');
      const timeLine = lines.find(l => l.startsWith('📅')) || '';
      const engineLine = lines.find(l => l.startsWith('🤖')) || '';
      const subjectLine = lines.find(l => l.startsWith('📌')) || '';
      const briefLine = lines.find(l => l.startsWith('Brief：')) || '';

      // 提取每个平台的标题
      const platformTitles: Record<string, string> = {};
      const platformMatches = content.matchAll(/【(.+?)】[\s\S]*?标题：(.+)/g);
      for (const m of platformMatches) {
        platformTitles[m[1]] = m[2].trim();
      }

      return {
        filename,
        time: timeLine.replace('📅 生成时间：', '').trim(),
        engine: engineLine.replace('🤖 引擎：', '').trim(),
        brief: briefLine.replace('Brief：', '').trim().substring(0, 60) + (briefLine.length > 66 ? '...' : ''),
        subject: subjectLine.replace('📌 主题：', '').trim(),
        platformTitles,
        raw: content,
      };
    });

    return NextResponse.json({ history });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
