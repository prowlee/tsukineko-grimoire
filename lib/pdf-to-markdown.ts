// pdf-parse のトップレベル import は Cloud Run で DOMMatrix クラッシュを引き起こすため禁止。
// pdfToMarkdown() 内でのみ dynamic require する。
// ENABLE_PDF_PARSE=true が設定されていない限り pdf-parse は呼ばない。

export interface PaperMetadata {
  title: string;
  authors: string[];
  category: string;
  publishedAt: string;
  arxivId: string;
  summary: string;
  summaryJa: string;
}

export type ContentSource = 'html' | 'pdf' | 'metadata_only';
export type ParseStatus = 'success' | 'fallback' | 'disabled' | 'failed';

/**
 * PDF バッファをテキスト抽出してメタデータ注入型 Markdown に変換する。
 *
 * Cloud Run 本番では ENABLE_PDF_PARSE=true が設定されていないため、
 * pdf-parse を呼ばずに metadata-only の Markdown を返す。
 * これにより route のモジュール初期化時に DOMMatrix クラッシュが起きない。
 */
export async function pdfToMarkdown(
  pdfBuffer: Buffer,
  meta: PaperMetadata
): Promise<{ markdown: string; parseStatus: ParseStatus }> {
  // 環境変数が明示的に true でなければ pdf-parse を一切呼ばない
  if (process.env.ENABLE_PDF_PARSE !== 'true') {
    console.log(`[collector] pdf parse disabled by env for ${meta.arxivId}`);
    return { markdown: buildMarkdown(meta, ''), parseStatus: 'disabled' };
  }

  console.log(`[collector] pdf fallback entered for ${meta.arxivId}`);

  let bodyText = '';
  let parseStatus: ParseStatus = 'failed';

  try {
    // dynamic require — モジュール評価時ではなく実行時にのみ pdf-parse を読み込む
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse') as {
      PDFParse: new (options: { data: Buffer }) => {
        getText(): Promise<{ text: string }>;
      };
    };
    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText();
    bodyText = cleanPdfText(parsed.text);
    parseStatus = 'success';
  } catch (err) {
    console.error(
      `[collector] pdf parse failed, using metadata-only markdown for ${meta.arxivId}:`,
      (err as Error).message?.slice(0, 120)
    );
    parseStatus = 'failed';
    // bodyText は空のまま → metadata-only markdown にフォールバック
  }

  return { markdown: buildMarkdown(meta, bodyText), parseStatus };
}

/**
 * PDFテキストのクリーニング:
 * - 連続する空白・改行を圧縮
 * - 非印刷文字を除去
 * - ヘッダー/フッターのページ番号パターンを削除
 */
function cleanPdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[^\x20-\x7E\n\u3000-\u9FFF\uFF00-\uFFEF]/g, ' ') // 非印刷文字を空白に
    .replace(/[ \t]{3,}/g, '  ')               // 3つ以上の連続空白を2つに
    .replace(/\n{4,}/g, '\n\n\n')              // 4行以上の空行を3行に
    .replace(/^\s*\d+\s*$/gm, '')             // 単独行のページ番号を削除
    .trim();
}

/**
 * メタデータ + 本文テキストから Markdown を組み立てる。
 *
 * 構造の設計方針：
 * - タイトルは先頭（文書識別に使用）
 * - 概要（日本語・英語）はタイトル直後（クエリとのマッチング最優先）
 * - 著者名・日付などのメタデータは末尾に配置
 *   → Agent Builder の extractive_answers が著者名行を誤抽出しないようにする
 */
function buildMarkdown(meta: PaperMetadata, bodyText: string): string {
  const authorsStr = meta.authors.length > 0 ? meta.authors.join(', ') : 'Unknown';
  const arxivUrl = meta.arxivId
    ? `https://arxiv.org/abs/${meta.arxivId}`
    : '';

  const lines: string[] = [];

  // ── タイトル（先頭：文書識別用） ──────────────────────────────
  lines.push(`# ${meta.title}`);
  lines.push('');

  // ── 日本語概要（日本語クエリとのマッチング最優先） ──────────
  if (meta.summaryJa) {
    lines.push('## 日本語概要');
    lines.push('');
    lines.push(meta.summaryJa);
    lines.push('');
  }

  // ── 英語 Abstract ─────────────────────────────────────────────
  if (meta.summary) {
    lines.push('## Abstract');
    lines.push('');
    lines.push(meta.summary);
    lines.push('');
  }

  // ── 本文 ──────────────────────────────────────────────────────
  if (bodyText) {
    lines.push('---');
    lines.push('');
    lines.push(bodyText);
    lines.push('');
  }

  // ── メタデータ（末尾：extractive_answers の誤抽出を防ぐ） ────
  lines.push('---');
  lines.push('');
  lines.push(`**Authors:** ${authorsStr}`);
  if (meta.publishedAt) lines.push(`**Published:** ${meta.publishedAt}`);
  if (meta.category)    lines.push(`**Category:** ${meta.category}`);
  if (arxivUrl)         lines.push(`**Source:** ${arxivUrl}`);

  return lines.join('\n');
}
