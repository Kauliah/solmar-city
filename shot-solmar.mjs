// Screenshot capture for Solmar City (tooling, NOT game code).
// Serves solmar-city-clone/game on 127.0.0.1:8901, loads each ?shot= scene
// in headless Chromium (SwiftShader WebGL2), waits for window.__shotReady,
// saves a 1280x720 JPEG (quality 82) into screenshots/.
// Run from ~/workspace/makefun so Playwright resolves from its node_modules.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';

const REPO = '/home/hatch/workspace/makefun/solmar-city-clone';
const SHOTS = [
  ['1-start.jpg', '?shot=start&seed=1'],
  ['2-chase.jpg', '?shot=chase&seed=1'],
  ['3-drive.jpg', '?shot=drive&seed=1'],
  ['4-mission.jpg', '?shot=mission&seed=1'],
];

const server = spawn('node', [`${REPO}/serve.ts`, '--port', '8901'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const webgl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    return gl ? gl.getParameter(gl.VERSION) : null;
  });
  console.log('WebGL2:', webgl);
  for (const [name, query] of SHOTS) {
    errors.length = 0;
    await page.goto(`http://127.0.0.1:8901/index.html${query}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 60000 });
    const path = `${REPO}/screenshots/${name}`;
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
    const s = statSync(path);
    console.log('SHOT', name, s.size, 'bytes, console errors:', errors.length ? errors : 'none');
  }
} finally {
  await browser.close();
  server.kill();
}
