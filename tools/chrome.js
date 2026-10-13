/*
 * Drives Chrome for Testing with this extension loaded, over the DevTools
 * protocol, with no dependencies. Used by test/e2e.test.js and
 * tools/store-images.js.
 *
 * Branded Chrome no longer honours --load-extension, so this needs Chrome for
 * Testing: set CHROME_PATH to its binary, or install it where Puppeteer keeps
 * it with
 *   npx @puppeteer/browsers install chrome@stable --path ~/.cache/puppeteer
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The newest Chrome for Testing binary, or null when there is none. */
function findChrome() {
  if (process.env.CHROME_PATH) {
    return fs.existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  }
  const cache = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (!fs.existsSync(cache)) return null;
  const candidates = {
    win32: ['chrome-win64/chrome.exe', 'chrome-win32/chrome.exe'],
    linux: ['chrome-linux64/chrome'],
    darwin: [
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ],
  }[process.platform] || [];
  const version = (dir) => (dir.split('-').pop() || '').split('.').map(Number);
  const newest = (a, b) => {
    const [x, y] = [version(a), version(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0);
    }
    return 0;
  };
  for (const dir of fs.readdirSync(cache).sort(newest)) {
    for (const rel of candidates) {
      const file = path.join(cache, dir, rel);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/**
 * Starts headless Chrome for Testing with `extension` (default: this folder,
 * the debug build) loaded, and waits for its service worker.
 */
async function launch(options) {
  const opts = options || {};
  const binary = opts.chrome || findChrome();
  if (!binary) throw new Error('Chrome for Testing not found; see tools/chrome.js');
  const extension = opts.extension || root;
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanurl-chrome-'));
  const child = spawn(binary, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--load-extension=${extension}`, `--disable-extensions-except=${extension}`,
    '--no-first-run', '--no-default-browser-check', ...(opts.args || []), 'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      wsUrl = info.webSocketDebuggerUrl;
    } catch (e) {
      await sleep(100);
    }
  }
  if (!wsUrl) {
    child.kill();
    throw new Error('Chrome did not open its debugging port');
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (message) => {
    const msg = JSON.parse(message.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      events.push(msg);
    }
  });

  /** Sends a CDP command; rejects on a protocol error. */
  function send(method, params, sessionId) {
    return new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (msg) => (msg.error
        ? reject(new Error(`${method}: ${msg.error.message}`))
        : resolve(msg.result)));
      ws.send(JSON.stringify({ id: n, method, params: params || {}, sessionId }));
    });
  }

  async function targets() {
    return (await send('Target.getTargets')).targetInfos;
  }

  async function waitForTarget(test, timeout) {
    const end = Date.now() + (timeout || 5000);
    while (Date.now() < end) {
      const found = (await targets()).find(test);
      if (found) return found;
      await sleep(100);
    }
    return null;
  }

  /** A page or worker to talk to: { id, session, eval(expression) }. */
  async function attach(targetId) {
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    return {
      id: targetId,
      session: sessionId,
      send: (method, params) => send(method, params, sessionId),
      async eval(expression) {
        const result = await send('Runtime.evaluate', {
          expression, awaitPromise: true, returnByValue: true, userGesture: true,
        }, sessionId);
        if (result.exceptionDetails) {
          throw new Error(result.exceptionDetails.exception
            ? result.exceptionDetails.exception.description
            : result.exceptionDetails.text);
        }
        return result.result.value;
      },
    };
  }

  /** Opens a tab and waits for it to load. */
  async function open(url, wait) {
    const { targetId } = await send('Target.createTarget', { url });
    const page = await attach(targetId);
    await sleep(wait === undefined ? 1500 : wait);
    return page;
  }

  const worker = await waitForTarget((t) => t.type === 'service_worker' &&
    t.url.startsWith('chrome-extension://') && t.url.endsWith('/src/background.js'), 10000);
  if (!worker) {
    child.kill();
    throw new Error('the extension service worker did not start');
  }
  const sw = await attach(worker.targetId);
  const base = worker.url.replace(/src\/background\.js$/, '');
  // The worker can be attached before its script has run; then let the
  // network rules install before anything navigates.
  for (let i = 0; i < 100; i++) {
    const rules = await sw.eval(`globalThis.chrome && chrome.declarativeNetRequest
      ? chrome.declarativeNetRequest.getDynamicRules().then((r) => r.length) : 0`).catch(() => 0);
    if (rules) break;
    await sleep(100);
  }

  function close() {
    try { ws.close(); } catch (e) { /* already closed */ }
    child.kill();
    // Chrome holds the profile for a moment after exiting, on Windows.
    setTimeout(() => {
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* best effort */ }
    }, 1000).unref();
  }

  return { send, events, targets, waitForTarget, attach, open, sw, base, close };
}

module.exports = { findChrome, launch, sleep, root };
