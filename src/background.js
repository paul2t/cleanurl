/*
 * CleanURL - service worker.
 *
 * Compiles the rule database into declarativeNetRequest rules so trackers are
 * stripped from the request line before the navigation leaves the browser,
 * and hosts the "Copy clean link" context menu.
 */
'use strict';

importScripts('rules.js', 'cleaner.js', 'settings.js');

const RULES = globalThis.CLEANURL_RULES;
const Clean = globalThis.CleanURL;
const Settings = globalThis.CleanURLSettings;

/* Only top-level navigations: those are the URLs the user sees, shares and
 * pastes. Rewriting sub-resources buys little and breaks more. */
const RESOURCE_TYPES = ['main_frame'];

const PRIORITY = { allow: 100, site: 2, global: 1 };

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

countNetworkCleanups();

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

chrome.contextMenus.onClicked.addListener(copyClean);

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    void chrome.runtime.lastError;
    if (tab) updateBadge(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) updateBadge(tabId, tab.url);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'report') recordCleaned(message.kind, message.count);
});

// The worker may be restarted without onInstalled/onStartup firing.
rebuildRules();
chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
