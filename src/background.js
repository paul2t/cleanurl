/*
 * CleanURL - service worker.
 *
 * Compiles the rule database into declarativeNetRequest rules so trackers are
 * stripped from the request line before the navigation leaves the browser,
 * and hosts the "Copy clean link" context menu.
 */
'use strict';

/*
 * Chrome runs this as a service worker, where importScripts() loads the shared
 * modules. Firefox has no background service workers: it runs the same file as
 * an event page, which has no importScripts() either, so the Firefox build
 * lists these files in background.scripts and the browser loads them in the
 * same order before this one.
 */
if (typeof importScripts === 'function') {
  importScripts('rules.js', 'cleaner.js', 'settings.js');
}

const RULES = globalThis.CLEANURL_RULES;
const Clean = globalThis.CleanURL;
const Settings = globalThis.CleanURLSettings;

/* Only top-level navigations: those are the URLs the user sees, shares and
 * pastes. Rewriting sub-resources buys little and breaks more. */
const RESOURCE_TYPES = ['main_frame'];

const PRIORITY = { allow: 100, redirector: 50, site: 2, global: 1 };

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/*
 * Interstitials whose parameters are their payload and their signature.
 * google.com/url rejects the whole request as invalid when usg is missing, so
 * removing the trackers Google puts on its own search results breaks the link
 * rather than cleaning it. These rules exempt the redirector itself; the
 * destination it sends the browser to is a fresh navigation and gets cleaned
 * normally, and a copied link is unwrapped rather than edited.
 */
function redirectorRules(startId) {
  const rules = [];
  let id = startId;
  for (const rule of RULES.redirects) {
    const domains = (rule.dnrDomains || rule.hosts || []).filter(isDnrDomain);
    if (!domains.length) continue;
    const condition = { requestDomains: domains, resourceTypes: RESOURCE_TYPES };
    if (rule.paths && rule.paths.length) {
      // RE2: no lookahead, so the path is anchored and followed explicitly.
      condition.regexFilter = '^https?://[^/]+(' +
        rule.paths.map(escapeRegExp).join('|') + ')([/?]|$)';
    }
    rules.push({
      id: id++,
      priority: PRIORITY.redirector,
      action: { type: 'allow' },
      condition: condition,
    });
  }
  return rules;
}

/* ------------------------------------------------------------------ *
 * Rule compilation
 * ------------------------------------------------------------------ */

function dedupe(list) {
  return Array.from(new Set(list));
}

function isDnrDomain(domain) {
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domain);
}

function redirectAction(params) {
  return {
    type: 'redirect',
    redirect: { transform: { queryTransform: { removeParams: params } } },
  };
}

function buildRules(settings) {
  if (!settings.enabled) return [];

  const keep = new Set(settings.keepParams.map((n) => n.toLowerCase()));
  const drop = (list) => list.filter((name) => !keep.has(String(name).toLowerCase()));

  const globalParams = dedupe(drop([
    ...RULES.globalParams,
    ...(settings.removeAffiliate ? RULES.affiliateParams : []),
    // Wildcards cannot be expressed in declarativeNetRequest; the content
    // script catches those.
    ...settings.customParams.filter((name) => !name.includes('*')),
  ]));

  const rules = [];
  let id = 1;

  const allowlist = settings.allowlist.filter(isDnrDomain);
  if (allowlist.length) {
    rules.push({
      id: id++,
      priority: PRIORITY.allow,
      action: { type: 'allow' },
      condition: { requestDomains: allowlist, resourceTypes: RESOURCE_TYPES },
    });
  }

  for (const rule of redirectorRules(id)) {
    rules.push(rule);
    id = rule.id + 1;
  }

  for (const site of RULES.sites) {
    const domains = (site.dnrDomains || []).filter(isDnrDomain);
    if (!domains.length) continue;
    const params = dedupe(drop([
      ...globalParams,
      ...(site.params || []),
      ...(settings.removeAffiliate ? site.affiliate || [] : []),
    ]));
    rules.push({
      id: id++,
      priority: PRIORITY.site,
      action: redirectAction(params),
      condition: {
        requestDomains: domains,
        resourceTypes: RESOURCE_TYPES,
        requestMethods: ['get'],
        urlFilter: '?',
      },
    });
  }

  rules.push({
    id: id++,
    priority: PRIORITY.global,
    action: redirectAction(globalParams),
    condition: {
      resourceTypes: RESOURCE_TYPES,
      requestMethods: ['get'],
      // Cheap pre-filter: no query string, nothing to remove.
      urlFilter: '?',
    },
  });

  return rules;
}

