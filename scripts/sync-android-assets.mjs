import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const androidAssetsDir = resolve(process.cwd(), 'app/src/main/assets/public');

if (!existsSync(distDir)) {
  console.error('dist directory not found. Run vite build first.');
  process.exit(1);
}

if (existsSync(androidAssetsDir)) {
  rmSync(androidAssetsDir, { recursive: true, force: true });
}

mkdirSync(androidAssetsDir, { recursive: true });
cpSync(distDir, androidAssetsDir, { recursive: true });
console.log('Synced Vite bundle to app/src/main/assets/public');
