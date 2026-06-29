import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const RAW_DIR = 'c:/coder/mind-os-growth/_raw_assets';
const OUT_DIR = 'c:/coder/mind-os-growth/backend/static/items';

// Known mutators
const MUTATORS = [
  "bloodwork", "monks_path", "iron_routine", "lexicon", "night_owl",
  "early_riser", "tunnel_vision", "loan_shark", "compound", "miser",
  "tithe", "ascetic_loop", "double_nothing", "momentum", "diversity_lock",
  "silence", "ironman", "glass_cannon", "zero_hour", "catalyst",
  "echo", "mirror", "resonance", "gambler", "phantom_load",
  "cursed_clock", "deja_vu", "volatile", "weight_of_history"
];

const COLORS = [
  "#e11d48", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2"
];

async function generatePlaceholder(name) {
  const color = COLORS[Math.abs(name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % COLORS.length];
  const initial = name.charAt(0).toUpperCase();

  const svg = `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="${color}" fill-opacity="0.8" stroke="white" stroke-width="2"/>
      <text x="32" y="44" font-family="monospace" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .webp({ lossless: true })
    .toBuffer();
}

async function processImage(filepath) {
  try {
    // Sharp can trim background with a tolerance
    const image = sharp(filepath);
    const metadata = await image.metadata();

    const trimmed = await image
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 15 })
      .toBuffer();

    // Now we pad it to square and resize
    const trimmedMeta = await sharp(trimmed).metadata();
    const maxDim = Math.max(trimmedMeta.width, trimmedMeta.height);

    const squared = await sharp({
      create: {
        width: maxDim,
        height: maxDim,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: trimmed, gravity: 'center' }])
      .png()
      .toBuffer();

    // Resize to 64x64 using nearest neighbor
    const finalBuffer = await sharp(squared)
      .resize(64, 64, {
        kernel: sharp.kernel.nearest,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ lossless: true })
      .toBuffer();

    return finalBuffer;
  } catch (error) {
    console.error(`Error processing image ${filepath}:`, error);
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  console.log(`Found ${files.length} images to process in _raw_assets.`);

  const processedNames = new Set();

  for (const file of files) {
    const filepath = path.join(RAW_DIR, file);
    
    let cleanName = file.replace(/\.(png|jpg)$/, '');
    const parts = cleanName.split('_');
    if (parts.length > 1 && /^\d{10,}$/.test(parts[parts.length - 1])) {
      parts.pop();
      cleanName = parts.join('_');
    }

    const outName = `${cleanName}.webp`;
    const outPath = path.join(OUT_DIR, outName);

    try {
      const buffer = await processImage(filepath);
      fs.writeFileSync(outPath, buffer);
      console.log(`Processed: ${cleanName} -> ${outPath}`);
      processedNames.add(cleanName);
    } catch (e) {
      console.error(`Failed to process ${file}`);
    }
  }

  // Generate placeholders for missing mutators
  console.log('Generating missing mutators placeholders...');
  for (const mutator of MUTATORS) {
    if (!processedNames.has(mutator)) {
      const outPath = path.join(OUT_DIR, `${mutator}.webp`);
      if (!fs.existsSync(outPath)) {
        try {
          const buffer = await generatePlaceholder(mutator);
          fs.writeFileSync(outPath, buffer);
          console.log(`Generated placeholder: ${mutator}.webp`);
        } catch (e) {
          console.error(`Failed to generate placeholder for ${mutator}`);
        }
      }
    }
  }

  console.log('Optimization complete!');
}

main().catch(console.error);
