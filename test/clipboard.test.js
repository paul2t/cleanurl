/*
 * Exercises src/content-main.js against a stubbed DOM: the clipboard patches
 * are the part of the extension that cannot be checked by reading the rules,
 * and they have to survive being called the way real share buttons call them.
 *
 * Run with: node test/clipboard.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
const failures = [];

function ok(label, condition, detail) {
  if (condition) passed++;
  else failures.push(label + (detail ? `\n    ${detail}` : ''));
}

function eq(label, actual, expected) {
  ok(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/* ---------------------------------------------------------------- *
 * A browser, roughly
 * ---------------------------------------------------------------- */

function makeBrowser(href) {
  const calls = {
    writeText: [], write: [], setData: [], share: [], pushState: [], reports: [],
  };

  class Clipboard {
    writeText(text) { calls.writeText.push(text); return Promise.resolve(); }
    write(items) { calls.write.push(items); return Promise.resolve(); }
  }
  class ClipboardItem {
    constructor(data) { this._data = data; }
    get types() { return Object.keys(this._data); }
    getType(type) { return Promise.resolve(this._data[type]); }
  }
  class DataTransfer {
    constructor() { this.store = {}; }
    setData(format, data) { calls.setData.push([format, data]); this.store[format] = data; }
    getData(format) { return this.store[format]; }
  }
  class Navigator {
    share(data) { calls.share.push(data); return Promise.resolve(); }
  }
  class History {
    pushState(state, title, url) { calls.pushState.push(url); }
    replaceState(state, title, url) { calls.pushState.push(url); }
  }

  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();

  const document = {
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    removeEventListener: documentEvents.removeEventListener.bind(documentEvents),
    dispatchEvent: documentEvents.dispatchEvent.bind(documentEvents),
    activeElement: null,
    readyState: 'loading',
    createElement: () => ({ appendChild() {}, innerHTML: '' }),
    documentElement: {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
      hasAttribute(name) { return name in this.attributes; },
    },
  };

  const sandbox = {
    console, Promise, Blob, Event, CustomEvent, EventTarget, URL, Object, Array,
    Set, Map, String, Number, Math, JSON, Function, RegExp, Symbol, TypeError,
    Clipboard, ClipboardItem, DataTransfer, Navigator, History,
    document,
    location: {
      href: href || 'https://example.com/page',
      origin: new URL(href || 'https://example.com/page').origin,
    },
    navigator: new Navigator(),
    history: new History(),
    getSelection: () => sandbox.__selection,
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    __selection: null,
  };
  sandbox.navigator.clipboard = new Clipboard();
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;

  // The generated bundle, which is what Chrome actually loads into the page
  // world - not the sources it was built from.
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'page-world.js'), 'utf8'), context,
    { filename: 'page-world.js' });

  document.addEventListener('cleanurl:report', (event) => {
    calls.reports.push(JSON.parse(event.detail));
  });

  return { sandbox, calls, document, Clipboard, ClipboardItem, DataTransfer };
}

const DIRTY = 'https://youtu.be/dQw4w9WgXcQ?si=Kd8sPqR2';
const CLEAN = 'https://youtu.be/dQw4w9WgXcQ';

/* ---------------------------------------------------------------- *
 * The page world must not leak
 * ---------------------------------------------------------------- */

{
  const { sandbox } = makeBrowser();
  eq('CleanURL is removed from the page global', typeof sandbox.CleanURL, 'undefined');
  eq('the rule database is removed too', typeof sandbox.CLEANURL_RULES, 'undefined');
}

/* ---------------------------------------------------------------- *
 * navigator.clipboard.writeText - the share button path
 * ---------------------------------------------------------------- */

(async function () {
  const { sandbox, calls } = makeBrowser();

  await sandbox.navigator.clipboard.writeText(DIRTY);
  eq('writeText strips the share id', calls.writeText[0], CLEAN);
  eq('the cleanup is reported', calls.reports[0] && calls.reports[0].kind, 'copy');

  await sandbox.navigator.clipboard.writeText('https://example.com/clean');
  eq('an already clean url is passed through', calls.writeText[1], 'https://example.com/clean');
  eq('nothing extra is reported', calls.reports.length, 1);

  await sandbox.navigator.clipboard.writeText('call me maybe');
  eq('plain text is untouched', calls.writeText[2], 'call me maybe');

  // Called the way libraries reach for it, off the prototype.
  await sandbox.Clipboard.prototype.writeText.call(sandbox.navigator.clipboard, DIRTY);
  eq('patched on the prototype, not the instance', calls.writeText[3], CLEAN);

  eq('writeText still reports as native',
    String(sandbox.Clipboard.prototype.writeText).includes('[native code]') ||
    String(sandbox.Clipboard.prototype.writeText).startsWith('writeText'), true);
})();

