// Optimised copies of every photo listed in data/photos.json -> img/
// Originals are only read, never modified or deleted.
//   img/ironart-<slug_en>.webp         max 1600px on the long side (never upscaled)
//   img/ironart-<slug_en>.jpg          JPG fallback, same size
//   img/ironart-<slug_en>-thumb.webp   ~600px wide
//   img/ironart-<slug_en>-thumb.jpg    JPG fallback of the thumbnail
// Also writes data/image-meta.json (pixel sizes) used for width/height attributes.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'img');
const MAX = 1600;
const THUMB_W = 600;

async function main() {
  const photos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photos.json'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  let made = 0;
  for (const p of photos) {
    const src = path.join(ROOT, p.file);
    if (!fs.existsSync(src)) throw new Error('Missing source photo: ' + p.file);
    const base = 'ironart-' + p.slug_en;
    const targets = {
      full_webp: path.join(OUT, base + '.webp'),
      full_jpg: path.join(OUT, base + '.jpg'),
      thumb_webp: path.join(OUT, base + '-thumb.webp'),
      thumb_jpg: path.join(OUT, base + '-thumb.jpg'),
    };
    const srcTime = fs.statSync(src).mtimeMs;
    const fresh = Object.values(targets).every(t => fs.existsSync(t) && fs.statSync(t).mtimeMs >= srcTime);
    if (!fresh) {
      const img = () => sharp(src).rotate(); // honour EXIF orientation
      const full = () => img().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true });
      const thumb = () => img().resize({ width: THUMB_W, withoutEnlargement: true });
      await Promise.all([
        full().webp({ quality: 82 }).toFile(targets.full_webp),
        full().jpeg({ quality: 85, progressive: true, mozjpeg: true }).toFile(targets.full_jpg),
        thumb().webp({ quality: 80 }).toFile(targets.thumb_webp),
        thumb().jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(targets.thumb_jpg),
      ]);
      made++;
    }
    const f = await sharp(targets.full_webp).metadata();
    const t = await sharp(targets.thumb_webp).metadata();
    meta[p.slug_en] = { w: f.width, h: f.height, tw: t.width, th: t.height };
  }
  fs.writeFileSync(path.join(ROOT, 'data/image-meta.json'), JSON.stringify(meta, null, 1) + '\n');
  console.log(`images: ${photos.length} photos, ${made} (re)generated`);
}
main().catch(e => { console.error(e); process.exit(1); });
