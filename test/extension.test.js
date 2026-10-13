/*
 * Structural checks: the manifest points at files that exist, every script
 * parses, and the declarativeNetRequest rules the service worker generates are
 * ones Chrome will actually accept.
 *
 * Run with: node test/extension.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
let passed = 0;
const failures = [];

function ok(label, condition, detail) {
  if (condition) passed++;
  else failures.push(label + (detail ? `\n    ${detail}` : ''));
}

function eq(label, actual, expected) {
  ok(label, actual === expected, `expected ${expected}, got ${actual}`);
}

/* ---------------------------------------------------------------- *
 * Manifest
 * ---------------------------------------------------------------- */

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

eq('manifest version 3', manifest.manifest_version, 3);
ok('declares declarativeNetRequest', manifest.permissions.includes('declarativeNetRequest'));
ok('declares host permissions', manifest.host_permissions.includes('<all_urls>'));

/* The popup's "Clean clipboard link" button cannot read anything without it. */
{
  const popup = fs.readFileSync(path.join(root, manifest.action.default_popup), 'utf8');
  const script = fs.readFileSync(path.join(root, 'src/popup.js'), 'utf8');
  const readsClipboard = script.includes('clipboard.readText');
  ok('the popup has a clean-clipboard button',
    /<button[^>]*id="clean-clipboard"/.test(popup));
  ok('reading the clipboard is backed by the permission',
    !readsClipboard || manifest.permissions.includes('clipboardRead'));
}

