import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EN_PATH = path.join(__dirname, '../src/locales/en.json');
const RU_PATH = path.join(__dirname, '../src/locales/ru.json');

let en, ru;

try {
  en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  ru = JSON.parse(fs.readFileSync(RU_PATH, 'utf8'));
} catch (error) {
  console.error('Error reading translation files:', error.message);
  process.exit(1);
}

function getPaths(obj, prefix = '') {
  let paths = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      paths.push(...getPaths(obj[key], prefix + key + '.'));
    } else {
      paths.push(prefix + key);
    }
  }
  return paths;
}

const enPaths = new Set(getPaths(en));
const ruPaths = new Set(getPaths(ru));

const missingInRu = [...enPaths].filter(p => !ruPaths.has(p));
const missingInEn = [...ruPaths].filter(p => !enPaths.has(p));

let hasErrors = false;

if (missingInRu.length > 0) {
  console.error('\n=== MISSING IN RU ===');
  missingInRu.forEach(key => console.error(`- ${key}`));
  hasErrors = true;
}

if (missingInEn.length > 0) {
  console.error('\n=== MISSING IN EN ===');
  missingInEn.forEach(key => console.error(`- ${key}`));
  hasErrors = true;
}

if (hasErrors) {
  console.error('\n❌ i18n validation failed! There are missing keys in the translation files.');
  console.error('Please ensure both en.json and ru.json have the exact same structure.');
  process.exit(1);
}

console.log('✅ i18n validation passed! All keys match structurally.');
process.exit(0);
