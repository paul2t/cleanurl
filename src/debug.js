/*
 * CleanURL - debug log viewer.
 *
 * Only reachable in the debug build (this folder loaded unpacked): the popup
 * links here only when Settings.isDebugBuild() is true, and nothing in the
 * manifest or a packaged page refers to this file, so packages leave it out.
 * The log itself is written by src/background.js into storage.session.
 */
'use strict';
(function () {
  const LOG_KEY = 'debugLog';
  const el = {
    log: document.getElementById('log'),
    count: document.getElementById('count'),
    filter: document.getElementById('filter'),
    keptOnly: document.getElementById('kept-only'),
    copy: document.getElementById('copy'),
    clear: document.getElementById('clear'),
  };
  let entries = [];

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function host(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }

  function time(stamp) {
    return new Date(stamp).toLocaleTimeString([], { hour12: false });
  }

  function matches(entry, query) {
    if (el.keptOnly.checked && !(entry.kept && entry.kept.length)) return false;
    if (!query) return true;
    const haystack = [entry.from, entry.to, entry.kind, entry.note,
      ...(entry.removed || []), ...(entry.kept || [])].join(' ').toLowerCase();
    return haystack.includes(query);
  }

  /*
   * The URL as text, with each "name=value" whose name was removed marked in
   * red. Matches after "&" as well as "?", so a parameter that sits in the
   * path (youtu.be/ID&si=…) is marked too.
   */
  function markedUrl(url, removed) {
    const box = node('span', 'value');
    const gone = new Set(removed || []);
    let last = 0;
    for (const match of String(url || '').matchAll(/[?&]([^?&#=]+)(=[^&#]*)?/g)) {
      let name = match[1];
      try {
        name = decodeURIComponent(name.replace(/\+/g, ' '));
      } catch (e) { /* keep it as written */ }
      if (!gone.has(name)) continue;
      const start = match.index + 1; // the separator stays plain
      box.append(url.slice(last, start), node('span', 'gone', match[0].slice(1)));
      last = match.index + match[0].length;
    }
    box.append(String(url || '').slice(last));
    return box;
  }

  function names(list, className) {
    const box = node('div', 'names');
    for (const name of list) box.appendChild(node('span', 'name ' + className, name));
    return box;
  }

  function render() {
    const query = el.filter.value.trim().toLowerCase();
    const shown = entries.filter((entry) => matches(entry, query)).reverse();
    el.count.textContent = shown.length === entries.length
      ? `${entries.length} entries`
      : `${shown.length} of ${entries.length} entries`;
    el.log.textContent = '';
    if (!shown.length) {
      el.log.appendChild(node('li', 'empty', entries.length
        ? 'Nothing matches the filter.'
        : 'Nothing logged yet. Open a link with a query string, or copy one.'));
      return;
    }
    for (const entry of shown) {
      const item = node('li');
      const meta = node('div', 'meta');
      meta.append(node('span', 'time', time(entry.time)), node('span', 'kind', entry.kind),
        node('span', 'host', host(entry.to || entry.from)));
      if (entry.note) meta.appendChild(node('span', 'note', entry.note));
      item.appendChild(meta);

      if ((entry.removed && entry.removed.length) || (entry.kept && entry.kept.length)) {
        const box = names(entry.removed || [], 'removed');
        for (const name of entry.kept || []) box.appendChild(node('span', 'name kept', name));
        item.appendChild(box);
      }

      const urls = node('div', 'urls');
      const line = (label, url) => urls.append(node('span', 'label', label),
        markedUrl(url, entry.removed));
      line('from', entry.from);
      for (const hop of entry.redirects || []) line('↳ ' + hop.by, hop.to);
      const lastHop = (entry.redirects || []).slice(-1)[0];
      // Skip "to" when it would only repeat the line above it.
      if (entry.to && entry.to !== entry.from && !(lastHop && lastHop.to === entry.to)) {
        line('to', entry.to);
      }
      item.appendChild(urls);
      el.log.appendChild(item);
    }
  }

  function load() {
    chrome.storage.session.get(LOG_KEY).then((stored) => {
      entries = stored[LOG_KEY] || [];
      render();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[LOG_KEY]) {
      entries = changes[LOG_KEY].newValue || [];
      render();
    }
  });

  el.filter.addEventListener('input', render);
  el.keptOnly.addEventListener('change', render);

  el.clear.addEventListener('click', () => {
    chrome.storage.session.remove(LOG_KEY);
  });

  el.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
      el.copy.textContent = 'Copied';
    } catch (e) {
      el.copy.textContent = 'Copy failed';
    }
    setTimeout(() => { el.copy.textContent = 'Copy as JSON'; }, 1200);
  });

  load();
})();
