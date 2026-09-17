/*
 * CleanURL - URL rewriting logic.
 *
 * Pure, synchronous and dependency-free (beyond CLEANURL_RULES) so the same
 * code can run in the service worker, in an isolated content script, in the
 * page's main world and under Node for the tests.
 */
'use strict';
(function (root) {
  const RULES = root.CLEANURL_RULES;

  const DEFAULT_SETTINGS = {
    enabled: true,
    cleanAddressBar: true,
    cleanCopies: true,
    unwrapRedirects: true,
    removeAffiliate: false,
    allowlist: [],      // domains to leave completely alone
    customParams: [],   // extra names; "foo_*" is treated as a wildcard
    keepParams: [],     // names never removed, even if a rule matches
  };

  /* ------------------------------------------------------------------ *
   * Host helpers
   * ------------------------------------------------------------------ */

  function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
  }

  /** True when `host` is `domain` or a subdomain of it. */
  function hostMatches(host, domain) {
    const h = normalizeHost(host);
    const d = normalizeHost(domain);
    return !!d && (h === d || h.endsWith('.' + d));
  }

  const reCache = new Map();
  function toRegExp(source) {
    let re = reCache.get(source);
    if (!re) {
      try {
        re = new RegExp(source, 'i');
      } catch (e) {
        re = /(?!)/; // never matches
      }
      reCache.set(source, re);
    }
    return re;
  }

  function ruleMatchesHost(rule, host) {
    if (rule.hosts && rule.hosts.some((d) => hostMatches(host, d))) return true;
    if (rule.hostRe && toRegExp(rule.hostRe).test(normalizeHost(host))) return true;
    return false;
  }

  /*
   * Origins Chrome reserves for itself: extensions may not run content scripts
   * there and declarativeNetRequest rules do not apply, so nothing this
   * extension does can reach them. Worth naming, because the symptom is
   * identical to a bug and the advice for a bug ("reload the page") is wrong.
   */
  const BROWSER_RESTRICTED = [
    { host: 'chromewebstore.google.com' },
    { host: 'chrome.google.com', path: '/webstore' },
  ];

  function isBrowserRestricted(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return false;
    }
    return BROWSER_RESTRICTED.some((entry) => hostMatches(parsed.hostname, entry.host) &&
      (!entry.path || parsed.pathname.startsWith(entry.path)));
  }

  function isAllowlisted(host, allowlist) {
    if (!allowlist || !allowlist.length) return false;
    return allowlist.some((d) => hostMatches(host, d));
  }

  /** "utm_*" -> /^utm_.*$/i, anything else is matched literally. */
  function wildcardToRegExp(pattern) {
    const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return toRegExp('^' + escaped.replace(/\\\*/g, '.*') + '$');
  }

  /* ------------------------------------------------------------------ *
   * Parameter matching
   * ------------------------------------------------------------------ */

  const matcherCache = new Map();

  function settingsKey(settings) {
    return [
      settings.removeAffiliate ? 1 : 0,
      (settings.customParams || []).join(','),
      (settings.keepParams || []).join(','),
    ].join('|');
  }

  /** Builds `name => shouldRemove` for a given host. */
  function buildMatcher(host, settings) {
    // A NUL separator cannot occur in a hostname or a settings key, so the
    // cache key is unambiguous. Written as an escape: a literal NUL byte in
    // the source makes git treat the file as binary.
    const key = normalizeHost(host) + '\u0000' + settingsKey(settings);
    const cached = matcherCache.get(key);
    if (cached) return cached;

    const exact = new Set();
    const regexes = [];
    const add = (list) => {
      for (const name of list || []) exact.add(String(name).toLowerCase());
    };

    add(RULES.globalParams);
    for (const source of RULES.globalPatterns) regexes.push(toRegExp(source));
    if (settings.removeAffiliate) add(RULES.affiliateParams);

    for (const site of RULES.sites) {
      if (!ruleMatchesHost(site, host)) continue;
      add(site.params);
      for (const source of site.patterns || []) regexes.push(toRegExp(source));
      if (settings.removeAffiliate) add(site.affiliate);
    }

    for (const custom of settings.customParams || []) {
      const name = String(custom).trim();
      if (!name) continue;
      if (name.includes('*')) regexes.push(wildcardToRegExp(name));
      else exact.add(name.toLowerCase());
    }

    const keep = new Set(
      (settings.keepParams || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean)
    );

    const matcher = (name) => {
      const lower = String(name).toLowerCase();
      if (keep.has(lower)) return false;
      if (exact.has(lower)) return true;
      return regexes.some((re) => re.test(name));
    };

    if (matcherCache.size > 200) matcherCache.clear();
    matcherCache.set(key, matcher);
    return matcher;
  }

  /* ------------------------------------------------------------------ *
   * Query string rewriting
   * ------------------------------------------------------------------ */

  function decodeName(raw) {
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch (e) {
      return raw;
    }
  }

  /**
   * Filters `query` (no leading "?") keeping each surviving pair byte for
   * byte, so we never re-encode parts of the URL we are not removing.
   */
  function filterQuery(query, matcher, removed) {
    if (!query) return query;
    const kept = [];
    for (const pair of query.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const name = decodeName(eq === -1 ? pair : pair.slice(0, eq));
      if (matcher(name)) removed.push(name);
      else kept.push(pair);
    }
    return kept.join('&');
  }

  /** Only treat a fragment as tracker-bearing when it is a pure query string. */
  function isQueryLikeFragment(fragment) {
    return !!fragment && /^[^/?#]*=[^#]*$/.test(fragment) && !fragment.includes(' ');
  }

  /* ------------------------------------------------------------------ *
   * Redirect unwrapping
   * ------------------------------------------------------------------ */

  function parseHttpUrl(value) {
    if (!value) return null;
    let url = null;
    try {
      url = new URL(value);
    } catch (e) {
      try {
        url = new URL(decodeURIComponent(value));
      } catch (e2) {
        return null;
      }
    }
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  }

  function unwrapRedirect(url, depth) {
    if (depth > 3) return url;
    for (const rule of RULES.redirects) {
      if (!ruleMatchesHost(rule, url.hostname)) continue;
      if (rule.paths && !rule.paths.some((p) => url.pathname === p || url.pathname.startsWith(p))) {
        continue;
      }
      if (rule.rawQueryIsUrl) {
        const target = parseHttpUrl(decodeName(url.search.slice(1)));
        if (target) return unwrapRedirect(target, depth + 1);
      }
      for (const param of rule.params || []) {
        const target = parseHttpUrl(url.searchParams.get(param));
        if (target) return unwrapRedirect(target, depth + 1);
      }
    }
    return url;
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  /**
   * @returns {{url: string, changed: boolean, removed: string[], unwrapped: boolean}}
   *          `url` is the original string unchanged when nothing matched, so
   *          URL normalisation never leaks into text the user copied.
   */
  function cleanUrl(input, options) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, options || {});
    const result = { url: input, changed: false, removed: [], unwrapped: false };
    if (!settings.enabled || typeof input !== 'string' || !input) return result;

    let url;
    try {
      url = new URL(input);
    } catch (e) {
      return result;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return result;
    if (isAllowlisted(url.hostname, settings.allowlist)) return result;

    if (settings.unwrapRedirects) {
      const target = unwrapRedirect(url, 0);
      if (target !== url) {
        if (isAllowlisted(target.hostname, settings.allowlist)) return result;
        url = target;
        result.unwrapped = true;
      }
    }

    const matcher = buildMatcher(url.hostname, settings);
    const removed = [];

    const query = filterQuery(url.search.slice(1), matcher, removed);
    if (removed.length) url.search = query ? '?' + query : '';

    const fragment = url.hash.slice(1);
    if (isQueryLikeFragment(fragment)) {
      const before = removed.length;
      const cleanedFragment = filterQuery(fragment, matcher, removed);
      if (removed.length > before) url.hash = cleanedFragment ? '#' + cleanedFragment : '';
    }

    let pathChanged = false;
    for (const rule of RULES.pathRules) {
      if (!ruleMatchesHost(rule, url.hostname)) continue;
      const next = url.pathname.replace(toRegExp(rule.re), rule.replace);
      if (next !== url.pathname) {
        url.pathname = next || '/';
        pathChanged = true;
      }
    }

    result.changed = result.unwrapped || removed.length > 0 || pathChanged;
    result.removed = removed;
    if (result.changed) result.url = url.href;
    return result;
  }

  /* Matches an http(s) URL inside arbitrary text. */
  const URL_IN_TEXT = /https?:\/\/[^\s<>"'`\\|^{}[\]]+/gi;
  const CLOSERS = { ')': '(', ']': '[', '}': '{' };

  /** Drops sentence punctuation that the greedy match swallowed. */
  function trimTrailingPunctuation(candidate) {
    let end = candidate.length;
    while (end > 0) {
      const ch = candidate[end - 1];
      if ('.,;:!?"\''.includes(ch)) {
        end--;
        continue;
      }
      if (CLOSERS[ch]) {
        const head = candidate.slice(0, end);
        const opens = head.split(CLOSERS[ch]).length - 1;
        const closes = head.split(ch).length - 1;
        if (closes > opens) {
          end--;
          continue;
        }
      }
      break;
    }
    return candidate.slice(0, end);
  }

  /**
   * Rewrites every URL found in a block of text, leaving everything else
   * (including surrounding punctuation) byte for byte identical.
   *
   * @returns {{text: string, changed: boolean, count: number, removed: string[]}}
   *          `removed` is every parameter name dropped, in order and without
   *          repeats, so a caller can say what it actually did.
   */
  function cleanText(text, options) {
    if (typeof text !== 'string' || text.indexOf('http') === -1) {
      return { text: text, changed: false, count: 0, removed: [] };
    }
    let count = 0;
    const removed = [];
    const output = text.replace(URL_IN_TEXT, (match) => {
      const candidate = trimTrailingPunctuation(match);
      const tail = match.slice(candidate.length);
      const cleaned = cleanUrl(candidate, options);
      if (!cleaned.changed) return match;
      count++;
      for (const name of cleaned.removed) {
        if (removed.indexOf(name) === -1) removed.push(name);
      }
      return cleaned.url + tail;
    });
    return { text: output, changed: count > 0, count: count, removed: removed };
  }

  /**
   * Cleans hrefs and text nodes of an HTML fragment. Needs a DOM, so it is a
   * no-op in the service worker.
   */
  function cleanHtml(html, options) {
    if (typeof html !== 'string' || !html) return { html: html, changed: false };
    if (typeof root.DOMParser === 'undefined') return { html: html, changed: false };
    let doc;
    try {
      doc = new root.DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return { html: html, changed: false };
    }
    let changed = false;

    for (const el of doc.querySelectorAll('a[href], area[href]')) {
      const cleaned = cleanUrl(el.getAttribute('href'), options);
      if (cleaned.changed) {
        el.setAttribute('href', cleaned.url);
        changed = true;
      }
    }

    const walker = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      const cleaned = cleanText(node.nodeValue, options);
      if (cleaned.changed) {
        node.nodeValue = cleaned.text;
        changed = true;
      }
    }

    return { html: changed ? doc.body.innerHTML : html, changed: changed };
  }

  const API = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    cleanUrl: cleanUrl,
    cleanText: cleanText,
    cleanHtml: cleanHtml,
    hostMatches: hostMatches,
    isAllowlisted: isAllowlisted,
    isBrowserRestricted: isBrowserRestricted,
    normalizeHost: normalizeHost,
  };

  root.CleanURL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : self);
