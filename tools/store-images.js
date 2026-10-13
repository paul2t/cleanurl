/*
 * Regenerates the store listing images in webstore/:
 *   npm run store-images
 *
 * Captures the real popup and settings page from the Chrome store build
 * (not the debug build) running in Chrome for Testing, and composes them into
 * the sizes the Chrome Web Store asks for:
 *   screenshot-*.png        1280x800
 *   promo-small-440x280.png small promo tile
 *   promo-marquee-1400x560.png marquee
 *
 * The pages shown live on made-up domains (news.example, shop.example),
 * served locally, so no real site appears in a screenshot.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { launch, sleep, root } = require('./chrome.js');
const packager = require('./package.js');

const OUT = path.join(root, 'webstore');
const ACCENT = '#4f46e5';

/* ---- the store build, in a temp folder ---------------------------------- */

function storeBuild() {
  const { manifest, files } = packager.collectFiles();
  const shipped = packager.packagedManifest(manifest, 'chrome').manifest;
  // Granted up front so the clipboard screenshot needs no prompt; the popup
  // looks the same once a user has granted it.
  shipped.permissions.push('clipboardRead');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanurl-store-'));
  for (const file of files) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (file === 'manifest.json') fs.writeFileSync(target, JSON.stringify(shipped, null, 2));
    else fs.copyFileSync(path.join(root, file), target);
  }
  return dir;
}

/* ---- compositions --------------------------------------------------------- */

