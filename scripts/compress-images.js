import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';

const IMAGES = [
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/788bddb7a_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/f72c50f73_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/bf85e7701_Screenshot2026-06-23224241.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/5ef3ff7af_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/c7192c4a7_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/a1200a724_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/e945b3bd4_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/eebb37437_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/e75cbe9d5_Screenshot2026-06-23213855.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/3c9b18011_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/21c3691e5_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/e40b7b940_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/d7eeb708b_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/6aa09434f_grafik.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/032923fd3_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/e233a83f3_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/0fafb424e_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/c5c7fecf4_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/c1bdfbb0c_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/f6d9c9d1e_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/993830219_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/918a77bad_Screenshot2026-06-23213620.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/82c35d837_generated_image.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/b8481b005_Screenshot2026-06-23224227.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/ef51b9462_Screenshot2026-06-23213830.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/218c86d0a_Screenshot2026-06-23213634.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/ef8a45965_Screenshot2026-06-23213700.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/5c7e4cb15_Screenshot2026-06-23224351.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/9babb5d8b_Screenshot2026-06-23224259.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/e46cf7897_Screenshot2026-06-23213548.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/4965fac9c_Screenshot2026-06-23213811.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/094797a95_Screenshot2026-06-23213805.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/6d76d3ff3_Screenshot2026-06-23224315.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/4d3be463a_allyes3.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/bbc84a335_allyes1.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/a05ba9764_allyes8.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/cb162ffce_pomodorp1.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/7958b621c_characters2.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/eb9d93154_characters4.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/940147528_allyes6.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/303411c1f_characters3.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/fa6645d8f_pomodorp2.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/03af8fc43_allyes7.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/b6ca653d8_allyes2.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/f5c789146_characters1.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/4794d3fbb_allyes4.jpg",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/5325ab6bf_pomodorp3.png",
  "https://media.base44.com/images/public/69b9b825affa4271ca0d1fd9/a0f17735e_allyes5.jpg"
];

const targetDir = 'public/images';
const originalDir = path.join(targetDir, 'original');
const webpDir = path.join(targetDir, 'webp');
const avifDir = path.join(targetDir, 'avif');

// Helper to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Get maximum display width for an image
function getTargetWidth(filename) {
  if (filename.includes('grafik')) return 800; // Rival graph
  if (filename.includes('Screenshot')) return 180; // Bosses (max width 90px * 2)
  if (filename.includes('allyes')) return 256; // Allies (max width 128px * 2)
  if (filename.includes('characters')) return 280; // Class sprites (max width 140px * 2)
  if (filename.includes('pomodor')) return 400; // Pomodoro timer background (max width 200px * 2)
  if (filename.includes('generated_image')) {
    // If it's a character sprite
    if (['993830219_generated_image.png', '82c35d837_generated_image.png', '032923fd3_generated_image.png', 'c1bdfbb0c_generated_image.png', 'f6d9c9d1e_generated_image.png', 'c5c7fecf4_generated_image.png'].includes(filename)) {
      return 280; // Sprites
    }
    return 600; // Background scenes (300px * 2)
  }
  return null; // Keep original resolution if no rule
}

async function processImage(filename) {
  const originalPath = path.join(originalDir, filename);
  const baseName = path.parse(filename).name;
  
  const webpPath = path.join(webpDir, `${baseName}.webp`);
  const avifPath = path.join(avifDir, `${baseName}.avif`);

  // Skip if both optimized versions already exist
  if (fs.existsSync(webpPath) && fs.existsSync(avifPath)) {
    return;
  }

  const targetWidth = getTargetWidth(filename);
  console.log(`Processing ${filename} -> WebP & AVIF (Width: ${targetWidth || 'original'})...`);

  try {
    let pipeline = sharp(originalPath);
    if (targetWidth) {
      pipeline = pipeline.resize(targetWidth, null, { withoutEnlargement: true });
    }

    // Output WebP
    await pipeline
      .clone()
      .webp({ quality: 80 })
      .toFile(webpPath);

    // Output AVIF
    await pipeline
      .clone()
      .avif({ quality: 70 })
      .toFile(avifPath);

  } catch (err) {
    console.error(`Error processing image ${filename}:`, err);
  }
}

async function main() {
  // Ensure directories exist
  [originalDir, webpDir, avifDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  console.log('Checking image assets...');
  
  // 1. Download missing original files
  for (const url of IMAGES) {
    const filename = url.substring(url.lastIndexOf('/') + 1);
    const baseName = path.parse(filename).name;
    const webpPath = path.join(webpDir, `${baseName}.webp`);
    const avifPath = path.join(avifDir, `${baseName}.avif`);

    // Skip downloading original if optimized versions already exist
    if (fs.existsSync(webpPath) && fs.existsSync(avifPath)) {
      continue;
    }

    const dest = path.join(originalDir, filename);
    if (!fs.existsSync(dest)) {
      console.log(`Downloading original ${filename} from CDN...`);
      try {
        await downloadFile(url, dest);
      } catch (err) {
        console.error(`Failed to download ${filename}:`, err);
      }
    }
  }

  // 2. Compress and resize downloaded files
  const files = fs.readdirSync(originalDir);
  for (const file of files) {
    await processImage(file);
  }

  console.log('Image compression completed!');
}

main().catch(console.error);
