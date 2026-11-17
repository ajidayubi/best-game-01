// Headless browser verification for Whitewater: captures the 4 shots
// from shots.json (1280x720 JPEG, <=256 KiB), asserts 0 console errors,
// and runs an interactive play test (keyboard start/steer/pause).
// Drives the cached headless Chromium via CDP (raw WebSocket, no deps).
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const GAME_DIR = join(ROOT, 'game');
const SHOTS_DIR = join(ROOT, 'screenshots');
const PORT = 8931;
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const DEBUG_PORT = 9223;

const failures = [];
const errors = [];
const ok = (cond, msg) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
};

// ---- static server for game/ ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, `http://x`).pathname);
    const file = join(GAME_DIR, p === '/' ? 'index.html' : p);
    if (!file.startsWith(GAME_DIR)) throw new Error('bad path');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// ---- launch chromium ----
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1280,720',
  '--mute-audio',
  'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let version;
for (let i = 0; i < 50; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
    break;
  } catch { await sleep(200); }
}
if (!version) { console.log('FAIL could not start chromium'); process.exit(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
const handlers = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method) {
    for (const h of handlers) h(msg);
  }
};
const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage() {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId);
  return { targetId, sessionId };
}
async function evalJs(sessionId, expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}
async function waitFor(sessionId, expr, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs(sessionId, expr)) return true; } catch { /* page still loading */ }
    await sleepMs(100);
  }
  return false;
}
function watchErrors(sessionId) {
  handlers.push((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 400));
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push('log error: ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
    }
  });
}

try {
  // ---- screenshots ----
  console.log('== screenshots ==');
  const shots = JSON.parse(await readFile(join(ROOT, 'shots.json'), 'utf8'));
  for (const shot of shots) {
    const { targetId, sessionId } = await newPage();
    watchErrors(sessionId);
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${shot.query}` }, sessionId);
    const ready = await waitFor(sessionId, 'window.__shotReady === true');
    ok(ready, `${shot.name}: __shotReady`);
    if (ready) {
      const state = await evalJs(sessionId, 'window.__gameState()');
      console.log(`      state=${state.state} score=${state.score} dist=${state.distance}m hull=${state.hull} coins=${state.coins}`);
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, sessionId);
      const buf = Buffer.from(data, 'base64');
      const out = join(SHOTS_DIR, shot.name);
      await writeFile(out, buf);
      const kb = Math.round(buf.length / 1024);
      ok(buf.length <= 256 * 1024, `${shot.name}: ${kb} KiB <= 256 KiB`);
      // Verify JPEG dimensions via SOI/SOF markers (parse SOF0).
      let w = 0, h = 0;
      for (let i = 2; i < buf.length - 9; i++) {
        if (buf[i] === 0xff && buf[i + 1] >= 0xc0 && buf[i + 1] <= 0xcf && buf[i + 1] !== 0xc4 && buf[i + 1] !== 0xc8 && buf[i + 1] !== 0xcc) {
          h = buf.readUInt16BE(i + 5);
          w = buf.readUInt16BE(i + 7);
          break;
        }
      }
      ok(w === 1280 && h === 720, `${shot.name}: ${w}x${h}`);
    }
    await send('Target.closeTarget', { targetId });
  }

  // ---- interactive play test ----
  console.log('== interactive play test ==');
  const { targetId, sessionId } = await newPage();
  watchErrors(sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?seed=1` }, sessionId);
  ok(await waitFor(sessionId, 'window.__gameState !== undefined'), 'game loaded');
  let st = await evalJs(sessionId, 'window.__gameState()');
  ok(st.state === 'title', `starts on title (got ${st.state})`);
  const key = async (type, keyName, code, vk) => send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk }, sessionId);
  await key('keyDown', ' ', 'Space', 32);
  await key('keyUp', ' ', 'Space', 32);
  await sleepMs(300);
  st = await evalJs(sessionId, 'window.__gameState()');
  ok(st.state === 'playing', `Space starts run (got ${st.state})`);
  const d0 = st.distance;
  await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
  await sleepMs(1500);
  await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
  st = await evalJs(sessionId, 'window.__gameState()');
  ok(st.distance > d0, `distance grows while playing (${d0} -> ${st.distance}m)`);
  await key('keyDown', 'p', 'KeyP', 80);
  await key('keyUp', 'p', 'KeyP', 80);
  await sleepMs(200);
  st = await evalJs(sessionId, 'window.__gameState()');
  ok(st.paused === true, 'P pauses');
  await key('keyDown', 'p', 'KeyP', 80);
  await key('keyUp', 'p', 'KeyP', 80);
  await sleepMs(200);
  st = await evalJs(sessionId, 'window.__gameState()');
  ok(st.paused === false, 'P resumes');
  console.log(`      final: state=${st.state} score=${st.score} dist=${st.distance}m hull=${st.hull} coins=${st.coins}`);
  await send('Target.closeTarget', { targetId });
} finally {
  ws.close();
  chrome.kill();
  server.close();
}

console.log('== console errors ==');
if (errors.length === 0) console.log('  ok   0 console errors / exceptions');
else { for (const e of errors) console.log('  FAIL ' + e); failures.push(...errors); }

console.log(failures.length ? `SHOTS FAILED (${failures.length})` : 'SHOTS OK');
process.exit(failures.length ? 1 : 0);