async function applyRules(rules) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: rules,
  });
}

/** Drops the optional query-string pre-filter from every condition. */
function withoutUrlFilter(rules) {
  return rules.map((rule) => {
    const condition = Object.assign({}, rule.condition);
    delete condition.urlFilter;
    return Object.assign({}, rule, { condition: condition });
  });
}

let rebuildPromise = Promise.resolve();

function rebuildRules() {
  rebuildPromise = rebuildPromise.then(async () => {
    const settings = await Settings.load();
    const rules = buildRules(settings);
    try {
      await applyRules(rules);
    } catch (error) {
      // A single rejected condition would otherwise leave the browser with no
      // rules at all, which fails silently and completely.
      console.warn('[CleanURL] rule set rejected, retrying without the pre-filter:', error);
      await applyRules(withoutUrlFilter(rules));
    }
  }).catch((error) => {
    console.error('[CleanURL] could not update rules:', error);
  });
  return rebuildPromise;
}

/* ------------------------------------------------------------------ *
 * Statistics (batched; the content script can report often)
 * ------------------------------------------------------------------ */

const pendingStats = { cleanedUrls: 0, cleanedCopies: 0 };
let flushTimer = null;

function flushStats() {
  flushTimer = null;
  const delta = { cleanedUrls: pendingStats.cleanedUrls, cleanedCopies: pendingStats.cleanedCopies };
  pendingStats.cleanedUrls = 0;
  pendingStats.cleanedCopies = 0;
  if (!delta.cleanedUrls && !delta.cleanedCopies) return;
  chrome.storage.local.get({ cleanedUrls: 0, cleanedCopies: 0 }, (stored) => {
    void chrome.runtime.lastError;
    chrome.storage.local.set({
      cleanedUrls: (stored.cleanedUrls || 0) + delta.cleanedUrls,
      cleanedCopies: (stored.cleanedCopies || 0) + delta.cleanedCopies,
    });
  });
}

function recordCleaned(kind, count) {
  const n = Math.max(1, Math.min(50, Number(count) || 1));
  if (kind === 'copy') pendingStats.cleanedCopies += n;
  else pendingStats.cleanedUrls += n;
  if (!flushTimer) flushTimer = setTimeout(flushStats, 2000);
}

/*
 * The network layer does most of the cleaning and was invisible to the counter,
 * which then read "nothing cleaned yet" while it worked perfectly.
 *
 * onRuleMatchedDebug only fires for an unpacked extension, and a rule matching
 * does not mean anything was removed - the condition is just a pre-filter - so
 * check the URL before counting rather than inflating it.
 */
function countNetworkCleanups() {
  const api = chrome.declarativeNetRequest;
  if (!api || !api.onRuleMatchedDebug) return;
  // The debug build watches the same redirects and counts them itself.
  if (DEBUG) return;
  try {
    api.onRuleMatchedDebug.addListener((info) => {
      const url = info && info.request && info.request.url;
      if (!url) return;
      Settings.load().then((settings) => {
        const result = Clean.cleanUrl(url, Object.assign({}, settings, {
          unwrapRedirects: false,
        }));
        if (result.changed) recordCleaned('url', result.removed.length || 1);
      });
    });
  } catch (e) { /* permission not granted, or a packed build */ }
}

/* ------------------------------------------------------------------ *
 * Debug build: a log of what was removed and what was kept, and the
 * popup's "Removed when opened" note
 * ------------------------------------------------------------------ */

/*
 * Only when this folder is loaded unpacked (see Settings.isDebugBuild): a
 * package has no webRequest, so none of this runs and no URL is ever kept.
 *
 * The network rules rewrite the request before the page exists, so the page
 * never sees the URL it was opened with. A redirect from declarativeNetRequest
 * is visible to webRequest like any other, which is the one place the original
 * survives.
 *
 * Everything is held in storage.session: memory only, gone when the browser
 * closes, and not readable by content scripts.
 */