const referenced = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap((entry) => entry.js),
];
for (const file of new Set(referenced)) {
  ok(`manifest file exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const worlds = manifest.content_scripts.map((entry) => entry.world || 'ISOLATED');
ok('one isolated and one main world content script',
  worlds.includes('ISOLATED') && worlds.includes('MAIN'), worlds.join(', '));
ok('content scripts run at document_start',
  manifest.content_scripts.every((entry) => entry.run_at === 'document_start'));

const isolatedEntry = manifest.content_scripts.find((e) => (e.world || 'ISOLATED') === 'ISOLATED');
const mainEntry = manifest.content_scripts.find((e) => e.world === 'MAIN');

ok('the isolated entry loads rules then cleaner first',
  isolatedEntry.js.indexOf('src/rules.js') === 0 && isolatedEntry.js.indexOf('src/cleaner.js') === 1,
  isolatedEntry.js.join(', '));

/*
 * The invariant that cost a day: a JS file listed in two content_scripts
 * entries is injected once, into whichever comes first. Sharing rules.js and
 * cleaner.js between the entries left the main world with content-main.js and
 * none of its dependencies.
 */
{
  const seen = new Map();
  for (const entry of manifest.content_scripts) {
    for (const file of entry.js) {
      const world = entry.world || 'ISOLATED';
      ok(`no content script file is shared between worlds: ${file}`,
        !seen.has(file), `also in the ${seen.get(file)} entry`);
      seen.set(file, world);
    }
  }
}

eq('the main world loads exactly one bundled file', mainEntry.js.join(','), 'src/page-world.js');

/* Popup and options pages must load their scripts in the same order. */
for (const page of [manifest.action.default_popup, manifest.options_page]) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  ok(`${page} loads rules.js then cleaner.js then settings.js`,
    scripts[0] === 'rules.js' && scripts[1] === 'cleaner.js' && scripts[2] === 'settings.js',
    scripts.join(', '));
  ok(`${page} has no inline script`, !/<script(?![^>]*\bsrc=)/.test(html));
  for (const src of scripts) {
    ok(`${page} script exists: ${src}`, fs.existsSync(path.join(root, 'src', src)));
  }
}

/* ---------------------------------------------------------------- *
 * Pages and their scripts agree about element ids
 * ---------------------------------------------------------------- */

function pageIds(htmlPath, scriptPath) {
  const html = fs.readFileSync(path.join(root, htmlPath), 'utf8');
  const js = fs.readFileSync(path.join(root, scriptPath), 'utf8');
  return {
    declared: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
    used: new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1])),
  };
}

for (const [htmlPath, scriptPath] of [['src/popup.html', 'src/popup.js'],
                                      ['src/options.html', 'src/options.js']]) {
  const { declared, used } = pageIds(htmlPath, scriptPath);
  for (const id of used) {
    ok(`${scriptPath} looks up an id that exists: ${id}`, declared.has(id));
  }
}

/* The generated bundle must match its sources. */
{
  const builder = require('../tools/build-page-world.js');
  const onDisk = fs.readFileSync(builder.OUTPUT, 'utf8');
  ok('src/page-world.js is up to date (run `npm run build`)', onDisk === builder.build());
  for (const name of builder.SOURCES) {
    ok(`the bundle contains src/${name}`, onDisk.includes(`/* ---- src/${name} `));
  }
}

/* ---------------------------------------------------------------- *
 * Packaging ships what the manifest reaches, and nothing else
 * ---------------------------------------------------------------- */

{
  const packager = require('../tools/package.js');
  const { files } = packager.collectFiles();

  ok('packages the manifest itself', files.includes('manifest.json'));
  ok('packages the page-world bundle', files.includes('src/page-world.js'));
  ok('packages the popup with its scripts',
    ['src/popup.html', 'src/popup.js', 'src/settings.js'].every((f) => files.includes(f)));
  ok('packages the service worker and what it importScripts',
    ['src/background.js', 'src/cleaner.js', 'src/rules.js'].every((f) => files.includes(f)));
  ok('packages every icon',
    Object.values(manifest.icons).every((icon) => files.includes(icon)));
  ok('leaves development files out',
    !files.some((f) => f.startsWith('test/') || f.startsWith('tools/') || f === 'package.json'),
    files.filter((f) => f.startsWith('test/') || f.startsWith('tools/')).join(', '));
  ok('leaves sources that only feed the bundle out',
    !files.includes('src/content-main.js'));
  ok('leaves the debug log page out',
    !files.includes('src/debug.html') && !files.includes('src/debug.js'));
  for (const file of files) {
    ok(`packaged file exists: ${file}`, fs.existsSync(path.join(root, file)));
  }

  /*
   * Permissions that only work for an unpacked extension are stripped on the
   * way into the zip, but must stay on disk so loading this folder unpacked
   * keeps working.
   */
  const shipped = packager.packagedManifest(manifest, 'chrome');
  for (const permission of packager.DEV_ONLY_PERMISSIONS) {
    ok(`"${permission}" is kept in the manifest on disk`,
      manifest.permissions.includes(permission));
    ok(`"${permission}" is stripped from the packaged manifest`,
      !shipped.manifest.permissions.includes(permission));
    ok(`"${permission}" is reported as removed`,
      shipped.removed.includes(permission));
  }
  ok('stripping leaves every other permission alone',
    manifest.permissions
      .filter((p) => !packager.DEV_ONLY_PERMISSIONS.includes(p))
      .every((p) => shipped.manifest.permissions.includes(p)));
  ok('stripping changes nothing but the permission list',
    JSON.stringify(Object.assign({}, shipped.manifest, { permissions: manifest.permissions })) ===
    JSON.stringify(manifest));
  ok('the source manifest object is not mutated',
    manifest.permissions.includes('declarativeNetRequestFeedback'));

  /* ---------------------------------------------------------------- *
   * The Firefox build
   * ---------------------------------------------------------------- */

  const firefox = packager.packagedManifest(manifest, 'firefox').manifest;
  const worker = manifest.background.service_worker;

  /*
   * Firefox has no background service worker and no importScripts(), so what
   * the worker imports has to be listed for the browser to load first, in the
   * same order, with the worker last. This list is derived by parsing the
   * importScripts() call: when that parse went wrong it produced a list
   * holding only the worker, and the background script died on its first
   * reference to a missing global.
   */
  eq('firefox loads the worker as an event page',
    JSON.stringify(firefox.background),
    JSON.stringify({ scripts: ['src/rules.js', 'src/cleaner.js', 'src/settings.js', worker] }));
  ok('firefox background.scripts lists more than the worker itself',
    firefox.background.scripts.length > 1, firefox.background.scripts.join(', '));
  eq('the worker is loaded last', firefox.background.scripts.slice(-1)[0], worker);
  ok('every firefox background script is packaged',
    firefox.background.scripts.every((f) => files.includes(f)));
  ok('firefox drops the service worker key', !firefox.background.service_worker);

  ok('firefox declares a gecko id',
    !!(firefox.browser_specific_settings && firefox.browser_specific_settings.gecko.id));
  ok('firefox pins a minimum version for world: MAIN',
    parseFloat(firefox.browser_specific_settings.gecko.strict_min_version) >= 128,
    firefox.browser_specific_settings.gecko.strict_min_version);
  ok('firefox drops the chrome version floor', !firefox.minimum_chrome_version);

  /*
   * AMO requires this for new extensions, and it is an attestation: it has to
   * match the no-collection answers given to the Chrome Web Store.
   */
  const dataPermissions = firefox.browser_specific_settings.gecko.data_collection_permissions;
  const android = firefox.browser_specific_settings.gecko_android;
  ok('firefox declares android compatibility', !!android);
  eq('android uses the same version floor',
    android && android.strict_min_version,
    firefox.browser_specific_settings.gecko.strict_min_version);

  ok('firefox declares data collection permissions', !!dataPermissions);
  eq('firefox declares that it collects nothing',
    JSON.stringify(dataPermissions.required), JSON.stringify(['none']));
  ok('firefox declares no optional collection either', !dataPermissions.optional);
  ok('"none" is not mixed with a category',
    dataPermissions.required.length === 1,
    dataPermissions.required.join(', '));
  ok('firefox strips the unpacked-only permission',
    !firefox.permissions.includes('declarativeNetRequestFeedback'));
  ok('the unpacked manifest is the debug build', manifest.permissions.includes('webRequest'));
  ok('no package is a debug build',
    !firefox.permissions.includes('webRequest') &&
    !shipped.manifest.permissions.includes('webRequest'));
  ok('firefox keeps every real permission',
    manifest.permissions
      .filter((p) => !packager.DEV_ONLY_PERMISSIONS.includes(p))
      .every((p) => firefox.permissions.includes(p)));
  eq('firefox keeps the same content scripts',
    JSON.stringify(firefox.content_scripts), JSON.stringify(manifest.content_scripts));

  ok('the chrome build is untouched by the firefox transform',
    !shipped.manifest.browser_specific_settings &&
    !!shipped.manifest.background.service_worker);
  eq('targets have distinct extensions',
    packager.TARGETS.chrome.extension + ',' + packager.TARGETS.firefox.extension, 'zip,xpi');

  /*
   * background.js must keep working as a service worker too: Chrome has no
   * background.scripts, so the importScripts() call has to stay, guarded.
   */
  const workerSource = fs.readFileSync(path.join(root, worker), 'utf8');
  ok('the worker still calls importScripts for chrome',
    /importScripts\('rules\.js'/.test(workerSource));
  ok('the importScripts call is guarded for firefox',
    /typeof importScripts === 'function'/.test(workerSource));

  /* The zip writer is hand-rolled, so prove an entry survives the round trip. */
  const archive = packager.zip([{ name: 'a/b.txt', data: Buffer.from('hello world') }]);
  eq('zip starts with a local file header', archive.readUInt32LE(0), 0x04034b50);
  eq('zip ends with an end-of-central-directory record',
    archive.readUInt32LE(archive.length - 22), 0x06054b50);
  const nameLength = archive.readUInt16LE(26);
  const extraLength = archive.readUInt16LE(28);
  const compressed = archive.readUInt32LE(18);
  const start = 30 + nameLength + extraLength;
  eq('zip stores the entry path with forward slashes',
    archive.subarray(30, 30 + nameLength).toString(), 'a/b.txt');
  eq('zip round-trips its payload',
    zlib.inflateRawSync(archive.subarray(start, start + compressed)).toString(),
    'hello world');
}

/* ---------------------------------------------------------------- *
 * Every script parses
 * ---------------------------------------------------------------- */

for (const file of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  let error = null;
  try {
    new vm.Script(source, { filename: file });
  } catch (e) {
    error = e.message;
  }
  ok(`parses: src/${file}`, !error, error);
}

/* ---------------------------------------------------------------- *
 * The rules the service worker hands to Chrome
 * ---------------------------------------------------------------- */

function loadServiceWorker(options) {
  const omit = (options && options.omit) || [];
  const captured = { rules: null, removed: null };
  const noop = () => {};
  const listener = { addListener: noop };
  const sandbox = {
    console: { error: noop, warn: noop, log: noop, debug: noop },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URL: URL,
    Blob: typeof Blob !== 'undefined' ? Blob : undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);

  sandbox.importScripts = (...files) => {
    for (const file of files) {
      vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context,
        { filename: file });
    }
  };
  sandbox.chrome = {
    runtime: { onInstalled: listener, onStartup: listener, onMessage: listener, lastError: null },
    storage: {
      onChanged: listener,
      sync: { get: (_defaults, cb) => cb({}), set: (_v, cb) => cb && cb() },
      local: { get: (defaults, cb) => cb(defaults), set: (_v, cb) => cb && cb() },
    },
    tabs: { query: (_q, cb) => cb([]), get: noop, onActivated: listener, onUpdated: listener },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: noop },
    contextMenus: { removeAll: (cb) => cb && cb(), create: noop, onClicked: listener },
    scripting: { executeScript: async () => {} },
    declarativeNetRequest: {
      getDynamicRules: async () => [],
      updateDynamicRules: async (update) => {
        captured.rules = update.addRules;
        captured.removed = update.removeRuleIds;
      },
    },
  };

  Object.assign(sandbox.chrome, (options && options.chrome) || {});
  if (options && options.session) sandbox.chrome.storage.session = options.session;
  for (const name of omit) delete sandbox.chrome[name];

  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'background.js'), 'utf8'), context,
    { filename: 'background.js' });
  return { sandbox, captured };
}

