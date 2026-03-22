import { SearchServiceClient } from '@google-cloud/discoveryengine';
import { getAdminFirestore, FieldValue } from '@/lib/firebase-admin';
import { verifyAndGetUser } from '@/lib/auth-helpers';

function buildApiEndpoint(): string {
  const location = process.env.VERTEX_AI_LOCATION ?? 'global';
  return location === 'global'
    ? 'discoveryengine.googleapis.com'
    : `${location}-discoveryengine.googleapis.com`;
}

/**
 * ログインユーザーの pending ドキュメントを Vertex AI Search で確認し、
 * インデックス済みであれば Firestore の status を 'indexed' に更新する。
 * /archive ページからの自動ポーリング用。
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    const user = await verifyAndGetUser(req);
    userId = user.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminFirestore();

  // 自分のドキュメント + system ドキュメントの pending を取得（最大50件）
  const snapshot = await db
    .collection('documents')
    .where('userId', 'in', [userId, 'system'])
    .where('status', '==', 'pending')
    .limit(50)
    .get();

  if (snapshot.empty) {
    return Response.json({ checked: 0, updated: 0 });
  }

  const location = process.env.VERTEX_AI_LOCATION ?? 'global';
  const servingConfig = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${location}/collections/default_collection/engines/${process.env.VERTEX_AI_ENGINE_ID}/servingConfigs/default_config`;

  const client = new SearchServiceClient({ apiEndpoint: buildApiEndpoint() });

  let updatedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const searchTerm = data.title || data.filename || '';
    if (!searchTerm) continue;

    try {
      const [results] = await (client.search({
        servingConfig,
        query: searchTerm,
        pageSize: 1,
        filter: '',
      }, { autoPaginate: false }) as unknown as Promise<unknown[]>);

      const hits = results as Array<unknown>;
      if (hits && hits.length > 0) {
        await docSnap.ref.update({
          status: 'indexed',
          indexedAt: FieldValue.serverTimestamp(),
        });
        updatedCount++;
      }
    } catch {
      // 個別ドキュメントのチェック失敗はスキップ
    }

    // Vertex AI のレートリミット対策
    await new Promise(r => setTimeout(r, 200));
  }

  return Response.json({ checked: snapshot.size, updated: updatedCount });
}
