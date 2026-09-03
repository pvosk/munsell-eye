import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const images = JSON.parse(await fs.readFile(path.join(root, 'app/data/practice-images.json'), 'utf8'));
const outputDir = path.join(root, '.image-review');
await fs.mkdir(outputDir, { recursive: true });

for (let sheetIndex = 0; sheetIndex < Math.ceil(images.length / 30); sheetIndex++) {
  const sheet = images.slice(sheetIndex * 30, sheetIndex * 30 + 30);
  const tiles = await Promise.all(sheet.map(async (image, index) => {
    const response = await fetch(image.src);
    const buffer = Buffer.from(await response.arrayBuffer());
    const photo = await sharp(buffer).resize(160, 120, { fit: 'cover' }).jpeg().toBuffer();
    const label = Buffer.from(`<svg width="160" height="120"><rect x="0" y="96" width="40" height="24" fill="rgba(0,0,0,.75)"/><text x="7" y="113" fill="white" font-size="15" font-family="Arial">${sheetIndex * 30 + index}</text></svg>`);
    return sharp(photo).composite([{ input: label }]).jpeg().toBuffer();
  }));
  const canvas = sharp({ create: { width: 800, height: 720, channels: 3, background: '#deddd8' } });
  await canvas.composite(tiles.map((input, index) => ({ input, left: index % 5 * 160, top: Math.floor(index / 5) * 120 }))).jpeg({ quality: 88 }).toFile(path.join(outputDir, `sheet-${sheetIndex + 1}.jpg`));
}
console.log(`Rendered ${Math.ceil(images.length / 30)} review sheets.`);
