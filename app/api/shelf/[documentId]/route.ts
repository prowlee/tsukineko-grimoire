import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAndGetUser } from '@/lib/auth-helpers';

const READ_STATUSES = new Set(['unread', 'reading', 'done']);

/** メモ・読了状態・マイタグを更新（部分更新） */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  let userId: string;
  try {
    const user = await verifyAndGetUser(req);
    userId = user.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;
  if (!documentId) {
    return Response.json({ error: 'documentId が必要です' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.memo === 'string') {
    updates.memo = body.memo.slice(0, 2000);
  }
  if (typeof body.readStatus === 'string' && READ_STATUSES.has(body.readStatus)) {
    updates.readStatus = body.readStatus;
  }
  if (Array.isArray(body.userTags)) {
    updates.userTags = body.userTags
      .filter((t: unknown): t is string => typeof t === 'string')
      .map(t => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: '更新フィールドがありません' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection('shelves').doc(userId).collection('items').doc(documentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return Response.json({ error: '本棚に存在しません' }, { status: 404 });
  }

  await ref.update(updates);
  return Response.json({ message: 'updated' });
}

/** My Shelf から論文を削除 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  let userId: string;
  try {
    const user = await verifyAndGetUser(req);
    userId = user.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { documentId } = await params;
  if (!documentId) {
    return Response.json({ error: 'documentId が必要です' }, { status: 400 });
  }

  const db = getAdminFirestore();
  await db
    .collection('shelves').doc(userId)
    .collection('items').doc(documentId)
    .delete();

  return Response.json({ message: 'removed' });
}