const DEBUG = Settings.isDebugBuild() && !!chrome.webRequest;
const session = chrome.storage && chrome.storage.session;
const memory = {};
const LOG_KEY = 'debugLog';
const LOG_LIMIT = 500;

function sessionGet(key) {
  if (!session) return Promise.resolve(memory[key]);
  return session.get(key).then((stored) => stored[key], () => undefined);
}

function sessionSet(key, value) {
  if (!session) {
    if (value === undefined) delete memory[key];
    else memory[key] = value;
    return Promise.resolve();
  }
  return (value === undefined ? session.remove(key) : session.set({ [key]: value }))
    .catch(() => {});
}

/*
 * A navigation clears a tab's record while its own redirect writes a new one,
 * and both are asynchronous; run every read-modify-write one at a time so the
 * clear cannot land last and the log never loses an entry.
 */
let queue = Promise.resolve();
function serial(task) {
  queue = queue.then(task).catch(() => {});
  return queue;
}

function withoutHash(url) {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

function queryNames(url) {
  return Array.from(new Set(url.searchParams.keys()));
}

/** Parameter names left in every URL found in `text`. */
function keptNames(text) {
  const names = new Set();
  for (const match of String(text || '').match(/https?:\/\/[^\s"'<>]+/g) || []) {
    try {
      for (const name of new URL(match).searchParams.keys()) names.add(name);
    } catch (e) { /* not a URL after all */ }
  }
  return Array.from(names);
}

/**
 * Appends to the debug log, newest last, and echoes it to the worker's
 * console. `entry`: { kind, tabId, from, to, removed, kept, note }.
 */
function debugLog(entry) {
  if (!DEBUG) return Promise.resolve();
  const record = Object.assign({ time: Date.now(), removed: [], kept: [] }, entry);
  console.debug('[CleanURL]', record.kind, record.from, '->', record.to,
    'removed:', record.removed, 'kept:', record.kept, record.note || '');
  return serial(async () => {
    const log = (await sessionGet(LOG_KEY)) || [];
    log.push(record);
    await sessionSet(LOG_KEY, log.slice(-LOG_LIMIT));
  });
}

function openedKey(tabId) {
  return 'opened:' + tabId;
}

function getOpened(tabId) {
  return sessionGet(openedKey(tabId)).then((record) => record || null);
}

/*
 * Records a cleanup of `from` into `to` on a tab. When the address bar pass
 * cleans further a URL the network rules already cleaned, the two merge into
 * one record that still starts at the URL the user actually opened.
 */
function recordOpened(tabId, from, to, removed) {
  if (!DEBUG) return Promise.resolve();
  return serial(async () => {
    const previous = await getOpened(tabId);
    const continues = previous && withoutHash(previous.cleaned) === withoutHash(from);
    await sessionSet(openedKey(tabId), {
      original: continues ? previous.original : from,
      cleaned: to,
      removed: Array.from(new Set([...(continues ? previous.removed : []), ...removed])),
    });
  });
}

/*
 * One log entry per top-level navigation that carried a query string, written
 * once it finishes: the URL it started from, every redirect on the way and
 * who made it, what our rules removed, and what was still there at the end.
 *
 * Tracked per tab rather than per requestId, and built from every event
 * rather than trusting any single one, because Chrome reports a navigation
 * less tidily than that:
 *
 * - It often aborts the first attempt (net::ERR_ABORTED) and starts again
 *   under a new requestId, sometimes from the URL a redirect led to. A request
 *   that starts at the URL the tab's navigation last reached continues it.
 * - When a rule rewrites the target of a server redirect, some versions fire
 *   no onBeforeRedirect at all, and the cleaned URL first shows up at
 *   onResponseStarted; others fire it, then report the URL from before the
 *   rewrite at onCompleted. So the navigation's URL is the newest one seen,
 *   and an event naming an earlier one is old news.
 */
function watchNavigations() {
  if (!DEBUG) return;
  const filter = { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] };
  const navigations = new Map(); // tabId -> navigation
  const ABORT_GRACE_MS = 1500;

  function current(navigation) {
    return navigation.chain[navigation.chain.length - 1];
  }

  /*
   * The step from `from` to `to`. Ours only ever removes query parameters, so
   * anything else is the server's - and so is a removal of a name our rules do
   * not remove: a site may redirect to drop its own parameters.
   */
  function step(tabId, navigation, from, to) {
    if (navigation.chain.indexOf(to) === -1) navigation.chain.push(to);
    const hop = { to: to, by: 'server' };
    navigation.redirects.push(hop);

    let a;
    let b;
    try {
      a = new URL(from);
      b = new URL(to);
    } catch (e) {
      return;
    }
    if (a.origin !== b.origin || a.pathname !== b.pathname) return;
    const left = new Set(b.searchParams.keys());
    const removed = queryNames(a).filter((name) => !left.has(name));
    if (!removed.length) return;

    // Kept on the navigation so its log entry waits for the answer.
    navigation.checks.push(Settings.load().then((settings) => {
      const ours = Clean.cleanUrl(from, Object.assign({}, settings, {
        unwrapRedirects: false,
      }));
      if (!removed.every((name) => ours.removed.indexOf(name) !== -1)) return;
      hop.by = 'CleanURL';
      navigation.removed.push(...removed);
      recordCleaned('url', removed.length);
      recordOpened(tabId, from, to, removed);
    }));
  }

  function finish(tabId, note) {
    const navigation = navigations.get(tabId);
    if (!navigation) return;
    navigations.delete(tabId);
    clearTimeout(navigation.timer);
    Promise.all(navigation.checks).then(() => {
      const to = current(navigation);
      const removed = Array.from(new Set(navigation.removed));
      // A name can be both: removed on the way, then put back by a later
      // redirect. Whatever made it to the end was kept.
      const kept = keptNames(to);
      if (!removed.length && !kept.length) return; // nothing to see
      debugLog({
        kind: 'navigation',
        tabId: tabId,
        from: navigation.chain[0],
        to: to,
        removed: removed.filter((name) => kept.indexOf(name) === -1),
        kept: kept,
        redirects: navigation.redirects,
        note: note,
      });
    });
  }

  /** The URL a request reached, from an event that may be reporting old news. */
  function reached(tabId, url) {
    const navigation = navigations.get(tabId);
    if (!navigation || navigation.chain.indexOf(url) !== -1) return;
    step(tabId, navigation, current(navigation), url);
  }

  chrome.webRequest.onBeforeRequest.addListener((details) => {
    const tabId = details.tabId;
    if (tabId < 0) return;
    const navigation = navigations.get(tabId);
    if (navigation && current(navigation) === details.url) {
      // A redirect being followed, or an aborted attempt starting over.
      clearTimeout(navigation.timer);
    } else {
      if (navigation) finish(tabId, 'superseded');
      navigations.set(tabId, { chain: [details.url], redirects: [], removed: [], checks: [] });
    }
    // A new page in the tab: whatever was recorded for the previous one is
    // stale. A reload of the cleaned URL keeps it, as that is the same page.
    serial(async () => {
      const previous = await getOpened(tabId);
      if (previous && withoutHash(previous.cleaned) !== withoutHash(details.url)) {
        await sessionSet(openedKey(tabId), undefined);
      }
    });
  }, filter);

  chrome.webRequest.onBeforeRedirect.addListener((details) => {
    const navigation = navigations.get(details.tabId);
    if (!navigation || !details.redirectUrl) return;
    step(details.tabId, navigation, details.url, details.redirectUrl);
  }, filter);

  chrome.webRequest.onResponseStarted.addListener((details) => {
    reached(details.tabId, details.url);
  }, filter);

  chrome.webRequest.onCompleted.addListener((details) => {
    reached(details.tabId, details.url);
    finish(details.tabId);
  }, filter);

  // An abort is usually Chrome starting the same navigation over, so wait a
  // moment for the restart before calling it finished.
  chrome.webRequest.onErrorOccurred.addListener((details) => {
    const navigation = navigations.get(details.tabId);
    if (!navigation) return;
    clearTimeout(navigation.timer);
    navigation.timer = setTimeout(() => finish(details.tabId, details.error), ABORT_GRACE_MS);
  }, filter);

  chrome.tabs.onRemoved.addListener((tabId) => {
    finish(tabId, 'tab closed');
    serial(() => sessionSet(openedKey(tabId), undefined));
  });
}

countNetworkCleanups();
watchNavigations();

/* ------------------------------------------------------------------ *
 * Badge: a quiet "off" when the extension is not acting on this tab
 * ------------------------------------------------------------------ */

async function updateBadge(tabId, url) {
  if (typeof tabId !== 'number') return;
  const settings = await Settings.load();
  let off = !settings.enabled;
  if (!off && url) {
    try {
      off = Clean.isAllowlisted(new URL(url).hostname, settings.allowlist);
    } catch (e) { /* not a normal page */ }
  }
  try {
    await chrome.action.setBadgeText({ tabId: tabId, text: off ? 'off' : '' });
  } catch (e) { /* tab closed */ }
}

/* ------------------------------------------------------------------ *
 * Context menu
 * ------------------------------------------------------------------ */

const MENU_LINK = 'cleanurl-copy-link';
const MENU_PAGE = 'cleanurl-copy-page';

function createMenus() {
  if (!chrome.contextMenus) return; // Firefox for Android has no menus API
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create({
      id: MENU_LINK,
      title: 'Copy clean link',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: 'Copy clean page URL',
      contexts: ['page', 'action'],
    });
  });
}

