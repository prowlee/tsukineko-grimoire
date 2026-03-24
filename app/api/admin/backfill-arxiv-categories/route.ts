import type { Firestore } from 'firebase-admin/firestore';
import { XMLParser } from 'fast-xml-parser';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { parseArxivCategories } from '@/lib/arxiv-categories';

const USER_AGENT = 'Tsukineko-Grimoire/1.0 (admin backfill; contact via GitHub)';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') ?? '';
  const query = new URL(req.url).searchParams.get('secret') ?? '';
  return auth === `Bearer ${secret}` || query === secret;
}

function normalizeArxivId(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/v\d+$/i, '');
}

async function fetchCategoryTagsFromArxiv(
  arxivId: string
): Promise<{ category: string; tags: string[] } | null> {
  const id = normalizeArxivId(arxivId);
  if (!id) return null;

  const res = await fetch(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`,
    {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) return null;

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const data = parser.parse(xml);

  const rawEntry = data?.feed?.entry;
  if (!rawEntry) return null;

  const entry = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry;
  return parseArxivCategories(entry.category);
}

function docNeedsBackfill(
  data: Record<string, unknown>,
  mode: 'missing' | 'all'
): boolean {
  const arxivId = normalizeArxivId(data.arxivId);
  if (!arxivId) return false;
  if (mode === 'all') return true;
  const cat = String(data.category ?? '').trim();
  const tags = Array.isArray(data.tags) ? data.tags : [];
  return !cat || tags.length === 0;
}

async function syncShelfCopies(
  db: Firestore,
  documentId: string,
  category: string,
  tags: string[]
): Promise<number> {
  const shelvesSnap = await db.collection('shelves').get();
  let touched = 0;
  for (const shelfDoc of shelvesSnap.docs) {
    const itemRef = shelfDoc.ref.collection('items').doc(documentId);
    const itemSnap = await itemRef.get();
    if (itemSnap.exists) {
      await itemRef.update({ category, tags });
      touched++;
    }
  }
  return touched;
}

/**
 * 既存 documents の category / tags を arXiv Atom から補完（CRON_SECRET 必須）
 *
 * body:
 * - batchLimit: 1 リクエストあたりの最大件数（既定 10）
 * - delayMs: arXiv 呼び出し間隔 ms（既定 3000）
 * - mode: "missing" | "all"（既定 missing = category 空 or tags 空の arXiv 論文のみ）
 * - mergeTags: true のとき既存 tags と arXiv 由来を重複なくマージ（既定 true）
 * - dryRun: true なら Firestore は更新しない
 * - syncShelf: true なら shelves/{uid}/items/{documentId} の category/tags も同じ値で更新
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    batchLimit?: number;
    delayMs?: number;
    mode?: 'missing' | 'all';
    mergeTags?: boolean;
    dryRun?: boolean;
    syncShelf?: boolean;
  };

  const batchLimit = Math.min(Math.max(body.batchLimit ?? 10, 1), 50);
  const delayMs = Math.max(body.delayMs ?? 3000, 0);
  const mode = body.mode === 'all' ? 'all' : 'missing';
  const mergeTags = body.mergeTags !== false;
  const dryRun = body.dryRun === true;
  const syncShelf = body.syncShelf === true;

  const db = getAdminFirestore();
  const snapshot = await db.collection('documents').limit(2000).get();

  const initialNeeding = snapshot.docs.filter(d =>
    docNeedsBackfill(d.data() as Record<string, unknown>, mode)
  ).length;

  const targets = snapshot.docs
    .filter(doc => docNeedsBackfill(doc.data() as Record<string, unknown>, mode))
    .slice(0, batchLimit);

  let updated = 0;
  let skipped = 0;
  let shelfItemsTouched = 0;
  const errors: string[] = [];

  for (let i = 0; i < targets.length; i++) {
    const doc = targets[i]!;
    const data = doc.data() as Record<string, unknown>;
    const arxivId = normalizeArxivId(data.arxivId);

    try {
      const parsed = await fetchCategoryTagsFromArxiv(arxivId);
      if (!parsed || !parsed.category) {
        skipped++;
        errors.push(`${doc.id}: arXiv メタ取得失敗または category なし`);
        if (i < targets.length - 1 && delayMs > 0) {
          await new Promise(r => setTimeout(r, delayMs));
        }
        continue;
      }

      let tags = parsed.tags;
      if (mergeTags) {
        const existing = Array.isArray(data.tags) ? data.tags.map(String) : [];
        tags = Array.from(new Set([...existing, ...parsed.tags])).filter(Boolean);
      }

      const category = parsed.category;

      if (!dryRun) {
        await doc.ref.update({ category, tags });
        if (syncShelf) {
          shelfItemsTouched += await syncShelfCopies(db, doc.id, category, tags);
        }
      }
      updated++;
    } catch (err) {
      errors.push(`${doc.id}: ${(err as Error).message?.slice(0, 80) ?? 'error'}`);
    }

    if (i < targets.length - 1 && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const remainingApprox = dryRun
    ? initialNeeding
    : Math.max(0, initialNeeding - updated);

  return Response.json({
    mode,
    mergeTags,
    dryRun,
    syncShelf,
    updated,
    skipped,
    shelfItemsTouched,
    errors,
    batchSize: targets.length,
    needingBeforeBatch: initialNeeding,
    remainingApprox,
  });
}

export const GET = POST;
