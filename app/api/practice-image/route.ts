type OpenverseDetail = { thumbnail?: string };

const isPublicImageUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === '::1') return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    return true;
  } catch {
    return false;
  }
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const provider = params.get('provider');
  const id = params.get('id') ?? '';
  if (provider !== 'openverse' || !/^[a-zA-Z0-9_-]{6,100}$/.test(id)) {
    return new Response('Invalid image', { status: 400 });
  }
  const detailResponse = await fetch(`https://api.openverse.org/v1/images/${encodeURIComponent(id)}/`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Munsell Eye/1.0 (color training app)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!detailResponse.ok) return new Response('Image unavailable', { status: 404 });
  const detail = await detailResponse.json() as OpenverseDetail;
  if (!detail.thumbnail || !isPublicImageUrl(detail.thumbnail)) return new Response('Image unavailable', { status: 404 });
  const imageResponse = await fetch(detail.thumbnail, {
    headers: { Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });
  const contentType = imageResponse.headers.get('content-type') ?? '';
  if (!imageResponse.ok || !contentType.startsWith('image/') || !imageResponse.body) {
    return new Response('Image unavailable', { status: 404 });
  }
  return new Response(imageResponse.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=2592000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
