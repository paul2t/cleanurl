/*
 * End-to-end: the extension loaded in a real browser (Chrome for Testing,
 * headless), against a local web server. Run with: npm run test:e2e
 *
 * It loads this folder, the debug build, so the debug log can be checked too.
 * Skipped, not failed, when Chrome for Testing is not installed: see
 * tools/chrome.js for how to get it.
 */
'use strict';

const http = require('http');
const { findChrome, launch, sleep } = require('../tools/chrome.js');

let passed = 0;
const failures = [];

function ok(label, condition, detail) {
  if (condition) passed++;
  else failures.push(label + (detail ? `\n    ${detail}` : ''));
}

function eq(label, actual, expected) {
  ok(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const PAGE = '<!doctype html><title>test</title><p>page</p>';

async function main() {
  if (!findChrome()) {
    console.log('skipped: Chrome for Testing not found (see tools/chrome.js)');
    return;
  }

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const site = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();

  try {
    const href = (page) => page.eval('location.href');
    const lastLog = () => browser.sw.eval(
      'chrome.storage.session.get("debugLog").then((s) => (s.debugLog || []).slice(-1)[0] || null)');

    /* ---- network rules, before the page loads ---------------------- */
    const opened = `${site}/a?id=7&utm_source=x&fbclid=abc`;
    const page = await browser.open(opened);
    eq('trackers are removed before the page loads', await href(page), `${site}/a?id=7`);
    eq('the server never saw them',
      await page.eval('performance.getEntriesByType("navigation")[0].name'), `${site}/a?id=7`);

    let entry = await lastLog();
    eq('the debug log records the navigation', entry && entry.from, opened);
    eq('with what was removed', entry && entry.removed.join(), 'utm_source,fbclid');
    eq('and what was kept', entry && entry.kept.join(), 'id');

    /* ---- address bar pass: wildcard names the network cannot match -- */
    const wild = await browser.open(`${site}/b?utm_brand_new=1&keep=1`);
    eq('a wildcard tracker is removed after load', await href(wild), `${site}/b?keep=1`);

    /* ---- in-page navigations and copies ----------------------------- */
    await page.eval(`history.pushState(null, '', '/c?gclid=1&page=2'); 1`);
    eq('pushState is cleaned', await href(page), `${site}/c?page=2`);

    await browser.send('Browser.grantPermissions',
      { origin: site, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
    await browser.send('Target.activateTarget', { targetId: page.id });
    await page.eval(`navigator.clipboard.writeText('see https://shop.example/item?utm_campaign=s&color=red')`);
    eq('a share button copy is cleaned', await page.eval('navigator.clipboard.readText()'),
      'see https://shop.example/item?color=red');

    /* ---- popup ------------------------------------------------------ */
    const fresh = await browser.open(`${site}/d?ref_src=x&fbclid=1&q=keep`);
    await browser.send('Target.activateTarget', { targetId: fresh.id });
    await browser.sw.eval('chrome.action.openPopup()');
    const popupTarget = await browser.waitForTarget((t) => t.url.endsWith('/src/popup.html'));
    ok('the popup opens', !!popupTarget);
    if (popupTarget) {
      const popup = await browser.attach(popupTarget.targetId);
      await sleep(800);
      eq('the desktop popup is 320px wide',
        await popup.eval('Math.round(document.body.getBoundingClientRect().width)'), 320);
      const text = await popup.eval('document.body.innerText');
      ok('it says what was removed when the page opened', /Removed when opened: 2 trackers \(ref_src, fbclid\)/.test(text), text);
      ok('it offers the original link', /Copy original link/.test(text), text);
    }

    /* ---- back/forward cache ----------------------------------------- */
    await page.eval('window.__marker = 1; 1');
    await page.send('Page.navigate', { url: `${site}/e` });
    await sleep(1000);
    const history = await page.send('Page.getNavigationHistory');
    await page.send('Page.navigateToHistoryEntry',
      { entryId: history.entries[history.currentIndex - 1].id });
    await sleep(1000);
    eq('a page comes back from the back/forward cache', await page.eval('window.__marker'), 1);

    /* ---- phone layouts ---------------------------------------------- */
    for (const file of ['src/options.html', 'src/popup.html', 'src/debug.html']) {
      const tab = await browser.open('about:blank', 0);
      await tab.send('Emulation.setDeviceMetricsOverride',
        { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
      await tab.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await tab.send('Page.navigate', { url: browser.base + file });
      await sleep(800);
      const width = await tab.eval('[innerWidth, document.documentElement.scrollWidth]');
      ok(`${file} fits a 412px phone screen`, width[0] === 412 && width[1] <= 412,
        `viewport ${width[0]}, content ${width[1]}`);
    }

    entry = await lastLog();
    ok('the log is still being written', !!entry);
  } finally {
    browser.close();
    server.close();
  }
}

main().then(() => {
  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\n' + failures.map((f) => '  FAIL ' + f).join('\n'));
    process.exit(1);
  }
  process.exit(0);
}, (error) => {
  console.log('FAIL e2e run crashed:\n  ' + (error.stack || error));
  process.exit(1);
});
