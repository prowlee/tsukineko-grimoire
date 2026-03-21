/**
 * /api/paper-figures?arxivId=XXXX
 *
 * arXiv HTML 版から代表図を抽出して返す。
 * ブラウザは返された URL を直接 <img> タグで表示する（GCS 保存なし）。
 *
 * 代表図の選定ルール：
 * 1. キャプションに overview / architecture / framework / proposed / pipeline
 *    / system / model を含む figure を優先
 * 2. なければ本文中で最初に登場する figure
 * 3. 最大 3 件を返す
 */

import * as cheerio from 'cheerio';

export const revalidate = 86400; // 24時間キャッシュ

interface Figure {
  url: string;
  caption: string;
  label: string;
}

const PRIORITY_KEYWORDS = [
  'overview', 'architecture', 'framework', 'proposed', 'pipeline',
  'system', 'model', 'approach', 'method', 'illustration',
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const arxivId = searchParams.get('arxivId')?.trim();

  if (!arxivId) {
    return Response.json({ figures: [] });
  }

  // arXiv HTML 版を取得
  const htmlUrl = `https://arxiv.org/html/${arxivId}`;
  let html: string;
  try {
    const res = await fetch(htmlUrl, {
      headers: { 'User-Agent': 'TsukinekoGrimoire/1.0 (research tool)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return Response.json({ figures: [] });
    html = await res.text();
  } catch {
    return Response.json({ figures: [] });
  }

  // ベース URL（相対パスを絶対 URL に変換するために使用）
  const baseUrl = htmlUrl.endsWith('/') ? htmlUrl : htmlUrl + '/';

  try {
    const $ = cheerio.load(html);
    const allFigures: Figure[] = [];

    // arXiv HTML の figure 要素を走査
    $('figure').each((_, el) => {
      const figure = $(el);

      // img タグを取得
      const img = figure.find('img').first();
      if (!img.length) return;

      const src = img.attr('src') ?? img.attr('data-src') ?? '';
      if (!src) return;

      // SVG の場合はスキップ（inline SVG は URL として扱えない）
      if (src.startsWith('data:') || src.endsWith('.svg')) return;

      // 相対 URL → 絶対 URL
      let url: string;
      try {
        url = new URL(src, baseUrl).href;
      } catch {
        return;
      }

      // arXiv ドメイン外はスキップ
      if (!url.includes('arxiv.org')) return;

      const captionEl = figure.find('figcaption');
      const caption = captionEl.text().trim().replace(/\s+/g, ' ').slice(0, 300);
      const label = figure.attr('id') ?? img.attr('id') ?? '';

      allFigures.push({ url, caption, label });
    });

    if (allFigures.length === 0) {
      return Response.json({ figures: [] });
    }

    // 代表図を選定
    const prioritized: Figure[] = [];
    const rest: Figure[] = [];

    for (const fig of allFigures) {
      const captionLower = fig.caption.toLowerCase();
      const isPriority = PRIORITY_KEYWORDS.some(kw => captionLower.includes(kw));
      if (isPriority) {
        prioritized.push(fig);
      } else {
        rest.push(fig);
      }
    }

    // 優先図を先頭に、なければ最初の図を使用（最大 3 件）
    const selected = [...prioritized, ...rest].slice(0, 3);

    return Response.json({ figures: selected });
  } catch {
    return Response.json({ figures: [] });
  }
}
