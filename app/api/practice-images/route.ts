import { env } from 'cloudflare:workers';

type PracticeImage = {
  id: string;
  src: string;
  title: string;
  category: string;
  credit: string;
  source: string;
  provider: 'openverse' | 'unsplash';
};

type OpenverseResult = {
  id?: string;
  title?: string;
  creator?: string;
  creator_url?: string;
  foreign_landing_url?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  license?: string;
  license_version?: string;
  mature?: boolean;
};

type UnsplashResult = {
  id?: string;
  alt_description?: string;
  description?: string;
  width?: number;
  height?: number;
  urls?: { raw?: string };
  links?: { html?: string };
  user?: { name?: string; username?: string; links?: { html?: string } };
};

const SEARCHES = [
  { query: 'close up portrait', category: 'Close portrait', openverseCategory: 'photograph', unsplashQuery: 'close up face portrait natural light' },
  { query: 'studio portrait', category: 'Studio portrait', openverseCategory: 'photograph', unsplashQuery: 'studio portrait close up person' },
  { query: 'street portrait', category: 'Street portrait', openverseCategory: 'photograph', unsplashQuery: 'candid street portrait face' },
  { query: 'figure painting portrait', category: 'Master painting', openverseCategory: 'digitized_artwork', unsplashQuery: null },
  { query: 'natural light portrait person', category: 'Natural portrait', openverseCategory: 'photograph', unsplashQuery: 'natural light portrait person face' },
  { query: 'artist portrait', category: 'Artist portrait', openverseCategory: 'photograph', unsplashQuery: 'artist studio close up portrait' },
] as const;

const clampBatch = (value: string | null) => Math.min(17, Math.max(0, Number.parseInt(value ?? '0', 10) || 0));

const usefulDimensions = (width?: number, height?: number) => {
  if (!width || !height || width < 640 || height < 480) return false;
  const ratio = width / height;
  return ratio >= 0.55 && ratio <= 2.1;
};

async function fetchOpenverse(search: (typeof SEARCHES)[number], page: number): Promise<PracticeImage[]> {
  const params = new URLSearchParams({
    q: search.query,
    page: String(page),
    page_size: '20',
    category: search.openverseCategory,
    license_type: 'commercial,modification',
    mature: 'false',
    size: 'large',
  });
  const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Munsell Eye/1.0 (color training app)' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Openverse returned ${response.status}`);
  const payload = await response.json() as { results?: OpenverseResult[] };
  return (payload.results ?? [])
    .filter((image) => image.id && image.thumbnail && !image.mature && usefulDimensions(image.width, image.height))
    .map((image) => {
      const license = [image.license?.toUpperCase(), image.license_version].filter(Boolean).join(' ');
      return {
        id: `openverse:${image.id}`,
        src: `/api/practice-image?provider=openverse&id=${encodeURIComponent(image.id!)}`,
        title: image.title?.trim() || search.category,
        category: search.category,
        credit: `${image.creator?.trim() || 'Unknown creator'} · ${license || 'Open license'}`,
        source: image.foreign_landing_url || image.creator_url || 'https://openverse.org/',
        provider: 'openverse' as const,
      };
    });
}

async function fetchUnsplash(search: (typeof SEARCHES)[number], page: number, accessKey: string): Promise<PracticeImage[]> {
  if (!search.unsplashQuery) return [];
  const params = new URLSearchParams({
    query: search.unsplashQuery,
    page: String(page),
    per_page: '30',
    content_filter: 'high',
    order_by: 'relevant',
  });
  const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Accept: 'application/json', Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Unsplash returned ${response.status}`);
  const payload = await response.json() as { results?: UnsplashResult[] };
  return (payload.results ?? [])
    .filter((image) => image.id && image.urls?.raw && usefulDimensions(image.width, image.height))
    .map((image) => {
      const source = new URL(image.urls!.raw!);
      source.searchParams.set('auto', 'format');
      source.searchParams.set('fit', 'max');
      source.searchParams.set('fm', 'jpg');
      source.searchParams.set('q', '76');
      source.searchParams.set('w', '820');
      const landingPage = image.links?.html || image.user?.links?.html || (image.user?.username ? `https://unsplash.com/@${image.user.username}` : 'https://unsplash.com/');
      const landingUrl = new URL(landingPage);
      landingUrl.searchParams.set('utm_source', 'munsell_eye');
      landingUrl.searchParams.set('utm_medium', 'referral');
      return {
        id: `unsplash:${image.id}`,
        src: source.toString(),
        title: image.alt_description?.trim() || image.description?.trim() || search.category,
        category: search.category,
        credit: `Photo by ${image.user?.name?.trim() || 'an Unsplash photographer'} on Unsplash`,
        source: landingUrl.toString(),
        provider: 'unsplash' as const,
      };
    });
}

export async function GET(request: Request) {
  const batch = clampBatch(new URL(request.url).searchParams.get('batch'));
  const search = SEARCHES[batch % SEARCHES.length];
  const page = Math.floor(batch / SEARCHES.length) + 1;
  const accessKey = (env as { UNSPLASH_ACCESS_KEY?: string }).UNSPLASH_ACCESS_KEY?.trim();
  const [openverse, unsplash] = await Promise.allSettled([
    fetchOpenverse(search, page),
    accessKey ? fetchUnsplash(search, page, accessKey) : Promise.resolve([]),
  ]);
  const images = [
    ...(openverse.status === 'fulfilled' ? openverse.value : []),
    ...(unsplash.status === 'fulfilled' ? unsplash.value : []),
  ];
  if (openverse.status === 'rejected') {
    console.warn('Openverse image search failed:', openverse.reason instanceof Error ? openverse.reason.message : 'Unknown error');
  }
  if (unsplash.status === 'rejected') {
    console.warn('Unsplash image search failed:', unsplash.reason instanceof Error ? unsplash.reason.message : 'Unknown error');
  }
  return Response.json({
    images,
    providers: {
      openverse: openverse.status === 'fulfilled',
      unsplash: Boolean(accessKey) && unsplash.status === 'fulfilled',
    },
  }, {
    headers: { 'Cache-Control': 'public, max-age=900, s-maxage=21600, stale-while-revalidate=86400' },
  });
}
