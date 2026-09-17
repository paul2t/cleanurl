'use strict';
(function () {
  const Clean = globalThis.CleanURL;
  const Settings = globalThis.CleanURLSettings;

  const el = {
    enabled: document.getElementById('enabled'),
    siteEnabled: document.getElementById('site-enabled'),
    siteName: document.getElementById('site-name'),
    siteHint: document.getElementById('site-hint'),
    status: document.getElementById('status'),
    url: document.getElementById('url'),
    copy: document.getElementById('copy'),
    options: document.getElementById('options'),
    stats: document.getElementById('stats'),
    resetStats: document.getElementById('reset-stats'),
    diag: document.getElementById('diag'),
  };

  let settings = null;
  let tab = null;
  let host = '';
  let cleaned = null;

  function activeTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        void chrome.runtime.lastError;
        resolve((tabs && tabs[0]) || null);
      });
    });
  }

  function plural(n, singular, plural_) {
    return `${n} ${n === 1 ? singular : plural_ || singular + 's'}`;
  }

  function render() {
    el.enabled.checked = settings.enabled;

    if (!host) {
      el.siteName.textContent = 'No page';
      el.siteHint.textContent = 'Open a web page to use CleanURL here';
      el.siteEnabled.checked = false;
      el.siteEnabled.disabled = true;
      el.copy.disabled = true;
      el.status.textContent = '';
      el.url.hidden = true;
      return;
    }

    const allowed = Clean.isAllowlisted(host, settings.allowlist);
    el.siteName.textContent = host;
    el.siteEnabled.checked = !allowed;
    el.siteEnabled.disabled = !settings.enabled;
    el.siteHint.textContent = allowed ? 'Left alone on this site' : 'Cleaning URLs on this site';

    cleaned = Clean.cleanUrl(tab.url, Object.assign({}, settings, { enabled: true }));
    el.copy.disabled = false;

    if (!settings.enabled) {
      el.status.className = '';
      el.status.textContent = 'CleanURL is off.';
    } else if (allowed) {
      el.status.className = '';
      el.status.textContent = 'This site is on your allowlist.';
    } else if (cleaned.changed) {
      el.status.className = '';
      el.status.textContent = cleaned.removed.length
        ? `${plural(cleaned.removed.length, 'tracker')} in this URL: ${cleaned.removed.join(', ')}`
        : 'This URL can be shortened.';
    } else {
      el.status.className = 'clean';
      el.status.textContent = 'This URL is clean.';
    }

    el.url.hidden = !cleaned.changed;
    el.url.textContent = cleaned.url;
  }

  /*
   * Which layers are actually live on this tab. Content scripts only inject on
   * page load, and a strict page CSP can keep the in-page hook out, so when a
   * copy is not being cleaned this is the first thing worth knowing.
   */
  function renderDiagnostics() {
    if (!host || !tab) return;
    chrome.tabs.sendMessage(tab.id, { type: 'status' }, { frameId: 0 }, (response) => {
      void chrome.runtime.lastError;
      const hooks = response && response.hooks;
      let note = '';
      if (!response) {
        note = 'Not running on this tab yet. Reload the page: content scripts ' +
               'only start on load.';
      } else if (!hooks) {
        note = 'The in-page script did not run here. Reload the page; if that ' +
               'does not help, the page is blocking it. Cleaning share fields ' +
               'instead.';
      } else if (hooks.indexOf('!deps') !== -1) {
        note = 'The in-page script ran but could not load its rules. This is a ' +
               'bug in the extension, not the page.';
      } else if (hooks.indexOf('!clipboard') !== -1) {
        note = 'This page refused the clipboard hook. Cleaning share fields ' +
               'instead.';
      } else if (hooks.indexOf('clipboard') === -1) {
        note = 'No clipboard API on this page. Cleaning share fields instead.';
      }
      el.diag.hidden = !note;
      el.diag.textContent = note;
    });
  }

  function renderStats() {
    chrome.storage.local.get({ cleanedUrls: 0, cleanedCopies: 0 }, (stored) => {
      void chrome.runtime.lastError;
      const urls = stored.cleanedUrls || 0;
      const copies = stored.cleanedCopies || 0;
      el.stats.textContent = urls || copies
        ? `${plural(urls, 'link')} and ${plural(copies, 'copy', 'copies')} cleaned`
        : 'No cleanups counted yet';
    });
  }

  el.enabled.addEventListener('change', async () => {
    await Settings.save({ enabled: el.enabled.checked });
    settings = await Settings.load();
    render();
  });

  el.siteEnabled.addEventListener('change', async () => {
    settings = await Settings.setSiteAllowed(host, !el.siteEnabled.checked);
    render();
  });

  el.copy.addEventListener('click', async () => {
    if (!cleaned) return;
    try {
      await navigator.clipboard.writeText(cleaned.url);
      el.copy.textContent = 'Copied';
      setTimeout(() => { el.copy.textContent = 'Copy clean link'; }, 1200);
    } catch (e) {
      el.copy.textContent = 'Copy failed';
    }
  });

  el.options.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  el.resetStats.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.storage.local.set({ cleanedUrls: 0, cleanedCopies: 0 }, renderStats);
  });

  (async function init() {
    settings = await Settings.load();
    tab = await activeTab();
    if (tab && tab.url) {
      try {
        const parsed = new URL(tab.url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') host = parsed.hostname;
      } catch (e) { /* internal page */ }
    }
    render();
    renderStats();
    renderDiagnostics();
  })();
})();
