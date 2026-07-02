import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const artifactDir = 'C:\\Users\\kubso\\.gemini\\antigravity-ide\\brain\\41282a9e-2b65-467c-ac94-3aaf58f573e2';
const destDir = 'c:\\coder\\mind-os-growth\\frontend\\public\\images\\webp';

const filesToProcess = [
  { source: 'blonde_knight_1783018321807.png', dest: 'f5c789146_characters1.webp' },
  { source: 'white_gold_priestess_1783018332114.png', dest: '7958b621c_characters2.webp' },
  { source: 'white_haired_warrior_1783018344040.png', dest: '303411c1f_characters3.webp' },
  { source: 'black_hair_military_1783018355984.png', dest: 'eb9d93154_characters4.webp' }
];

async function processImages() {
  for (const {source, dest} of filesToProcess) {
    const srcPath = path.join(artifactDir, source);
    const destPath = path.join(destDir, dest);
    
    if (fs.existsSync(srcPath)) {
      // Create transparent background if needed, but generate_image PNGs are usually direct.
      // We will resize if they are too large. Let's limit width to 256 for pixel art.
      const metadata = await sharp(srcPath).metadata();
      let s = sharp(srcPath);
      if (metadata.width > 512) {
         s = s.resize({ width: 512, withoutEnlargement: true });
      }
      await s.webp({ quality: 90 }).toFile(destPath);
      console.log(`Successfully processed ${source} to ${dest}`);
    } else {
      console.error(`Source file not found: ${srcPath}`);
    }
  }
}

processImages().catch(console.error);
