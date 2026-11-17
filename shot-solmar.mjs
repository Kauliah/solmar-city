// Screenshot capture for Solmar City (tooling, NOT game code).
// Serves this repo's game/ on 127.0.0.1:8905, loads each ?shot= scene from
// shots.json in headless Chromium (SwiftShader WebGL2), waits for
// window.__shotReady, and saves a 1280x720 JPEG (quality 82) per shot into
// screenshots/. Fails loudly on any console error or any shot over 256 KiB.
// Run from ~/workspace/makefun so the playwright module resolves.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, statSync, mkdirSync } from 'node:fs';

const REPO = '/home/hatch/workspace/makefun/solmar-city-rebuild';
const PORT = 8905;
const SHOTS = JSON.parse(readFileSync(`${REPO}/shots.json`, 'utf8'));
mkdirSync(`${REPO}/screenshots`, { recursive: true });

const server = spawn('node', [`${REPO}/serve.ts`, '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const shot of SHOTS) {
    errors.length = 0;
    await page.goto(`http://127.0.0.1:${PORT}/index.html${shot.query}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 60000 });
    const path = `${REPO}/screenshots/${shot.name}`;
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
    const size = statSync(path).size;
    const ok = errors.length === 0 && size <= 262144;
    if (!ok) failed = true;
    console.log(`${ok ? 'SHOT OK' : 'SHOT FAIL'} ${shot.name} ${size} bytes errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  }
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