const { sandbox } = loadServiceWorker();
const defaults = sandbox.CleanURLSettings.normalize(null);
const rules = sandbox.buildRules(defaults);

/*
 * Firefox for Android has no menus API. The listener registration runs at the
 * top level of the background script, so an unguarded reference would throw
 * during load and take the network rules down with it - and those work on
 * Android.
 */
{
  let android = null;
  let error = null;
  try {
    android = loadServiceWorker({ omit: ['contextMenus'] });
  } catch (e) {
    error = e.message;
  }
  ok('the background script survives without a menus API', !error, error);
  if (android) {
    const androidRules = android.sandbox.buildRules(
      android.sandbox.CleanURLSettings.normalize(null));
    ok('and still generates network rules on Android', androidRules.length > 0);
  }
}

const asyncTests = [];

/*
 * Loads the worker with webRequest and storage.session stubbed. `permissions`
 * is what the manifest declares: the debug build is the unpacked folder, whose
 * manifest keeps webRequest; a package's never does.
 */
function loadWithWebRequest(permissions) {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const store = {};
  const { sandbox } = loadServiceWorker({
    chrome: {
      webRequest: {
        onBeforeRequest: on('request'), onBeforeRedirect: on('redirect'),
        onResponseStarted: on('started'), onCompleted: on('completed'),
        onErrorOccurred: on('error'),
      },
      runtime: { onInstalled: on('x'), onStartup: on('x'), onMessage: on('message'),
                 lastError: null, getManifest: () => ({ permissions: permissions }) },
      tabs: { query: (_q, cb) => cb([]), get: () => {}, onActivated: on('x'),
              onUpdated: on('x'), onRemoved: on('removed') },
    },
    session: {
      get: async (key) => (key in store ? { [key]: store[key] } : {}),
      set: async (items) => { Object.assign(store, items); },
      remove: async (key) => { delete store[key]; },
    },
  });
  return { sandbox, listeners, store };
}

