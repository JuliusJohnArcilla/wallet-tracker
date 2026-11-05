// Copies the site into dist/ and stamps the build id (commit SHA in CI) into the page.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const id = (process.env.BUILD_ID || 'dev').slice(0, 7);
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of ['sw.js', 'manifest.webmanifest', 'icons', 'vendor']) cpSync(f, `dist/${f}`, { recursive: true });
writeFileSync('dist/index.html', readFileSync('index.html', 'utf8').replace(/__BUILD__/g, id));
console.log(`built dist/ (build ${id})`);