/* Runs in the page: the service worker has no DOM to copy from. */
function copyInPage(text) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
  (document.body || document.documentElement).appendChild(field);
  const selection = document.getSelection();
  const previous = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (e) { /* fall through */ }
  field.remove();
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  if (!copied && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

async function copyClean(info, tab) {
  const source = info.menuItemId === MENU_LINK ? info.linkUrl : info.pageUrl || (tab && tab.url);
  if (!source || !tab || typeof tab.id !== 'number') return;
  const settings = await Settings.load();
  // A context-menu copy is an explicit request, so honour it even when the
  // automatic passes are switched off - only the allowlist still applies.
  const result = Clean.cleanUrl(source, Object.assign({}, settings, {
    enabled: true,
    cleanCopies: true,
  }));
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId || 0] },
      func: copyInPage,
      args: [result.url],
    });
    if (result.changed) recordCleaned('copy', 1);
    debugLog({
      kind: 'context menu', tabId: tab.id, from: source, to: result.url,
      removed: result.removed, kept: keptNames(result.url),
      note: result.unwrapped ? 'unwrapped a redirect' : '',
    });
  } catch (error) {
    console.error('[CleanURL] could not copy:', error);
  }
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(() => {
  createMenus();
  rebuildRules();
});

chrome.runtime.onStartup.addListener(() => {
  rebuildRules();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== Settings.AREA) return;
  rebuildRules();
  chrome.tabs.query({ active: true }, (tabs) => {
    void chrome.runtime.lastError;
    for (const tab of tabs || []) updateBadge(tab.id, tab.url);
  });
});

