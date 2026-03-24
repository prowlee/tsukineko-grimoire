import { getAdminFirestore, FieldValue } from '@/lib/firebase-admin';
import { verifyAndGetUser } from '@/lib/auth-helpers';

/** My Shelf 一覧取得 */
export async function GET(req: Request) {
  let userId: string;
  try {
    const user = await verifyAndGetUser(req);
    userId = user.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminFirestore();
  const snapshot = await db
    .collection('shelves')
    .doc(userId)
    .collection('items')
    .orderBy('addedAt', 'desc')
    .limit(200)
    .get();

  const items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    addedAt: doc.data().addedAt?.toDate?.()?.toISOString() ?? null,
  }));

  return Response.json({ items });
}

/** My Shelf に論文を追加
 *  body: { documentId } または { arxivId } のどちらでも受け付ける。
 *  arxivId が指定された場合は documents コレクションから documentId を解決する。
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    const user = await verifyAndGetUser(req);
    userId = user.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const db = getAdminFirestore();

  // arxivId から documentId を解決
  let documentId: string = body.documentId ?? '';
  if (!documentId && body.arxivId) {
    const snap = await db.collection('documents')
      .where('arxivId', '==', body.arxivId)
      .limit(1)
      .get();
    if (snap.empty) {
      return Response.json({ error: 'この論文はまだ書庫に登録されていません' }, { status: 404 });
    }
    documentId = snap.docs[0].id;
  }

  if (!documentId) {
    return Response.json({ error: 'documentId または arxivId が必要です' }, { status: 400 });
  }

  // 既に登録済みチェック
  const existing = await db
    .collection('shelves').doc(userId)
    .collection('items').doc(documentId)
    .get();
  if (existing.exists) {
    return Response.json({ message: 'already_shelved' }, { status: 200 });
  }

  // documents コレクションからメタデータを取得して一緒に保存（非正規化）
  const docSnap = await db.collection('documents').doc(documentId).get();
  if (!docSnap.exists) {
    return Response.json({ error: '論文が見つかりません' }, { status: 404 });
  }
  const d = docSnap.data()!;

  await db
    .collection('shelves').doc(userId)
    .collection('items').doc(documentId)
    .set({
      documentId,
      addedAt: FieldValue.serverTimestamp(),
      title:      d.title      ?? '',
      titleJa:    d.titleJa    ?? '',
      authors:    d.authors    ?? [],
      arxivId:    d.arxivId    ?? '',
      category:   d.category   ?? '',
      publishedAt: d.publishedAt ?? '',
      summaryJa:  d.summaryJa  ?? '',
      summary:    d.summary    ?? '',
      tags:       d.tags       ?? [],
      theme:      d.theme      ?? '',
      memo:       '',
      readStatus: 'unread',
      userTags:   [],
    });

  return Response.json({ message: 'added' });
}