/* ---------------------------------------------------------------- *
 * navigator.clipboard.write - rich clipboard items
 * ---------------------------------------------------------------- */

(async function () {
  const { sandbox, calls, ClipboardItem } = makeBrowser();

  const item = new ClipboardItem({
    'text/plain': new Blob([DIRTY], { type: 'text/plain' }),
    'image/png': new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' }),
  });
  const returned = sandbox.navigator.clipboard.write([item]);

  // Must have handed the original a value synchronously, or the user gesture
  // would have expired before the write landed.
  eq('write forwards immediately', calls.write.length, 1);

  await returned;
  const forwarded = calls.write[0][0];
  const text = await (await forwarded.getType('text/plain')).text();
  eq('the text flavour is cleaned', text, CLEAN);
  const image = await forwarded.getType('image/png');
  eq('other flavours are left alone', image.type, 'image/png');
  eq('the image survives intact', (await image.arrayBuffer()).byteLength, 3);
})();

/* ---------------------------------------------------------------- *
 * DataTransfer.setData - copy handlers and dragging
 * ---------------------------------------------------------------- */

{
  const { sandbox, calls, DataTransfer } = makeBrowser();
  const transfer = new DataTransfer();

  transfer.setData('text/plain', `Watch this: ${DIRTY}`);
  eq('setData cleans text/plain', calls.setData[0][1], `Watch this: ${CLEAN}`);

  transfer.setData('text/uri-list', DIRTY);
  eq('setData cleans text/uri-list', calls.setData[1][1], CLEAN);

  transfer.setData('application/json', `{"url":"${DIRTY}"}`);
  eq('setData leaves other formats alone', calls.setData[2][1], `{"url":"${DIRTY}"}`);
}

/* ---------------------------------------------------------------- *
 * Ctrl+C over a selection
 * ---------------------------------------------------------------- */

{
  const { sandbox, calls } = makeBrowser();
  sandbox.__selection = { rangeCount: 0, toString: () => `see ${DIRTY} ok` };

  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);

  eq('the copy is rewritten', transfer.getData('text/plain'), `see ${CLEAN} ok`);
  eq('the default copy is cancelled', event.defaultPrevented, true);
  eq('the copy is counted once', calls.reports.filter((r) => r.kind === 'copy').length, 1);
}

{
  const { sandbox } = makeBrowser();
  sandbox.__selection = { rangeCount: 0, toString: () => 'nothing to clean here' };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);
  eq('a clean selection is left to the browser', event.defaultPrevented, false);
  eq('and nothing is written', transfer.getData('text/plain'), undefined);
}

{
  // A cancelled event with no payload is a page suppressing the copy.
  const { sandbox, calls } = makeBrowser();
  sandbox.__selection = { rangeCount: 0, toString: () => DIRTY };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  event.preventDefault();
  sandbox.dispatchEvent(event);
  eq('a suppressed copy is left suppressed', calls.setData.length, 0);
}

{
  /*
   * A page wrote its own payload through a path we could not patch - what
   * happens when a strict CSP keeps the main-world script out. The guard
   * reads it back off the event and rewrites it.
   */
  const { sandbox } = makeBrowser();
  const transfer = new sandbox.DataTransfer();
  transfer.store['text/plain'] = DIRTY; // written without going through setData
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  event.preventDefault();
  sandbox.dispatchEvent(event);
  eq('a page-written payload is read back and cleaned',
    transfer.getData('text/plain'), CLEAN);
}

{
  // Polymer, and YouTube: the focused field lives inside a shadow root, where
  // document.activeElement only reaches the host.
  const { sandbox } = makeBrowser();
  const inner = {
    tagName: 'INPUT', value: DIRTY, selectionStart: 0, selectionEnd: DIRTY.length,
  };
  sandbox.document.activeElement = { tagName: 'YT-COPY-LINK-RENDERER', shadowRoot: { activeElement: inner } };
  sandbox.__selection = { rangeCount: 0, toString: () => '' };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);
  eq('a selection inside a shadow root is found',
    transfer.getData('text/plain'), CLEAN);
}

{
  // Nested shadow roots, and a host with no focused child.
  const { sandbox } = makeBrowser();
  const inner = {
    tagName: 'TEXTAREA', value: DIRTY, selectionStart: 0, selectionEnd: DIRTY.length,
  };
  sandbox.document.activeElement = {
    tagName: 'OUTER-HOST',
    shadowRoot: { activeElement: { tagName: 'INNER-HOST', shadowRoot: { activeElement: inner } } },
  };
  sandbox.__selection = { rangeCount: 0, toString: () => '' };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);
  eq('nested shadow roots are walked', transfer.getData('text/plain'), CLEAN);
}