{
  const packaged = loadWithWebRequest(['declarativeNetRequest', 'storage']);
  ok('a package registers no webRequest listeners, even if the API exists',
    !packaged.listeners.request && !packaged.listeners.redirect);
}

/*
 * The debug build: the popup's "removed when opened" note and the debug log.
 * The network rules strip a URL before the page exists, so the background
 * keeps the original per tab from the redirect webRequest reports.
 */
{
  const { sandbox: bg, listeners, store } = loadWithWebRequest(['declarativeNetRequest', 'webRequest']);
  let requestId = 0;

  const ask = (tabId) => new Promise((resolve) =>
    listeners.message({ type: 'opened', tabId: tabId }, {}, resolve));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const lastLog = () => (store.debugLog || []).slice(-1)[0];
  const navigate = async (tabId, url, redirectUrl) => {
    const id = String(++requestId);
    const base = { tabId: tabId, requestId: id, type: 'main_frame' };
    listeners.request(Object.assign({ url: url }, base));
    if (redirectUrl) {
      listeners.redirect(Object.assign({ url: url, redirectUrl: redirectUrl }, base));
      listeners.request(Object.assign({ url: redirectUrl }, base));
    }
    listeners.completed(Object.assign({ url: redirectUrl || url }, base));
    await settle();
  };

  asyncTests.push((async () => {
    ok('the debug build registers its webRequest listeners',
      !!listeners.request && !!listeners.redirect && !!listeners.completed);

    const original = 'https://example.com/post?id=7&utm_source=x&fbclid=abc';
    await navigate(1, original, 'https://example.com/post?id=7');
    const record = await ask(1);
    eq('records the URL the tab was opened with', record && record.original, original);
    eq('and what was removed', record && record.removed.join(), 'utm_source,fbclid');

    let entry = lastLog();
    eq('logs the navigation', entry && entry.kind, 'navigation');
    eq('with where it started', entry && entry.from, original);
    eq('what was removed', entry && entry.removed.join(), 'utm_source,fbclid');
    eq('and what was kept', entry && entry.kept.join(), 'id');
    eq('and the redirect, credited to us', entry && entry.redirects[0].by, 'CleanURL');

    listeners.message({ type: 'report', kind: 'url', count: 1, detail: {
      source: 'address bar', from: 'https://example.com/post?id=7',
      to: 'https://example.com/post?id=7&x=1', removed: ['ga_extra'] } },
    { tab: { id: 1 }, frameId: 0 }, () => {});
    await settle();
    const merged = await ask(1);
    eq('an address bar cleanup of the same page keeps the original',
      merged && merged.original, original);
    eq('and adds what it removed', merged && merged.removed.join(), 'utm_source,fbclid,ga_extra');
    eq('and is logged', lastLog() && lastLog().kind, 'address bar');

    await navigate(1, 'https://example.com/post?id=7&x=1');
    ok('a reload of the cleaned URL keeps the record', !!(await ask(1)));
    eq('a navigation where nothing was removed still logs what was kept',
      lastLog() && lastLog().kept.join(), 'id,x');

    const before = (store.debugLog || []).length;
    await navigate(1, 'https://other.example/');
    eq('a new page clears it', await ask(1), null);
    eq('a URL without a query string is not logged', (store.debugLog || []).length, before);

    await navigate(2, 'https://example.com/?ref=home&lang=fr', 'https://example.com/?lang=fr');
    eq('a server redirect that drops a name we do not remove is not claimed',
      await ask(2), null);
    eq('and is logged as the server\'s', lastLog() && lastLog().redirects[0].by, 'server');

    await navigate(3, 'http://example.com/?utm_source=x', 'https://example.com/');
    eq('a redirect to another origin is not claimed', await ask(3), null);

    await navigate(4, 'https://example.com/?gclid=1', 'https://example.com/');
    ok('recorded for tab 4', !!(await ask(4)));
    listeners.removed(4);
    await settle();
    eq('closing the tab forgets it', await ask(4), null);

    // Kept names split into affiliate credit and everything else.
    await navigate(9, 'https://www.amazon.fr/dp/B0?tag=pub-21&utm_source=x&th=1&color=red',
      'https://www.amazon.fr/dp/B0?tag=pub-21&color=red');
    entry = lastLog();
    eq('affiliate credit left in place is marked as such', entry && entry.affiliate.join(), 'tag');
    eq('and is still listed as kept', entry && entry.kept.join(), 'tag,color');
    await navigate(9, 'https://example.com/?utm_new_thing=1');
    eq('a name left only because the network rules cannot match it is not affiliate',
      lastLog() && lastLog().affiliate.join(), '');
    const defaults = bg.CleanURLSettings.normalize(null);
    eq('affiliate credit is still named as such when it is removed',
      bg.affiliateNames('https://www.amazon.fr/dp/B0?tag=pub-21&utm_source=x',
        Object.assign({}, defaults, { removeAffiliate: true })).join(), 'tag');

    /*
     * What Chrome actually reports, captured from a real run. Each pattern
     * broke the first version of the log in its own way.
     */
    const fire = (name, tabId, details) =>
      listeners[name](Object.assign({ tabId: tabId, type: 'main_frame' }, details));
    const shortLink = 'https://youtu.be/VNvErq7nseM&is=12345';
    const served = 'https://www.youtube.com/watch?v=VNvErq7nseM&is=12345&feature=youtu.be';
    const cleaned = 'https://www.youtube.com/watch?v=VNvErq7nseM';

    // Chrome 148: a rule rewriting a server redirect's target fires no
    // onBeforeRedirect; the cleaned URL first appears at onResponseStarted.
    fire('request', 5, { requestId: '50', url: shortLink });
    fire('redirect', 5, { requestId: '50', url: shortLink, redirectUrl: served });
    fire('request', 5, { requestId: '50', url: served });
    fire('started', 5, { requestId: '50', url: cleaned });
    fire('completed', 5, { requestId: '50', url: cleaned });
    await settle();
    entry = lastLog();
    eq('a silent rewrite of a redirect target is found', entry && entry.removed.join(), 'is,feature');
    eq('the entry starts at the link that was opened', entry && entry.from, shortLink);
    eq('and ends at the cleaned URL', entry && entry.to, cleaned);
    eq('with both redirects, credited correctly',
      entry && entry.redirects.map((hop) => hop.by).join(), 'server,CleanURL');

    // Chrome 155: the rewrite has its redirect event, but onCompleted then
    // names the URL from before it.
    fire('request', 6, { requestId: '60', url: shortLink });
    fire('redirect', 6, { requestId: '60', url: shortLink, redirectUrl: served });
    fire('request', 6, { requestId: '60', url: served });
    fire('redirect', 6, { requestId: '60', url: served, redirectUrl: cleaned });
    fire('request', 6, { requestId: '60', url: cleaned });
    fire('completed', 6, { requestId: '60', url: served });
    await settle();
    entry = lastLog();
    eq('a stale URL at onCompleted does not undo the cleanup', entry && entry.to, cleaned);
    eq('so nothing removed is also listed as kept', entry && entry.kept.join(), 'v');

    // Chrome aborts the first attempt and starts over under a new requestId.
    const before2 = (store.debugLog || []).length;
    fire('request', 7, { requestId: '70', url: 'https://example.com/a?si=1&utm_source=x' });
    fire('redirect', 7, { requestId: '70', url: 'https://example.com/a?si=1&utm_source=x',
      redirectUrl: 'https://example.com/a?si=1' });
    fire('request', 7, { requestId: '70', url: 'https://example.com/a?si=1' });
    fire('error', 7, { requestId: '70', url: 'https://example.com/a?si=1', error: 'net::ERR_ABORTED' });
    fire('request', 7, { requestId: '71', url: 'https://example.com/a?si=1' });
    fire('completed', 7, { requestId: '71', url: 'https://example.com/a?si=1' });
    await settle();
    eq('an aborted attempt and its restart make one entry',
      (store.debugLog || []).length, before2 + 1);
    entry = lastLog();
    eq('which starts where the first attempt did',
      entry && entry.from, 'https://example.com/a?si=1&utm_source=x');
    eq('and is not marked as an error', entry && entry.note, undefined);

    // An abort nobody restarts is logged after a grace period, with the error.
    fire('request', 8, { requestId: '80', url: 'https://example.com/b?utm_source=x' });
    fire('error', 8, { requestId: '80', url: 'https://example.com/b?utm_source=x',
      error: 'net::ERR_ABORTED' });
    await new Promise((resolve) => setTimeout(resolve, 1700));
    entry = lastLog();
    eq('an abandoned navigation is still logged', entry && entry.from,
      'https://example.com/b?utm_source=x');
    eq('with its error', entry && entry.note, 'net::ERR_ABORTED');
  })().catch((error) => ok('debug build tests ran', false, error.stack)));
}

