import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { analyzeImagesWithGemini } from '@/lib/ai-engine';

// 路径：优先项目内目录（部署），回退本地 PSSD（开发）
function resolveWritablePath(subdir: string): string {
  const inProject = path.join(process.cwd(), subdir);
  const localPath = `/Volumes/PSSD/周生生/${subdir}`;
  // 部署环境用项目内目录，本地开发用 PSSD
  if (fs.existsSync(localPath)) return localPath;
  if (!fs.existsSync(inProject)) fs.mkdirSync(inProject, { recursive: true });
  return inProject;
}
function resolveDataFile(filename: string): string {
  const inProject = path.join(process.cwd(), 'data', filename);
  if (fs.existsSync(inProject)) return inProject;
  const localPath = `/Volumes/PSSD/周生生/${filename}`;
  if (fs.existsSync(localPath)) return localPath;
  return inProject;
}
const BRAND_DB_PATH = resolveDataFile('BRAND_DATABASE.md');
const ASSETS_DIR = resolveWritablePath('assets');

// 确保 assets 目录存在
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

/**
 * 简易 PDF 文字提取（不依赖 Canvas）
 * 从 PDF buffer 中提取所有可读的 ASCII/UTF-8 文本流
 */
function extractTextFromPdf(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const textParts: string[] = [];

  // 解码 PDF stream 中被 BT...ET 包裹的文本
  const textBlocks = content.match(/BT[\s\S]*?ET/g);
  if (textBlocks) {
    for (const block of textBlocks) {
      // 提取 Tj、TJ、' 操作符对应的字面量文字
      const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g);
      if (tjMatches) {
        for (const m of tjMatches) {
          const text = m.replace(/\(([^)]*)\)\s*Tj/, '$1');
          if (text && /[\u0020-\u007e]/.test(text)) {
            textParts.push(text);
          }
        }
      }
    }
  }

  // 备用：提取所有可读的文本块
  if (textParts.length < 5) {
    const utfContent = buffer.toString('utf-8');
    // 查找连续的中文+英文文字块
    const readable = utfContent.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffefa-zA-Z0-9\s,.!?;:'"()（）。，！？；：""''【】]{10,}/g);
    if (readable) {
      textParts.push(...readable.slice(0, 100));
    }
  }

  return textParts.join('\n').trim();
}

