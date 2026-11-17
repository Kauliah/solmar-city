// Screenshot capture for Solmar City (tooling, NOT entry code).
// Serves the rebuild's game/ on 127.0.0.1:8903, loads each ?shot= URL in headless
// Chromium (SwiftShader WebGL2), waits for window.__shotReady, saves JPEG quality 82
// into screenshots/. Usage: node shot-solmar.mjs [start|chase|drive|mission|all]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] || 'all';
const shots = which === 'all'
  ? ['start', 'chase', 'drive', 'mission']
  : [which];
const names = { start: '1-start.jpg', chase: '2-chase.jpg', drive: '3-drive.jpg', mission: '4-mission.jpg' };

const server = spawn('node', [join(here, 'serve.ts'), '--port', '8903'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); return gl ? gl.getParameter(gl.VERSION) : null; });
  console.log('WebGL2:', webgl);
  for (const shot of shots) {
    errors.length = 0;
    await page.goto(`http://127.0.0.1:8903/index.html?shot=${shot}&seed=1`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 60000 });
    const path = join(here, 'screenshots', names[shot]);
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
    const s = statSync(path);
    console.log('SHOT', names[shot], s.size, 'bytes, console errors:', errors.length ? errors : 'none');
  }
} finally { await browser.close(); server.kill(); }