/* Every setting must be editable, or it silently becomes unreachable. */
{
  const optionsHtml = fs.readFileSync(path.join(root, 'src/options.html'), 'utf8');
  const keys = Object.keys(sandbox.CleanURL.DEFAULT_SETTINGS);
  ok('found the default settings', keys.length >= 8, keys.join(', '));
  for (const key of keys) {
    ok(`options page has a control for "${key}"`,
      new RegExp(`<(input|textarea)[^>]*\\sid="${key}"`).test(optionsHtml));
  }
}

const VALID_RESOURCE_TYPES = new Set(['main_frame', 'sub_frame', 'stylesheet', 'script',
  'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media',
  'websocket', 'webtransport', 'webbundle', 'other']);

ok('generates rules', rules.length > 0);
ok('stays under the dynamic rule limit', rules.length <= 5000, `${rules.length} rules`);

const ids = new Set();
for (const rule of rules) {
  ok(`rule ${rule.id}: unique id`, Number.isInteger(rule.id) && rule.id >= 1 && !ids.has(rule.id));
  ids.add(rule.id);
  ok(`rule ${rule.id}: has a priority`, Number.isInteger(rule.priority) && rule.priority >= 1);
  ok(`rule ${rule.id}: known resource types`,
    rule.condition.resourceTypes.every((t) => VALID_RESOURCE_TYPES.has(t)));
  ok(`rule ${rule.id}: only top level navigations`,
    rule.condition.resourceTypes.join() === 'main_frame');

  if (rule.action.type === 'redirect') {
    const params = rule.action.redirect.transform.queryTransform.removeParams;
    ok(`rule ${rule.id}: removes something`, Array.isArray(params) && params.length > 0);
    ok(`rule ${rule.id}: all params are non-empty strings`,
      params.every((p) => typeof p === 'string' && p.length > 0));
    ok(`rule ${rule.id}: no duplicate params`, new Set(params).size === params.length,
      params.filter((p, i) => params.indexOf(p) !== i).join(', '));
    eq(`rule ${rule.id}: GET only`, (rule.condition.requestMethods || []).join(), 'get');
  }

  for (const domain of rule.condition.requestDomains || []) {
    ok(`rule ${rule.id}: valid domain "${domain}"`,
      /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain));
  }
}

