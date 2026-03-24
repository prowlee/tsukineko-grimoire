/**
 * arXiv Atom の <category term="…" /> を fast-xml-parser の結果から解釈する。
 * collector / ingest / arxiv-preview で共通利用（二重実装を避ける）。
 */

export interface ParseArxivCategoriesOptions {
  /**
   * true（既定）のとき、主カテゴリのドメイン接頭辞を tags に1つ追加する。
   * 例: cs.AI → tags に "cs"（まだ無い場合のみ）
   */
  addBroadPrefix?: boolean;
}

/** fast-xml-parser が返す entry.category（単一 or 配列）から term を出現順・重複なしで収集 */
export function collectArxivCategoryTerms(categoryRaw: unknown): string[] {
  if (categoryRaw == null) return [];
  const arr = Array.isArray(categoryRaw) ? categoryRaw : [categoryRaw];
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const c of arr) {
    if (c == null || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const t = String(o['@_term'] ?? o['#text'] ?? '').trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      terms.push(t);
    }
  }
  return terms;
}

/**
 * 主カテゴリ（先頭の term）と補助タグ（2番目以降の term ＋任意で大分野プレフィックス）に分割。
 */
export function parseArxivCategories(
  categoryRaw: unknown,
  options?: ParseArxivCategoriesOptions
): { category: string; tags: string[] } {
  const addBroadPrefix = options?.addBroadPrefix !== false;
  const terms = collectArxivCategoryTerms(categoryRaw);
  if (terms.length === 0) return { category: '', tags: [] };

  const category = terms[0];
  const tags = [...terms.slice(1)];

  if (addBroadPrefix && category.includes('.')) {
    const prefix = category.split('.')[0]?.trim() ?? '';
    if (prefix && prefix !== category && !tags.includes(prefix)) {
      tags.push(prefix);
    }
  }

  return { category, tags };
}
