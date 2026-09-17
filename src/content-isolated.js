/*
 * CleanURL - isolated world.
 *
 * Owns the two things the page world cannot do: reading extension settings and
 * talking to the service worker. Also does the first address bar pass, where
 * waiting for settings costs nothing and guarantees we never strip a parameter
 * on a site the user allowlisted.
 *
 * It installs the copy guard as well. This world always runs, so even where a
 * page's CSP keeps the main-world script out, Ctrl+C and pages that write
 * their own copy payload are still cleaned.
 */
'use strict';
(function () {
  const Clean = globalThis.CleanURL;
  const Settings = globalThis.CleanURLSettings;
  const CopyGuard = globalThis.CleanURLCopyGuard;
  const FieldGuard = globalThis.CleanURLFieldGuard;
  if (!Clean || !Settings || !CopyGuard) return;

  let settings = Object.assign({}, Clean.DEFAULT_SETTINGS);
  const isTopFrame = window.top === window;

  function pushConfig() {
    try {
      document.dispatchEvent(new CustomEvent('cleanurl:config', {
        detail: JSON.stringify(settings),
      }));
    } catch (e) { /* document gone */ }
  }

  function send(message) {
    try {
      chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
    } catch (e) { /* extension reloaded under us */ }
  }

  /*
   * Both content scripts start at document_start, but this one has to wait for
   * storage before it can answer. The page world says hello as soon as it is
   * ready; whichever of the two is late, the config still gets through.
   */
  const ready = Settings.load().then((loaded) => {
    settings = loaded;
  });

  document.addEventListener('cleanurl:hello', () => {
    ready.then(pushConfig);
  }, true);

  document.addEventListener('cleanurl:report', (event) => {
    let payload;
    try {
      payload = JSON.parse(event.detail);
    } catch (e) {
      return;
    }
    send({ type: 'report', kind: payload.kind, count: payload.count });
  }, true);

  CopyGuard.install({
    getSettings: () => settings,
    report: (kind, count) => send({ type: 'report', kind: kind, count: count }),
  });

  /**
   * Which hooks the main-world script managed to install, or null if it never
   * ran at all (a page CSP can keep it out).
   */
  function pageWorldHooks() {
    try {
      const value = document.documentElement.getAttribute('data-cleanurl-page-world');
      return value === null ? null : value.split(',').filter(Boolean);
    } catch (e) {
      return null;
    }
  }

  /*
   * A share button that calls navigator.clipboard.writeText() fires no copy
   * event, so without the clipboard hook nothing above can see it. Falling
   * back to cleaning the share field itself is the only option left - but only
   * then, since it costs a scan on every click.
   */
  let fieldGuard = false;
  function installFallbackIfNeeded() {
    if (fieldGuard || !FieldGuard) return;
    const hooks = pageWorldHooks();
    if (hooks && hooks.indexOf('clipboard') !== -1) return;
    try {
      FieldGuard.install({ getSettings: () => settings });
      fieldGuard = true;
    } catch (e) { /* a fallback must never take the rest down with it */ }
  }

  /*
   * declarativeNetRequest has already rewritten the request for a normal
   * navigation. This catches what it cannot express - wildcard parameter
   * names, path rules - and anything the page added after load.
   *
   * Redirect unwrapping is deliberately off: replaceState cannot change the
   * origin, and showing a different origin than the one that was loaded would
   * be a lie anyway.
   */
  function cleanAddressBar() {
    if (!isTopFrame || !settings.enabled || !settings.cleanAddressBar) return;
    const current = location.href;
    const result = Clean.cleanUrl(current, Object.assign({}, settings, {
      unwrapRedirects: false,
    }));
    if (!result.changed) return;
    try {
      if (new URL(result.url).origin !== location.origin) return;
      history.replaceState(history.state, '', result.url);
      send({ type: 'report', kind: 'url', count: result.removed.length || 1 });
    } catch (e) { /* some pages block history access */ }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== Settings.AREA) return;
    Settings.load().then((next) => {
      settings = next;
      pushConfig();
      cleanAddressBar();
    });
  });

  // Lets the popup show which layers are actually live on this page.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // A subframe cannot answer for the page: it has its own document, and a
    // sandboxed one cannot host the main-world script at all.
    if (!message || message.type !== 'status' || !isTopFrame) return undefined;
    sendResponse({
      url: location.href,
      hooks: pageWorldHooks(),
      fieldGuard: fieldGuard,
      copyGuard: true,
    });
    return undefined;
  });

  ready.then(() => {
    pushConfig();
    cleanAddressBar();
    // By DOMContentLoaded the main-world script has long since run, so its
    // marker is a reliable answer either way.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        cleanAddressBar();
        installFallbackIfNeeded();
      }, { once: true });
    } else {
      installFallbackIfNeeded();
    }
  });
})();
