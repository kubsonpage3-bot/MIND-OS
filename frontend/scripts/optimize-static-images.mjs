/**
 * Regenerates the large static raster assets in public/ from the pristine copies in
 * frontend/_image_sources/static/.
 *
 * The sources are kept out of public/ on purpose: they are print-resolution files that
 * must never reach the bundle. Each entry below declares the size the asset is actually
 * rendered at, so the shipped file is sized for its job instead of its origin.
 *
 * Idempotent: it only rewrites an output when the source is newer or the output is gone.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '..');
const SRC = path.join(frontend, '_image_sources', 'static');
const PUB = path.join(frontend, 'public');

/**
 * width  — the largest CSS size the asset is drawn at, times a ~3x device pixel ratio.
 * format — 'jpeg' keeps existing URLs working; 'webp' is used where the reference was
 *          updated in the same change.
 */
const TARGETS = [
  // Rank-up banner: full-bleed hero, capped at max-h-[440px] on a 16/9 box.
  { from: 'ranks', to: 'ranks', width: 1376, format: 'jpeg', quality: 76 },
  // Stat icons: rendered inside a w-8 h-8 (32px) rounded tile in CharacterTab.
  { from: 'stats', to: 'images/stats', width: 128, format: 'jpeg', quality: 82 },
  // Boss victory header: h-28/h-32 strip across the modal.
  { from: 'misc', to: 'images', only: 'boss_victory_banner.jpg', width: 1024, format: 'jpeg', quality: 78 },
  // Login/Register page background.
  { from: 'misc', to: 'images', only: 'space_pixel_bg.png', rename: 'space_pixel_bg.webp', width: 1024, format: 'webp', quality: 72 },
  // Open Graph card — the size is fixed by the social platforms.
  { from: 'misc', to: '.', only: 'og-image.png', width: 1200, format: 'png' },
];

const isStale = (src, out) =>
  !fs.existsSync(out) || fs.statSync(src).mtimeMs > fs.statSync(out).mtimeMs;

async function run() {
  let written = 0;
  let savedBytes = 0;

  for (const target of TARGETS) {
    const srcDir = path.join(SRC, target.from);
    const outDir = path.join(PUB, target.to);
    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(outDir, { recursive: true });

    const files = target.only ? [target.only] : fs.readdirSync(srcDir);
    for (const file of files) {
      const src = path.join(srcDir, file);
      if (!fs.existsSync(src)) continue;

      const outName = target.rename || file;
      const out = path.join(outDir, outName);
      if (!isStale(src, out)) continue;

      const before = fs.existsSync(out) ? fs.statSync(out).size : fs.statSync(src).size;
      let pipeline = sharp(src).resize(target.width, null, { withoutEnlargement: true });

      if (target.format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: target.quality, mozjpeg: true, progressive: true });
      } else if (target.format === 'webp') {
        pipeline = pipeline.webp({ quality: target.quality });
      } else {
        // Pixel art quantises cleanly; a palette PNG keeps the format social scrapers expect.
        pipeline = pipeline.png({ palette: true, quality: 90, effort: 9 });
      }

      const buffer = await pipeline.toBuffer();
      fs.writeFileSync(out, buffer);
      written += 1;
      savedBytes += before - buffer.length;
      console.log(
        `${path.join(target.to, outName)}  ${(before / 1024).toFixed(0)}KB -> ${(buffer.length / 1024).toFixed(0)}KB`
      );
    }
  }

  console.log(
    written
      ? `optimize-static-images: ${written} file(s), saved ${(savedBytes / 1048576).toFixed(2)} MB`
      : 'optimize-static-images: everything already up to date'
  );
}

run().catch((err) => {
  console.error('optimize-static-images failed:', err);
  process.exitCode = 1;
});
