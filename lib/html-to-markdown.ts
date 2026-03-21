import * as cheerio from 'cheerio';
import type { PaperMetadata } from './pdf-to-markdown';

/**
 * arXiv HTML 版（https://arxiv.org/html/{arxivId}）を取得して
 * メタデータ付き Markdown に変換する。
 *
 * PDF パースと比べて以下の点が優れている：
 * - 2段組レイアウトの乱れがない
 * - セクション見出しが正確に取れる
 * - 数式は LaTeX 表記として保持される
 *
 * HTML 版が存在しない場合（404 など）は null を返し、
 * 呼び出し側で PDF フォールバックを実施する。
 */
export async function fetchArxivHtmlAsMarkdown(
  arxivId: string,
  meta: PaperMetadata
): Promise<string | null> {
  const url = `https://arxiv.org/html/${arxivId}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TsukinekoGrimoire/1.0 (research tool; contact: admin@example.com)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null; // 404 など → PDF フォールバック
    html = await res.text();
  } catch {
    return null; // タイムアウト・ネットワークエラー → PDF フォールバック
  }

  try {
    return parseHtmlToMarkdown(html, meta);
  } catch {
    return null;
  }
}

/**
 * arXiv HTML を cheerio でパースして Markdown を組み立てる。
 */
function parseHtmlToMarkdown(html: string, meta: PaperMetadata): string {
  const $ = cheerio.load(html);

  // arXiv HTML 版で不要な要素を除去
  $('script, style, nav, header, footer').remove();
  $('[aria-hidden="true"]').remove();
  // 引用リスト・参考文献セクションは検索ノイズになるため除去
  $('section.ltx_bibliography').remove();
  $('section#references').remove();
  $('div.ltx_bibliography').remove();

  // セクションを順番に抽出して Markdown に変換
  const lines: string[] = [];

  // ── ヘッダー（メタデータブロック）──────────────────────────────
  const authorsStr = meta.authors.length > 0 ? meta.authors.join(', ') : 'Unknown';
  const arxivUrl = `https://arxiv.org/abs/${meta.arxivId}`;

  lines.push(`# ${meta.title}`);
  lines.push('');
  lines.push(`**Authors:** ${authorsStr}`);
  if (meta.publishedAt) lines.push(`**Published:** ${meta.publishedAt}`);
  if (meta.category)    lines.push(`**Category:** ${meta.category}`);
  lines.push(`**Source:** ${arxivUrl}`);
  lines.push('');

  // ── 日本語概要（日本語クエリとのマッチング向上）────────────────
  if (meta.summaryJa) {
    lines.push('## 日本語概要');
    lines.push('');
    lines.push(meta.summaryJa);
    lines.push('');
  }

  // ── 英語 Abstract ───────────────────────────────────────────────
  if (meta.summary) {
    lines.push('## Abstract');
    lines.push('');
    lines.push(meta.summary);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── 本文：arXiv HTML のセクション構造を走査 ─────────────────────
  // arXiv HTML は ltx_section / ltx_subsection などのクラスで構造化されている
  const body = extractBodyText($);
  if (body) {
    lines.push(body);
  }

  return lines.join('\n');
}

/**
 * arXiv HTML の本文テキストを階層的に抽出して Markdown 形式に変換する。
 * - h1〜h4 → Markdown 見出し
 * - p → 段落テキスト
 * - 数式（.ltx_Math）→ LaTeX 表記に変換
 */
function extractBodyText($: cheerio.CheerioAPI): string {
  const lines: string[] = [];

  // arXiv HTML の本文コンテナ候補
  const bodyContainer =
    $('article').first().length ? $('article').first() :
    $('div.ltx_page_content').first().length ? $('div.ltx_page_content').first() :
    $('body');

  bodyContainer.find('h1, h2, h3, h4, p, .ltx_theorem, .ltx_proof').each((_, el) => {
    const tag = (el as cheerio.Element).tagName?.toLowerCase() ?? '';
    const elem = $(el);

    // 見出し
    if (tag === 'h1') { lines.push(`\n## ${cleanText(elem.text())}\n`); return; }
    if (tag === 'h2') { lines.push(`\n### ${cleanText(elem.text())}\n`); return; }
    if (tag === 'h3') { lines.push(`\n#### ${cleanText(elem.text())}\n`); return; }
    if (tag === 'h4') { lines.push(`\n##### ${cleanText(elem.text())}\n`); return; }

    // 段落・定理・証明
    if (tag === 'p' || elem.hasClass('ltx_theorem') || elem.hasClass('ltx_proof')) {
      // 数式要素を LaTeX 表記に変換
      elem.find('.ltx_Math, math').each((_, mathEl) => {
        const altText = $(mathEl).attr('alttext') ?? $(mathEl).text();
        $(mathEl).replaceWith(altText ? `$${altText}$` : '');
      });

      const text = cleanText(elem.text());
      if (text.length > 10) { // 短すぎる断片は除外
        lines.push(text);
        lines.push('');
      }
    }
  });

  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

/**
 * テキストのクリーニング：連続空白の圧縮、制御文字の除去
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\u3000-\u9FFF\uFF00-\uFFEF$]/g, ' ')
    .trim();
}
