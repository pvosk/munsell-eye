import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const envText = await fs.readFile(path.join(root, '.dev.vars'), 'utf8');
const accessKey = envText.match(/^UNSPLASH_ACCESS_KEY\s*=\s*['"]?([^'"\n]+)['"]?/m)?.[1]?.trim();
if (!accessKey) throw new Error('UNSPLASH_ACCESS_KEY is missing from .dev.vars');

const searches = [
  { query: 'close up human portrait natural light color', category: 'Close portrait', crop: 'faces' },
  { query: 'studio portrait person colorful', category: 'Studio portrait', crop: 'faces' },
  { query: 'candid street people colorful photography', category: 'Street figure', crop: 'faces,entropy' },
  { query: 'full body portrait urban colorful', category: 'Figure', crop: 'faces,entropy' },
  { query: 'fashion portrait natural light color', category: 'Figure portrait', crop: 'faces' },
  { query: 'artist studio portrait person color', category: 'Artist portrait', crop: 'faces' },
];

const rejectWords = /\b(insect|bee|bird|cat|dog|horse|spider|butterfly|moth|beetle|flower|building|landscape|food|car|statue|sculpture|illustration|drawing|black and white|monochrome|grayscale)\b/i;
// Removed after reviewing the generated contact sheets: these technically match
// the searches but leave too little human subject matter in the training crop.
const reviewRejectedIds = new Set([
  'V8dA0uakZKo', 'wOYSNIExqfo', 'gkte1_H7C-8', 'ojv8YuRv9YI', 'Kpas85EBNLU',
  'P3uML7higwc', 'SgOQQgRMIUA', '7PVyJxziXQQ', 'DkJtLRGwFGU', 'N-RpzpXTjVY',
  's209ZMk85Z8', 'MGp4Nf9msOM', 'zS7d25Uy7Rw', 't5K1rkR-6Rc', 'DHZX9CnXMfo',
  'WMLIzMkMh18', 'MhV9TWc5mZI', 'S6EGud2s9HI', 'dThq-v7AMQc', 'CLPjvNi2mZk',
]);

async function searchUnsplash(search, page = 1) {
  const params = new URLSearchParams({
    query: search.query,
    page: String(page),
    per_page: '30',
    content_filter: 'high',
    order_by: 'relevant',
  });
  const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
  });
  if (!response.ok) throw new Error(`Unsplash returned ${response.status} for ${search.query}`);
  return (await response.json()).results ?? [];
}

function imageUrl(raw, crop, width = 900, height = 680, quality = 78) {
  const url = new URL(raw);
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('crop', crop);
  url.searchParams.set('fm', 'jpg');
  url.searchParams.set('q', String(quality));
  url.searchParams.set('w', String(width));
  url.searchParams.set('h', String(height));
  return url.toString();
}

async function colorScore(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(buffer).resize({ width: 120, height: 90, fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let colorful = 0;
  let saturationSum = 0;
  let chromaSum = 0;
  let chromaSquared = 0;
  const pixels = info.width * info.height;
  for (let index = 0; index < data.length; index += info.channels) {
    const r = data[index] / 255;
    const g = data[index + 1] / 255;
    const b = data[index + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max ? (max - min) / max : 0;
    const chroma = max - min;
    saturationSum += saturation;
    chromaSum += chroma;
    chromaSquared += chroma * chroma;
    if (saturation > .16 && chroma > .08) colorful++;
  }
  const meanChroma = chromaSum / pixels;
  const chromaVariance = Math.max(0, chromaSquared / pixels - meanChroma * meanChroma);
  return {
    meanSaturation: saturationSum / pixels,
    colorfulFraction: colorful / pixels,
    chromaVariance,
  };
}

const rows = [];
for (const search of searches) {
  const results = await searchUnsplash(search);
  for (const photo of results) {
    if (!photo.id || reviewRejectedIds.has(photo.id) || !photo.urls?.raw || photo.width < 800 || photo.height < 600) continue;
    const text = [photo.alt_description, photo.description].filter(Boolean).join(' ');
    if (rejectWords.test(text)) continue;
    rows.push({ photo, search });
  }
}

const unique = [...new Map(rows.map((row) => [row.photo.id, row])).values()];
const accepted = [];
for (let index = 0; index < unique.length; index += 8) {
  const batch = unique.slice(index, index + 8);
  const scored = await Promise.all(batch.map(async ({ photo, search }) => {
    const preview = imageUrl(photo.urls.raw, search.crop, 280, 210, 54);
    const score = await colorScore(preview).catch(() => null);
    return { photo, search, score };
  }));
  for (const row of scored) {
    if (!row.score) continue;
    if (row.score.meanSaturation < .13 || row.score.colorfulFraction < .18 || row.score.chromaVariance < .002) continue;
    const landing = new URL(row.photo.links?.html || `https://unsplash.com/photos/${row.photo.id}`);
    landing.searchParams.set('utm_source', 'munsell_eye');
    landing.searchParams.set('utm_medium', 'referral');
    accepted.push({
      id: `unsplash:${row.photo.id}`,
      src: imageUrl(row.photo.urls.raw, row.search.crop),
      title: row.photo.alt_description?.trim() || row.photo.description?.trim() || row.search.category,
      category: row.search.category,
      credit: `Photo by ${row.photo.user?.name?.trim() || 'an Unsplash photographer'} on Unsplash`,
      source: landing.toString(),
      provider: 'unsplash',
      region: { x: 50, y: 50, w: row.search.crop === 'faces' ? 72 : 66, h: row.search.crop === 'faces' ? 82 : 78, name: 'subject' },
      colorScore: row.score,
    });
  }
}

accepted.sort((a, b) => (b.colorScore.colorfulFraction + b.colorScore.chromaVariance * 5) - (a.colorScore.colorfulFraction + a.colorScore.chromaVariance * 5));
const manifest = accepted.slice(0, 114).map(({ colorScore: _colorScore, ...image }) => image);
await fs.mkdir(path.join(root, 'app', 'data'), { recursive: true });
await fs.writeFile(path.join(root, 'app', 'data', 'practice-images.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Saved ${manifest.length} curated color portraits and figures.`);
