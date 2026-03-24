import { getAdminFirestore } from '@/lib/firebase-admin';
import { classifyTheme } from '@/lib/classify-theme';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') ?? '';
  const query = new URL(req.url).searchParams.get('secret') ?? '';
  return auth === `Bearer ${secret}` || query === secret;
}

/**
 * 既存 documents の theme を title + summary + tags から補完（CRON_SECRET 必須）
 *
 * body:
 * - batchLimit: 最大件数（既定 100）
 * - mode: "missing" | "all"（既定 missing = theme が未設定のものだけ）
 * - dryRun: true なら Firestore は更新しない
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    batchLimit?: number;
    mode?: 'missing' | 'all';
    dryRun?: boolean;
  };

  const batchLimit = Math.min(Math.max(body.batchLimit ?? 100, 1), 500);
  const mode = body.mode === 'all' ? 'all' : 'missing';
  const dryRun = body.dryRun === true;

  const db = getAdminFirestore();
  const snapshot = await db.collection('documents').limit(3000).get();

  const targets = snapshot.docs
    .filter(doc => {
      const d = doc.data() as Record<string, unknown>;
      if (mode === 'all') return true;
      const theme = String(d.theme ?? '').trim();
      return !theme;
    })
    .slice(0, batchLimit);

  let updated = 0;
  let skipped = 0;
  const byTheme: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, '': 0 };
  const errors: string[] = [];

  for (const doc of targets) {
    const d = doc.data() as Record<string, unknown>;
    const title = String(d.title ?? '');
    const summary = String(d.summary ?? '');
    const tags = Array.isArray(d.tags) ? d.tags.map(String) : [];

    try {
      const theme = classifyTheme(title, summary, tags);
      byTheme[theme] = (byTheme[theme] ?? 0) + 1;

      if (!dryRun) {
        await doc.ref.update({ theme });
      }
      updated++;
    } catch (err) {
      skipped++;
      errors.push(`${doc.id}: ${(err as Error).message?.slice(0, 80) ?? 'error'}`);
    }
  }

  const stillMissing = snapshot.docs.filter(d => {
    const theme = String((d.data() as Record<string, unknown>).theme ?? '').trim();
    return !theme;
  }).length;

  return Response.json({
    mode,
    dryRun,
    updated,
    skipped,
    byTheme,
    batchSize: targets.length,
    needingBeforeBatch: snapshot.docs.filter(d => !String((d.data() as Record<string, unknown>).theme ?? '').trim()).length,
    remainingApprox: dryRun ? stillMissing : Math.max(0, stillMissing - updated),
    errors,
  });
}

export const GET = POST;