const dataUri = (png) => 'data:image/png;base64,' + png.toString('base64');
const icon = dataUri(fs.readFileSync(path.join(root, 'icons', 'icon-128.png')));

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827;
         background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 55%, #ecfeff 100%);
         overflow: hidden; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 44px; height: 44px; }
  .brand span { font-size: 26px; font-weight: 650; letter-spacing: -.01em; }
  h1 { font-size: 46px; line-height: 1.12; letter-spacing: -.02em; font-weight: 700; }
  p.sub { font-size: 21px; line-height: 1.45; color: #4b5563; }
  .url { font: 19px/1.5 ui-monospace, "Cascadia Mono", Consolas, monospace;
         background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
         padding: 14px 18px; box-shadow: 0 2px 8px rgba(15, 23, 42, .06); overflow-wrap: anywhere; }
  .url .gone { color: #b91c1c; background: rgba(220, 38, 38, .1); text-decoration: line-through;
               border-radius: 4px; }
  .url.clean { border-color: #a5b4fc; }
  .arrow { color: ${ACCENT}; font-size: 30px; text-align: center; line-height: 1; }
  .shot { border-radius: 14px; box-shadow: 0 18px 50px rgba(15, 23, 42, .18), 0 2px 6px rgba(15, 23, 42, .08);
          background: #fff; overflow: hidden; }
  .shot img { display: block; }
`;

function urlHtml(base, query) {
  // query: [[name, value, removed]]
  const parts = query.map(([n, v, gone]) => (gone ? `<span class="gone">${n}=${v}</span>` : `${n}=${v}`));
  // <wbr> lets a long URL wrap between parameters rather than inside one.
  return `${base}?${parts.join('&amp;<wbr>')}`;
}

function screenshotHtml({ title, sub, left, right }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    body { width: 1280px; height: 800px; display: grid; grid-template-columns: 1fr 470px;
           gap: 56px; padding: 64px 72px; align-items: center; }
    .text { display: flex; flex-direction: column; gap: 26px; }
  </style></head><body>
    <div class="text">
      <div class="brand"><img src="${icon}"><span>CleanURL</span></div>
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
      ${left || ''}
    </div>
    <div>${right}</div>
  </body></html>`;
}

function promoHtml(width, height) {
  const wide = width > 1000;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
    body { width: ${width}px; height: ${height}px; display: flex; flex-direction: column;
           justify-content: center; gap: ${wide ? 28 : 14}px; padding: 0 ${wide ? 110 : 34}px; }
    .brand img { width: ${wide ? 84 : 56}px; height: ${wide ? 84 : 56}px; }
    .brand span { font-size: ${wide ? 54 : 34}px; }
    h1 { font-size: ${wide ? 40 : 21}px; font-weight: 600; color: #374151; }
    .url { font-size: ${wide ? 22 : 13}px; padding: ${wide ? '16px 22px' : '8px 11px'}; max-width: ${wide ? 1000 : 380}px; }
  </style></head><body>
    <div class="brand"><img src="${icon}"><span>CleanURL</span></div>
    <h1>Strips trackers from the links you open and copy</h1>
    ${wide ? `<div class="url">${urlHtml('https://news.example/story',
      [['id', '42'], ['utm_source', 'newsletter', true], ['fbclid', 'IwAR2x', true]])}</div>` : ''}
  </body></html>`;
}

/** Renders `html` at exactly width x height and returns the PNG. */
async function render(browser, html, width, height) {
  const page = await browser.open('about:blank', 0);
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const { frameTree } = await page.send('Page.getFrameTree');
  await page.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
  await sleep(400);
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  await browser.send('Target.closeTarget', { targetId: page.id });
  return Buffer.from(data, 'base64');
}

/* ---- captures from the real extension ------------------------------------- */

async function openPopupFor(browser, page) {
  await browser.send('Target.activateTarget', { targetId: page.id });
  await browser.sw.eval('chrome.action.openPopup()');
  const target = await browser.waitForTarget((t) => t.url.endsWith('/src/popup.html'));
  if (!target) throw new Error('the popup did not open');
  const popup = await browser.attach(target.targetId);
  await sleep(600);
  return popup;
}

/**
 * The popup at 2x, as a PNG of exactly its content.
 *
 * Not captured from the popup window itself: when its content grows (the
 * clipboard result), headless Chrome enlarges the window but never repaints
 * the new strip, which shows a stale copy of the top. So the popup's live DOM,
 * state included, is rendered again in a tab of the extension's own origin,
 * sized to fit, and captured there.
 */
async function capturePopup(browser, popup) {
  const html = await popup.eval(`(() => {
    // Properties the HTML does not carry on its own.
    for (const input of document.querySelectorAll('input[type=checkbox]')) {
      input.toggleAttribute('checked', input.checked);
    }
    for (const script of document.querySelectorAll('script')) script.remove();
    // No scrollbars while it is measured in a short tab.
    return '<!doctype html>' + document.documentElement.outerHTML
      .replace('</head>', '<style>html { overflow: hidden; }</style></head>');
  })()`);
  const tab = await browser.open(browser.base + 'src/popup.html', 600);
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  // Measured in a short tab: in a tall one the page is at least as tall as it.
  await tab.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 100, deviceScaleFactor: 2, mobile: false });
  const { frameTree } = await tab.send('Page.getFrameTree');
  await tab.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
  await sleep(400);
  const height = await tab.eval('document.documentElement.scrollHeight');
  await tab.send('Emulation.setDeviceMetricsOverride', { width: 320, height, deviceScaleFactor: 2, mobile: false });
  await sleep(300);
  const { data } = await tab.send('Page.captureScreenshot', { format: 'png' });
  await browser.send('Target.closeTarget', { targetId: tab.id });
  return { png: Buffer.from(data, 'base64'), width: 320, height };
}

async function main() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>Story</title><h1>A story</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const extension = storeBuild();
  const browser = await launch({
    extension,
    args: [
      `--host-resolver-rules=MAP news.example 127.0.0.1:${port}, MAP shop.example 127.0.0.1:${port}`,
      // Served over plain http, the demo sites would get no clipboard API, and
      // the popup would rightly say so. Real sites are https.
      '--unsafely-treat-insecure-origin-as-secure=http://news.example,http://shop.example',
    ],
  });

  try {
    fs.mkdirSync(OUT, { recursive: true });
    const write = (name, png) => {
      fs.writeFileSync(path.join(OUT, name), png);
      console.log('wrote webstore/' + name);
    };

    /* 1. Before the page loads */
    const story = await browser.open('http://news.example/2026/10/privacy?id=42&utm_source=newsletter&utm_medium=email&fbclid=IwAR2x');
    const loaded = await story.eval('location.href');
    if (loaded !== 'http://news.example/2026/10/privacy?id=42') throw new Error('not cleaned: ' + loaded);
    let popup = await openPopupFor(browser, story);
    const popupClean = await capturePopup(browser, popup);
    write('screenshot-1-before-load.png', await render(browser, screenshotHtml({
      title: 'Trackers are gone before the page even loads',
      sub: 'Campaign tags, click ids and share ids are removed from the link as you open it, so the site never receives them.',
      left: `<div class="url">${urlHtml('news.example/2026/10/privacy',
        [['id', '42'], ['utm_source', 'newsletter', true], ['utm_medium', 'email', true], ['fbclid', 'IwAR2x', true]])}</div>
        <div class="arrow">&#8595;</div>
        <div class="url clean">news.example/2026/10/privacy?id=42</div>`,
      right: `<div class="shot"><img src="${dataUri(popupClean.png)}" width="${Math.round(popupClean.width * 1.45)}"></div>`,
    }), 1280, 800));
    await browser.send('Target.closeTarget', { targetId: popup.id }).catch(() => {});

    /* 2. Links you copy */
    const shop = await browser.open('http://shop.example/');
    popup = await openPopupFor(browser, shop);
    await popup.eval(`navigator.clipboard.writeText('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=Kd8sPqR2&pp=ygUFaGVsbG8%3D')`);
    await popup.eval(`document.getElementById('clean-clipboard').click(); 1`);
    await sleep(800);
    const message = await popup.eval(`document.getElementById('clip').textContent`);
    if (!/removed/.test(message)) throw new Error('clipboard not cleaned: ' + message);
    const popupCopy = await capturePopup(browser, popup);
    write('screenshot-2-copies.png', await render(browser, screenshotHtml({
      title: 'Links you copy come out clean',
      sub: 'Share buttons, Ctrl+C, drag and drop and right-click "Copy clean link" all give you the link without its share ids. For links copied elsewhere, clean the clipboard in one click.',
      right: `<div class="shot"><img src="${dataUri(popupCopy.png)}" width="${Math.round(popupCopy.width * 1.45)}"></div>`,
    }), 1280, 800));
    await browser.send('Target.closeTarget', { targetId: popup.id }).catch(() => {});

    /* 3. Settings */
    const options = await browser.open('about:blank', 0);
    // 560 x 800 shown 470 wide fills the 672px frame exactly.
    await options.send('Emulation.setDeviceMetricsOverride', { width: 560, height: 800, deviceScaleFactor: 2, mobile: false });
    await options.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await options.send('Page.navigate', { url: browser.base + 'src/options.html' });
    await sleep(800);
    await options.eval(`document.documentElement.style.scrollbarWidth = 'none'; 1`);
    const { data: optionsShot } = await options.send('Page.captureScreenshot', { format: 'png' });
    write('screenshot-3-settings.png', await render(browser, screenshotHtml({
      title: 'Your rules, your exceptions',
      sub: 'Switch each kind of cleaning on or off, leave chosen sites alone, keep a parameter a site needs, or add your own. Affiliate tags stay unless you choose to remove them.',
      right: `<div class="shot" style="height:672px"><img src="${dataUri(Buffer.from(optionsShot, 'base64'))}" width="470"></div>`,
    }), 1280, 800));

    /* Promo tiles */
    write('promo-small-440x280.png', await render(browser, promoHtml(440, 280), 440, 280));
    write('promo-marquee-1400x560.png', await render(browser, promoHtml(1400, 560), 1400, 560));
  } finally {
    browser.close();
    server.close();
    setTimeout(() => fs.rmSync(extension, { recursive: true, force: true }), 1500).unref();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
