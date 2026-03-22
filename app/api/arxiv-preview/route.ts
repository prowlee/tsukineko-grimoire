import { XMLParser } from 'fast-xml-parser';

const USER_AGENT = 'Tsukineko-Grimoire/1.0 (arXiv preview; contact via GitHub)';

export interface ArxivPreview {
  arxivId: string;
  title: string;
  authors: string[];
  summary: string;
  category: string;
  publishedAt: string;
}

/** arXiv API からメタデータを取得して返す（登録はしない） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')?.trim().replace(/v\d+$/, '');

  if (!id) {
    return Response.json({ error: 'arXiv ID が必要です' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?id_list=${id}&max_results=1`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      return Response.json({ error: 'arXiv API エラー' }, { status: 502 });
    }

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const data = parser.parse(xml);

    const rawEntry = data?.feed?.entry;
    if (!rawEntry) {
      return Response.json({ error: '論文が見つかりませんでした' }, { status: 404 });
    }

    const entry = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry;

    const title = String(entry.title ?? '').trim().replace(/\s+/g, ' ');
    const summary = String(entry.summary ?? '').trim().replace(/\s+/g, ' ');
    const publishedAt = String(entry.published ?? '').slice(0, 10);

    const authorsRaw = entry.author;
    const authors: string[] = Array.isArray(authorsRaw)
      ? authorsRaw.map((a: { name: string }) => a.name).slice(0, 5)
      : authorsRaw?.name ? [authorsRaw.name] : [];

    const categoryRaw = entry.category;
    const firstCat = Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw;
    const category = firstCat?.['@_term'] ?? firstCat?.['#text'] ?? '';

    const preview: ArxivPreview = { arxivId: id, title, authors, summary, category, publishedAt };
    return Response.json(preview);
  } catch {
    return Response.json({ error: 'ネットワークエラーが発生しました' }, { status: 500 });
  }
}
