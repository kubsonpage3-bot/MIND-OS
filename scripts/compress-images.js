import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const targetDir = 'public/images';
const originalDir = path.join(targetDir, 'original');
const webpDir = path.join(targetDir, 'webp');
const avifDir = path.join(targetDir, 'avif');

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
  
  // Compress and resize local files
  if (fs.existsSync(originalDir)) {
    const files = fs.readdirSync(originalDir);
    for (const file of files) {
      // Only process image files (skip hidden system files or directories)
      if (file.match(/\.(png|jpg|jpeg|webp)$/i)) {
        await processImage(file);
      }
    }
  }

  console.log('Image compression completed!');
}

main().catch(console.error);
