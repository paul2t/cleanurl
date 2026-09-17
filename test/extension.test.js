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

/* The popup's "Clean clipboard link" button cannot read anything without it. */
{
  const popup = fs.readFileSync(path.join(root, manifest.action.default_popup), 'utf8');
  const script = fs.readFileSync(path.join(root, 'src/popup.js'), 'utf8');
  const readsClipboard = script.includes('clipboard.readText');
  ok('the popup offers a clipboard cleanup', popup.includes('id="clean-clipboard"'));
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
  ok('firefox strips the unpacked-only permission',
    !firefox.permissions.includes('declarativeNetRequestFeedback'));
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

function loadServiceWorker() {
  const captured = { rules: null, removed: null };
  const noop = () => {};
  const listener = { addListener: noop };
  const sandbox = {
    console: { error: noop, warn: noop, log: noop },
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

  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'background.js'), 'utf8'), context,
    { filename: 'background.js' });
  return { sandbox, captured };
}

const { sandbox } = loadServiceWorker();
const defaults = sandbox.CleanURLSettings.normalize(null);
const rules = sandbox.buildRules(defaults);

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
console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\n' + failures.map((f) => '  FAIL ' + f).join('\n'));
  process.exit(1);
}
