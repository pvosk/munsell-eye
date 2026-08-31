import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makeIcon(size, path) {
  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);
  const background = [238, 237, 232, 255];
  const radius = size * 0.29;
  const center = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * row + 1 + x * 4;
      const inside = (x - center) ** 2 + (y - center) ** 2 <= radius ** 2;
      const pixel = inside ? (x < center ? [29, 29, 27, 255] : [248, 247, 243, 255]) : background;
      raw[offset] = pixel[0]; raw[offset + 1] = pixel[1]; raw[offset + 2] = pixel[2]; raw[offset + 3] = pixel[3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

makeIcon(192, new URL('../public/icon-192.png', import.meta.url));
makeIcon(512, new URL('../public/icon-512.png', import.meta.url));