{
  // Selection inside an <input>, where getSelection() returns nothing useful.
  const { sandbox } = makeBrowser();
  sandbox.document.activeElement = {
    tagName: 'INPUT', value: `prefix ${DIRTY} suffix`,
    selectionStart: 7, selectionEnd: 7 + DIRTY.length,
  };
  sandbox.__selection = { rangeCount: 0, toString: () => '' };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);
  eq('input selections are cleaned', transfer.getData('text/plain'), CLEAN);
  eq('no html flavour is invented for an input', transfer.getData('text/html'), undefined);
}

/* ---------------------------------------------------------------- *
 * Web Share
 * ---------------------------------------------------------------- */

(async function () {
  const { sandbox, calls } = makeBrowser();
  await sandbox.navigator.share({ title: 'x', url: DIRTY, text: `look ${DIRTY}` });
  eq('share url is cleaned', calls.share[0].url, CLEAN);
  eq('share text is cleaned', calls.share[0].text, `look ${CLEAN}`);
  eq('share title is untouched', calls.share[0].title, 'x');
})();

/* ---------------------------------------------------------------- *
 * SPA navigations
 * ---------------------------------------------------------------- */

{
  const { sandbox, calls } = makeBrowser('https://www.youtube.com/');
  sandbox.history.pushState({}, '', '/watch?v=abc&si=xyz&utm_source=share');
  eq('pushState urls are cleaned, relative to the current page',
    calls.pushState[0], 'https://www.youtube.com/watch?v=abc');

  sandbox.history.replaceState({}, '', '/watch?v=abc');
  eq('a clean pushState url is passed through untouched', calls.pushState[1], '/watch?v=abc');

  sandbox.history.pushState({}, '');
  eq('pushState without a url still works', calls.pushState[2], undefined);
}

/* ---------------------------------------------------------------- *
 * Settings arriving from the isolated world
 * ---------------------------------------------------------------- */

(async function () {
  const { sandbox, calls, document } = makeBrowser();
  const send = (settings) => document.dispatchEvent(new CustomEvent('cleanurl:config', {
    detail: JSON.stringify(settings),
  }));

  send({ enabled: true, cleanCopies: false, cleanAddressBar: true, allowlist: [] });
  await sandbox.navigator.clipboard.writeText(DIRTY);
  eq('copy cleaning can be switched off', calls.writeText[0], DIRTY);

  send({ enabled: false, cleanCopies: true, cleanAddressBar: true, allowlist: [] });
  await sandbox.navigator.clipboard.writeText(DIRTY);
  eq('the master switch is respected', calls.writeText[1], DIRTY);

  send({ enabled: true, cleanCopies: true, cleanAddressBar: true, allowlist: ['youtu.be'] });
  await sandbox.navigator.clipboard.writeText(DIRTY);
  eq('allowlisted hosts are left alone', calls.writeText[2], DIRTY);

  send({ enabled: true, cleanCopies: true, cleanAddressBar: true, allowlist: [] });
  await sandbox.navigator.clipboard.writeText(DIRTY);
  eq('and cleaning resumes', calls.writeText[3], CLEAN);

  document.dispatchEvent(new CustomEvent('cleanurl:config', { detail: 'not json' }));
  await sandbox.navigator.clipboard.writeText(DIRTY);
  eq('a broken config message keeps the last good settings', calls.writeText[4], CLEAN);
})();

/* ---------------------------------------------------------------- *
 * The isolated world on its own
 *
 * If a page's CSP keeps the main-world script out, this is all that runs.
 * Ctrl+C and pages that write their own payload must still be cleaned.
 * ---------------------------------------------------------------- */