/*
 * Redirectors must be exempt from the network rules too: declarativeNetRequest
 * is what actually stripped usg off google.com/url and broke the redirect.
 */
{
  const allows = rules.filter((rule) => rule.action.type === 'allow');
  const strips = rules.filter((rule) => rule.action.type === 'redirect');
  ok('there are redirector exemptions', allows.length > 0);
  ok('every exemption outranks every stripping rule',
    Math.min(...allows.map((r) => r.priority)) > Math.max(...strips.map((r) => r.priority)));

  const googleUrl = allows.find((rule) =>
    (rule.condition.requestDomains || []).includes('google.com'));
  ok('google.com/url is exempt', !!googleUrl);
  if (googleUrl) {
    const re = new RegExp(googleUrl.condition.regexFilter);
    ok('the exemption matches the redirector',
      re.test('https://www.google.com/url?sa=j&usg=x'));
    ok('the exemption does not cover search results',
      !re.test('https://www.google.com/search?q=hi&usg=x'));
    ok('the exemption does not cover a path merely containing /url',
      !re.test('https://www.google.com/urlshortener?usg=x'));
  }

  /* RE2 powers regexFilter and has no lookahead; keep the filters within it. */
  for (const rule of allows) {
    if (!rule.condition.regexFilter) continue;
    ok(`rule ${rule.id}: no lookahead in regexFilter`,
      !/\(\?[=!]/.test(rule.condition.regexFilter), rule.condition.regexFilter);
    let bad = null;
    try {
      new RegExp(rule.condition.regexFilter);
    } catch (e) {
      bad = e.message;
    }
    ok(`rule ${rule.id}: regexFilter compiles`, !bad, bad);
  }
}

const globalRule = rules[rules.length - 1];
ok('last rule is the catch-all', !globalRule.condition.requestDomains);
eq('catch-all is lowest priority', globalRule.priority, 1);

const youtube = rules.find((rule) => (rule.condition.requestDomains || []).includes('youtu.be'));
ok('youtube rule exists', !!youtube);
if (youtube) {
  const params = youtube.action.redirect.transform.queryTransform.removeParams;
  ok('youtube rule removes the share id', params.includes('si'));
  ok('youtube rule also removes global trackers', params.includes('utm_source'));
  ok('youtube rule outranks the catch-all', youtube.priority > globalRule.priority);
  ok('youtube rule keeps the video id', !params.includes('v'));
}

/* Settings must reach the generated rules. */
const allowlisted = sandbox.buildRules(
  sandbox.CleanURLSettings.normalize({ allowlist: ['example.com'] }));
const allowRule = allowlisted.find((rule) => rule.action.type === 'allow');
ok('allowlist produces an allow rule', !!allowRule);
if (allowRule) {
  ok('allow rule outranks everything', allowRule.priority > 2);
  eq('allow rule targets the domain', allowRule.condition.requestDomains.join(), 'example.com');
}

eq('disabled means no rules at all',
  sandbox.buildRules(sandbox.CleanURLSettings.normalize({ enabled: false })).length, 0);

const affiliate = sandbox.buildRules(
  sandbox.CleanURLSettings.normalize({ removeAffiliate: true }));
ok('affiliate opt-in reaches the rules',
  affiliate[affiliate.length - 1].action.redirect.transform.queryTransform.removeParams
    .includes('tag'));
ok('affiliate tags are absent by default',
  !globalRule.action.redirect.transform.queryTransform.removeParams.includes('tag'));

const kept = sandbox.buildRules(
  sandbox.CleanURLSettings.normalize({ keepParams: ['utm_source'] }));
ok('keepParams is honoured by the network rules',
  !kept[kept.length - 1].action.redirect.transform.queryTransform.removeParams
    .includes('utm_source'));

/* ---------------------------------------------------------------- *
 * Nothing load-bearing may ever end up in the global list
 * ---------------------------------------------------------------- */

const RULES = sandbox.CLEANURL_RULES;
const NEVER_REMOVE = ['code', 'state', 'token', 'access_token', 'id_token',
  'refresh_token', 'client_id', 'redirect_uri', 'nonce', 'scope', 'session',
  'sid', 'sig', 'signature', 'hash', 'expires', 'key', 'api_key', 'q', 'query',
  'search', 'v', 'id', 'page', 'p', 'offset', 'limit', 'sort', 'lang', 'hl',
  'locale', 'return_to', 'next', 'continue', 'callback', 'email', 'user',
  'username', 'password', 'auth', 'ticket', 'invite', 'file', 'path', 'name'];

const globalSet = new Set(RULES.globalParams.map((p) => p.toLowerCase()));
for (const param of NEVER_REMOVE) {
  ok(`"${param}" is not removed globally`, !globalSet.has(param));
}

const globalRegexes = RULES.globalPatterns.map((p) => new RegExp(p, 'i'));
for (const param of NEVER_REMOVE) {
  const hit = globalRegexes.find((re) => re.test(param));
  ok(`"${param}" is not caught by a global pattern`, !hit, hit && String(hit));
}

ok('no duplicate global params',
  new Set(RULES.globalParams).size === RULES.globalParams.length,
  RULES.globalParams.filter((p, i) => RULES.globalParams.indexOf(p) !== i).join(', '));

for (const site of RULES.sites) {
  ok(`${site.name}: has a name and hosts`, !!site.name && site.hosts.length > 0);
  ok(`${site.name}: no duplicate params`,
    new Set(site.params).size === (site.params || []).length,
    (site.params || []).filter((p, i) => site.params.indexOf(p) !== i).join(', '));
  for (const domain of site.dnrDomains || []) {
    ok(`${site.name}: dnr domain "${domain}" is also matched by hosts/hostRe`,
      site.hosts.some((h) => domain === h || domain.endsWith('.' + h)) ||
      (site.hostRe && new RegExp(site.hostRe, 'i').test(domain)));
  }
}

/* ---------------------------------------------------------------- */
Promise.all(asyncTests).then(() => {
  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\n' + failures.map((f) => '  FAIL ' + f).join('\n'));
    process.exit(1);
  }
});
