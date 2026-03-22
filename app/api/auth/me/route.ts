import { verifyAndGetUser } from '@/lib/auth-helpers';

/** セッション Cookie からログイン中のユーザー情報を返す */
export async function GET(req: Request) {
  try {
    const user = await verifyAndGetUser(req);
    return Response.json({ uid: user.uid, email: user.email });
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