/*
 * Firefox for Android has no menus API at all. This runs at the top level, so
 * an unguarded reference throws while the background script is still loading
 * and takes everything after it down too - including the network rules, which
 * work there perfectly well.
 */
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(copyClean);
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    void chrome.runtime.lastError;
    if (tab) updateBadge(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) updateBadge(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  if (message.type === 'report') {
    recordCleaned(message.kind, message.count);
    // In the debug build, reports also say what was cleaned (see debugDetails
    // in the content scripts).
    const detail = message.detail;
    if (DEBUG && detail && typeof detail.from === 'string') {
      const tabId = sender.tab ? sender.tab.id : -1;
      debugLog({
        kind: detail.source || message.kind,
        tabId: tabId,
        from: detail.from,
        to: detail.to,
        removed: detail.removed || [],
        kept: keptNames(detail.to),
      });
      // The address bar pass on a top-level page continues the record the
      // network rules started for the popup.
      if (detail.source === 'address bar' && sender.frameId === 0 && tabId >= 0) {
        recordOpened(tabId, detail.from, detail.to, detail.removed || []);
      }
    }
    return undefined;
  }
  if (message.type === 'opened' && typeof message.tabId === 'number') {
    // Queued behind any pending write, so a popup opened mid-navigation
    // sees the finished record rather than the one being replaced.
    let record = null;
    serial(async () => { record = await getOpened(message.tabId); })
      .then(() => sendResponse(record));
    return true; // answered asynchronously
  }
  return undefined;
});

// The worker may be restarted without onInstalled/onStartup firing.
rebuildRules();
chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
