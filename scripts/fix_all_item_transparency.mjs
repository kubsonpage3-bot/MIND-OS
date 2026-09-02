import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const FRONTEND_DIR = 'c:/coder/mindos/frontend/public/static/items';
const BACKEND_DIR = 'c:/coder/mindos/backend/static/items';
const DIST_DIR = 'c:/coder/mindos/frontend/dist/static/items';
const RAW_DIR = 'c:/coder/mindos/_raw_assets';

function saveBuffers(webpBuffer, filename) {
  const targets = [
    path.join(FRONTEND_DIR, filename),
    path.join(BACKEND_DIR, filename),
  ];
  if (fs.existsSync(DIST_DIR)) {
    targets.push(path.join(DIST_DIR, filename));
  }

  for (const t of targets) {
    fs.writeFileSync(t, webpBuffer);
  }
  console.log(`[SAVED] ${filename} -> frontend & backend`);
}

async function processCheckerboardItems() {
  console.log('\n--- 1. Processing Checkerboard Items from Clean Raw Assets ---');
  const items = [
    { name: 'ironbloom_plate', raw: 'ironbloom_plate.png' },
    { name: 'laced_cortex', raw: 'laced_cortex.png' },
    { name: 'strider_frame', raw: 'strider_frame.png' },
    { name: 'veil_of_dusk', raw: 'veil_of_dusk.png' },
  ];

  for (const { name, raw } of items) {
    const rawPath = path.join(RAW_DIR, raw);
    const { data, info } = await sharp(fs.readFileSync(rawPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;

    // Clean all solid black background pixels
    let cleared = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] <= 25 && data[i + 1] <= 25 && data[i + 2] <= 25) {
        data[i + 3] = 0;
        cleared++;
      }
    }

    console.log(`${name}: cleared ${cleared} / ${w * h} (${(cleared / (w * h) * 100).toFixed(1)}%)`);

    const webpBuffer = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .resize(64, 64, { kernel: sharp.kernel.nearest })
      .webp({ lossless: true })
      .toBuffer();

    saveBuffers(webpBuffer, `${name}.webp`);
  }
}

async function processStillWaterRing() {
  console.log('\n--- 2. Processing Still Water Ring ---');
  const rawPath = path.join(RAW_DIR, 'still_water_ring_1784142576671.png');
  const { data, info } = await sharp(fs.readFileSync(rawPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] <= 30 && data[i + 1] <= 30 && data[i + 2] <= 30) {
      data[i + 3] = 0;
      cleared++;
    }
  }
  console.log(`still_water_ring: cleared ${cleared} / ${w * h} (${(cleared / (w * h) * 100).toFixed(1)}%)`);

  const webpBuffer = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .resize(64, 64, { kernel: sharp.kernel.nearest })
    .webp({ lossless: true })
    .toBuffer();

  saveBuffers(webpBuffer, 'still_water_ring.webp');
}

async function processSolidSSSItems() {
  console.log('\n--- 3. Processing Solid Background SSS Items ---');
  const sssItems = [
    'celestial_seal_sss',
    'godcore_sss',
    'infinity_sigil_sss',
    'lightspeed_sss',
    'ouroboros_sss',
    'paradox_step_sss',
    'void_fist_sss',
  ];

  for (const id of sssItems) {
    const srcPath = path.join(FRONTEND_DIR, `${id}.webp`);
    const { data, info } = await sharp(fs.readFileSync(srcPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;

    const visited = new Uint8Array(w * h);
    const queue = [];
    for (let x = 0; x < w; x++) {
      queue.push([x, 0], [x, h - 1]);
      visited[x] = 1;
      visited[(h - 1) * w + x] = 1;
    }
    for (let y = 0; y < h; y++) {
      queue.push([0, y], [w - 1, y]);
      visited[y * w] = 1;
      visited[y * w + w - 1] = 1;
    }

    let cleared = 0;
    let head = 0;
    while (head < queue.length) {
      const [x, y] = queue[head++];
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Dark background gradient condition
      if (r <= 65 && g <= 65 && b <= 85) {
        data[idx + 3] = 0;
        cleared++;

        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    console.log(`${id}: cleared ${cleared} / ${w * h} (${(cleared / (w * h) * 100).toFixed(1)}%)`);

    const webpBuffer = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .resize(64, 64, { kernel: sharp.kernel.nearest })
      .webp({ lossless: true })
      .toBuffer();

    saveBuffers(webpBuffer, `${id}.webp`);
  }
}

async function main() {
  await processCheckerboardItems();
  await processStillWaterRing();
  await processSolidSSSItems();
  console.log('\n✅ ALL 12 PROBLEMATIC ITEM IMAGES FIXED WITH TRUE ALPHA TRANSPARENCY!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