/**
 * POST /api/upload
 * 接收上传文件（PPT/Word/PDF/图片），提取内容追加到品牌数据库
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: '未上传任何文件' }, { status: 400 });
    }

    const results: {
      filename: string;
      type: string;
      textExtracted: number;
      imagesExtracted: number;
      status: string;
    }[] = [];

    // 延迟导入 mammoth（只在需要时加载）
    const mammoth = await import('mammoth');

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase();
      const baseName = path.basename(file.name, ext);

      let extractedText = '';
      let imagesCount = 0;

      switch (ext) {
        case '.docx':
        case '.doc': {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;

          // 提取 docx 中的图片
          const imgResult = await mammoth.convertToHtml({ buffer });
          const imgMatches = imgResult.value.match(/src="data:image\/[^"]+"/g);
          if (imgMatches) {
            for (let i = 0; i < imgMatches.length; i++) {
              const dataUrl = imgMatches[i].replace('src="', '').replace('"', '');
              const imgData = dataUrl.split(',')[1];
              if (imgData) {
                const imgExt = dataUrl.includes('png') ? 'png' : 'jpg';
                const imgPath = path.join(ASSETS_DIR, `${baseName}_img${i + 1}.${imgExt}`);
                fs.writeFileSync(imgPath, Buffer.from(imgData, 'base64'));
                imagesCount++;
              }
            }
          }
          break;
        }

        case '.pdf': {
          extractedText = extractTextFromPdf(buffer);
          if (!extractedText) {
            extractedText = `[PDF 文件] ${file.name} — 需要 OCR 提取（当前已保存原件）`;
          }
          // 同时保存原始 PDF
          const pdfPath = path.join(ASSETS_DIR, file.name);
          fs.writeFileSync(pdfPath, buffer);
          break;
        }

        case '.pptx':
        case '.ppt': {
          // PPTX 是 ZIP 格式，提取 slide XML 中的文字
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip(buffer);
          const entries = zip.getEntries();
          const textParts: string[] = [];
          const pptImages: { name: string; mimeType: string; base64: string }[] = [];

          for (const entry of entries) {
            // 提取幻灯片文字
            if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
              const xml = entry.getData().toString('utf8');
              const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
              if (textMatches) {
                const slideTexts = textMatches.map(m => m.replace(/<\/?a:t>/g, '')).filter(t => t.trim());
                textParts.push(slideTexts.join(' '));
              }
            }
            // 提取图片（保存 + 收集 base64 给 Gemini 分析）
            if (entry.entryName.startsWith('ppt/media/') && /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(entry.entryName)) {
              const imgName = `${baseName}_${path.basename(entry.entryName)}`;
              const imgPath = path.join(ASSETS_DIR, imgName);
              const imgData = entry.getData();
              fs.writeFileSync(imgPath, imgData);
              imagesCount++;
              // 只分析前 4 张图（节省 Token）
              if (pptImages.length < 4) {
                const ext2 = path.extname(entry.entryName).toLowerCase();
                const mime = ext2 === '.png' ? 'image/png' : 'image/jpeg';
                pptImages.push({ name: imgName, mimeType: mime, base64: imgData.toString('base64') });
              }
            }
          }

          extractedText = textParts.join('\n\n');

          // 用 Gemini 分析 PPT 中的图片
          if (pptImages.length > 0) {
            console.log(`[Upload] PPT 内含 ${pptImages.length} 张图，送 Gemini 分析...`);
            const visionAnalysis = await analyzeImagesWithGemini(pptImages);
            if (visionAnalysis) {
              extractedText += '\n\n【Gemini 视觉分析 PPT 图片内容】\n' + visionAnalysis;
            }
          }
          break;
        }

        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
        case '.webp':
        case '.bmp': {
          const imgPath = path.join(ASSETS_DIR, file.name);
          fs.writeFileSync(imgPath, buffer);
          imagesCount = 1;

          // 用 Gemini Vision 分析图片内容，提炼为品牌知识
          const ext3 = ext === '.png' ? 'image/png' : 'image/jpeg';
          console.log(`[Upload] 图片 ${file.name}，送 Gemini Vision 分析...`);
          const visionResult = await analyzeImagesWithGemini([{
            name: file.name,
            mimeType: ext3,
            base64: buffer.toString('base64'),
          }]);

          if (visionResult) {
            extractedText = '【Gemini 视觉识别品牌知识】\n' + visionResult;
          } else {
            extractedText = `[图片] ${file.name} — 视觉分析暂不可用，已保存原件`;
          }
          break;
        }

        case '.md':
        case '.txt': {
          extractedText = buffer.toString('utf-8');
          break;
        }

        default:
          results.push({
            filename: file.name,
            type: ext,
            textExtracted: 0,
            imagesExtracted: 0,
            status: `不支持的格式: ${ext}`,
          });
          continue;
      }

      // 将提取的内容追加到品牌数据库
      if (extractedText.trim()) {
        const timestamp = new Date().toISOString().split('T')[0];
        const appendContent = `\n\n---\n\n## 📥 导入：${file.name} (${timestamp})\n\n${extractedText.trim()}\n`;
        fs.appendFileSync(BRAND_DB_PATH, appendContent, 'utf-8');
      }

      results.push({
        filename: file.name,
        type: ext,
        textExtracted: extractedText.length,
        imagesExtracted: imagesCount,
        status: '✅ 提取成功',
      });
    }

    // 重新统计品牌库信息
    const updatedContent = fs.readFileSync(BRAND_DB_PATH, 'utf-8');
    const sectionCount = (updatedContent.match(/^## /gm) || []).length;

    return NextResponse.json({
      success: true,
      filesProcessed: results.length,
      results,
      brandDbSections: sectionCount,
      brandDbSize: updatedContent.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/upload
 * 返回品牌数据库当前状态
 */
export async function GET() {
  try {
    if (!fs.existsSync(BRAND_DB_PATH)) {
      return NextResponse.json({ exists: false, sections: 0, size: 0 });
    }
    const content = fs.readFileSync(BRAND_DB_PATH, 'utf-8');
    const sectionCount = (content.match(/^## /gm) || []).length;

    let assetCount = 0;
    if (fs.existsSync(ASSETS_DIR)) {
      assetCount = fs.readdirSync(ASSETS_DIR).filter(f => !f.startsWith('.')).length;
    }

    return NextResponse.json({
      exists: true,
      sections: sectionCount,
      size: content.length,
      assetCount,
      lastModified: fs.statSync(BRAND_DB_PATH).mtime.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