function makeIsolatedWorld(options) {
  const sent = [];
  const listeners = [];
  const noop = () => {};
  const windowEvents = new EventTarget();
  const documentEvents = new EventTarget();

  const document = {
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    dispatchEvent: documentEvents.dispatchEvent.bind(documentEvents),
    documentElement: { hasAttribute: () => false },
    activeElement: null,
    readyState: 'complete',
    createElement: () => ({ appendChild() {}, innerHTML: '' }),
  };

  class DataTransfer {
    constructor() { this.store = {}; }
    setData(format, data) { this.store[format] = data; }
    getData(format) { return this.store[format]; }
  }

  const sandbox = {
    console, Promise, Blob, Event, CustomEvent, EventTarget, URL, Object, Array,
    Set, Map, String, Number, Math, JSON, Function, RegExp, DataTransfer,
    setTimeout, clearTimeout,
    document,
    location: { href: 'https://www.youtube.com/watch?v=abc', origin: 'https://www.youtube.com' },
    history: { state: null, replaceState: noop },
    getSelection: () => sandbox.__selection,
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    __selection: null,
    chrome: {
      storage: {
        sync: { get: (_d, cb) => cb({}) },
        onChanged: { addListener: noop },
      },
      runtime: {
        lastError: null,
        sendMessage: (message) => sent.push(message),
        onMessage: { addListener: (fn) => listeners.push(fn) },
      },
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  // A subframe is a different window object than window.top.
  sandbox.top = options && options.subframe ? {} : sandbox;

  const context = vm.createContext(sandbox);
  for (const file of ['rules.js', 'cleaner.js', 'copy-guard.js', 'field-guard.js',
                      'settings.js', 'content-isolated.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context,
      { filename: file });
  }

  function askStatus() {
    let answer;
    for (const fn of listeners) fn({ type: 'status' }, {}, (r) => { answer = r; });
    return answer;
  }
  return { sandbox, sent, listeners, askStatus, DataTransfer };
}

{
  const { sandbox } = makeIsolatedWorld();
  sandbox.__selection = { rangeCount: 0, toString: () => `watch ${DIRTY}` };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);
  eq('the isolated world cleans a plain selection copy',
    transfer.getData('text/plain'), `watch ${CLEAN}`);
}

{
  const { sandbox } = makeIsolatedWorld();
  const transfer = new sandbox.DataTransfer();
  transfer.store['text/plain'] = DIRTY;
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  event.preventDefault();
  sandbox.dispatchEvent(event);
  eq('the isolated world rewrites a page-written payload',
    transfer.getData('text/plain'), CLEAN);
}

{
  const { sandbox } = makeIsolatedWorld();
  const inner = {
    tagName: 'INPUT', value: DIRTY, selectionStart: 0, selectionEnd: DIRTY.length,
  };
  sandbox.document.activeElement = { tagName: 'YT-COPY-LINK-RENDERER', shadowRoot: { activeElement: inner } };
  sandbox.__selection = { rangeCount: 0, toString: () => '' };
  const transfer = new sandbox.DataTransfer();
  const event = new Event('copy', { cancelable: true });
  event.clipboardData = transfer;
  sandbox.dispatchEvent(event);
  eq('the isolated world reaches into shadow roots too',
    transfer.getData('text/plain'), CLEAN);
}

{
  /*
   * The popup asks frame 0. A subframe must not answer for the page: it has
   * its own document, and a sandboxed one cannot host the main-world script
   * at all, so letting it reply reports the whole page as blocked.
   */
  const top = makeIsolatedWorld();
  ok('the top frame answers a status query', !!top.askStatus());

  const sub = makeIsolatedWorld({ subframe: true });
  eq('a subframe stays silent', sub.askStatus(), undefined);
}

/* ---------------------------------------------------------------- *
 * The main-world hook reports what it installed
 * ---------------------------------------------------------------- */

{
  const { sandbox } = makeBrowser();
  const marker = sandbox.document.documentElement.attributes['data-cleanurl-page-world'];
  ok('the page world records its hooks', typeof marker === 'string', String(marker));
  ok('the clipboard hook is among them', String(marker).split(',').includes('clipboard'),
    String(marker));
}

{
  /*
   * content-main.js alone, with none of its dependencies. Without a marker
   * written first this is indistinguishable from the script never having run
   * at all, and the two have completely different causes.
   */
  const documentEvents = new EventTarget();
  const sandbox = {
    console, Object, JSON, Function, String,
    document: {
      addEventListener: documentEvents.addEventListener.bind(documentEvents),
      dispatchEvent: documentEvents.dispatchEvent.bind(documentEvents),
      documentElement: {
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
      },
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'content-main.js'), 'utf8'),
    vm.createContext(sandbox), { filename: 'content-main.js' });

  const marker = sandbox.document.documentElement.getAttribute('data-cleanurl-page-world');
  eq('a script that ran without its rules says so', marker, 'running,!deps');
}

/* ---------------------------------------------------------------- *
 * Share field fallback
 *
 * A Copy button calling navigator.clipboard.writeText() fires no copy event.
 * Where the main-world hook could not be installed, cleaning the field itself
 * is the only thing left.
 * ---------------------------------------------------------------- */

