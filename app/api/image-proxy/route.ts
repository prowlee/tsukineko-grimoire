/**
 * /api/image-proxy?url=<encoded_url>
 *
 * arXiv の画像を Server Side で取得してブラウザに返すプロキシ。
 * ブラウザから直接 arXiv に画像リクエストを送るとホットリンクブロックや
 * CORS 問題が起きるため、このプロキシ経由でロードする。
 */

export const dynamic = 'force-dynamic';

const ALLOWED_ORIGINS = ['arxiv.org'];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');

  if (!rawUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new Response('Invalid url parameter', { status: 400 });
  }

  // 許可済みオリジンのみ（arXiv のみ）
  const isAllowed = ALLOWED_ORIGINS.some(origin => targetUrl.hostname.endsWith(origin));
  if (!isAllowed) {
    return new Response('Forbidden origin', { status: 403 });
  }

  try {
    const res = await fetch(targetUrl.href, {
      headers: {
        'User-Agent': 'TsukinekoGrimoire/1.0 (research tool)',
        'Referer': 'https://arxiv.org/',
        'Accept': 'image/svg+xml,image/png,image/webp,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[image-proxy] failed: ${targetUrl.href} (HTTP ${res.status})`);
      return new Response('Image not found', { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.warn(`[image-proxy] fetch error: ${targetUrl.href}`, (err as Error).message?.slice(0, 80));
    return new Response('Proxy fetch failed', { status: 502 });
  }
}