function makeFieldWorld(fields) {
  const noop = () => {};
  const documentEvents = new EventTarget();
  const document = {
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    dispatchEvent: documentEvents.dispatchEvent.bind(documentEvents),
    querySelectorAll: () => fields,
    activeElement: null,
    documentElement: { getAttribute: () => null },
  };
  const sandbox = {
    console, Promise, URL, Object, Array, Set, Map, WeakSet, String, Number,
    Math, JSON, Function, RegExp, setTimeout, clearTimeout, document,
    location: { href: 'https://www.youtube.com/watch?v=abc' },
    addEventListener: noop,
    getSelection: () => null,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;

  const context = vm.createContext(sandbox);
  for (const file of ['rules.js', 'cleaner.js', 'copy-guard.js', 'field-guard.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context,
      { filename: file });
  }
  const guard = sandbox.CleanURLFieldGuard.install({
    getSettings: () => sandbox.__settings || sandbox.CleanURL.DEFAULT_SETTINGS,
  });
  return { sandbox, guard, document };
}

function field(extra) {
  return Object.assign({ tagName: 'INPUT', readOnly: false, disabled: false,
    form: null, value: DIRTY }, extra);
}

/*
 * The rule: a field is cleaned only when it is clearly displaying a link
 * rather than holding input.
 */
{
  const readonly = field({ readOnly: true });
  const disabled = field({ disabled: true });
  const standalone = field();                 // a share panel input
  const inForm = field({ form: {} });          // something to be submitted
  const all = [readonly, disabled, standalone, inForm];
  makeFieldWorld(all).guard.scan();

  eq('a read-only field is cleaned', readonly.value, CLEAN);
  eq('a disabled field is cleaned', disabled.value, CLEAN);
  eq('a standalone untouched field is cleaned', standalone.value, CLEAN);
  eq('a form field is never touched', inForm.value, DIRTY);
}

/* Event.target and .isTrusted are getter-only, so shadow them. */
function userEvent(type, target, trusted) {
  const event = new Event(type);
  Object.defineProperty(event, 'target', { value: target });
  Object.defineProperty(event, 'isTrusted', { value: trusted !== false });
  return event;
}

{
  // Typing in a field claims it: it is input from then on, not a display.
  const typed = field();
  const world = makeFieldWorld([typed]);
  world.document.dispatchEvent(userEvent('keydown', typed));
  world.guard.scan();
  eq('a field the user typed in is left alone', typed.value, DIRTY);
}

{
  // A synthetic event must not be able to claim a field either.
  const poked = field();
  const world = makeFieldWorld([poked]);
  world.document.dispatchEvent(userEvent('keydown', poked, false));
  world.guard.scan();
  eq('an untrusted event does not claim a field', poked.value, CLEAN);
}

{
  // Clicking into a field claims it too - the user is selecting by hand, and
  // the copy guard covers the Ctrl+C that follows.
  const clicked = field();
  const world = makeFieldWorld([clicked]);
  world.document.dispatchEvent(userEvent('pointerdown', clicked));
  world.guard.scan();
  eq('a field the user clicked into is left alone', clicked.value, DIRTY);
}

{
  const focused = field({ readOnly: true });
  const world = makeFieldWorld([focused]);
  world.document.activeElement = focused;
  world.guard.scan();
  eq('the focused field is never rewritten under the cursor', focused.value, DIRTY);
}

{
  const clean = field({ readOnly: true, value: 'https://example.com/plain' });
  const notUrl = field({ readOnly: true, value: 'just some text' });
  makeFieldWorld([clean, notUrl]).guard.scan();
  eq('a clean url is left alone', clean.value, 'https://example.com/plain');
  eq('non-url text is left alone', notUrl.value, 'just some text');
}

{
  const target = field({ readOnly: true });
  const world = makeFieldWorld([target]);
  world.sandbox.__settings = Object.assign({}, world.sandbox.CleanURL.DEFAULT_SETTINGS,
    { cleanCopies: false });
  world.guard.scan();
  eq('the fallback respects the copy setting', target.value, DIRTY);
}

{
  // A share panel inside a shadow root: the plain query cannot see it, the
  // deep pass can.
  const hidden = field({ readOnly: true });
  const host = { tagName: 'DIV', shadowRoot: { querySelectorAll: () => [hidden] } };
  const world = makeFieldWorld([]);
  world.document.querySelectorAll = () => [host];
  world.guard.scan(false);
  eq('the shallow pass misses a shadowed field', hidden.value, DIRTY);
  world.guard.scan(true);
  eq('the deep pass finds it', hidden.value, CLEAN);
}

/* ---------------------------------------------------------------- */
setTimeout(() => {
  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\n' + failures.map((f) => '  FAIL ' + f).join('\n'));
    process.exit(1);
  }
}, 50);
