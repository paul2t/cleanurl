/*
 * CleanURL - page world.
 *
 * Runs in the page's own JavaScript context (manifest `world: "MAIN"`) because
 * that is the only place we can see a share button call
 * navigator.clipboard.writeText(). An isolated content script would patch its
 * own copy of the API and the page would never notice. That call fires no
 * `copy` event, so nothing else can catch it either - which makes the
 * "clipboard" hook below the one that matters for share panels.
 *
 * Each hook is installed independently and the result is recorded on
 * <html data-cleanurl-page-world> as it goes, so that:
 *   - a page that refuses one patch (freezing built-ins, say) still gets the
 *     others, and
 *   - the absence of the attribute means this script genuinely never ran,
 *     rather than "it threw somewhere in the middle".
 * A name prefixed with "!" is a hook this page refused.
 *
 * Every patch is also wrapped at call time, so a fault in our code can only
 * ever mean "the link was not cleaned", never "the site's copy button broke".
 */
'use strict';
(function () {
  /*
   * Mark before anything else, the dependency check included. "This script
   * never ran" and "it ran but its dependencies were missing" look identical
   * from outside otherwise - no marker, no globals - and they are entirely
   * different faults: the first is the page or the injection, the second is a
   * broken manifest file list.
   */
  const installed = ['running'];

  function markInstalled() {
    try {
      document.documentElement.setAttribute('data-cleanurl-page-world', installed.join(','));
    } catch (e) {
      // No documentElement yet: try again once the document exists.
      try {
        document.addEventListener('DOMContentLoaded', markInstalled, { once: true });
      } catch (e2) { /* nothing more we can do */ }
    }
  }

  markInstalled();

  const Clean = window.CleanURL;
  const CopyGuard = window.CleanURLCopyGuard;
  // Hand the page back a pristine global object.
  try {
    delete window.CleanURL;
    delete window.CLEANURL_RULES;
    delete window.CleanURLCopyGuard;
  } catch (e) { /* non-configurable, never mind */ }
  if (!Clean || !CopyGuard) {
    installed.push('!deps');
    markInstalled();
    return;
  }

  let settings = Object.assign({}, Clean.DEFAULT_SETTINGS);

  document.addEventListener('cleanurl:config', (event) => {
    try {
      const parsed = JSON.parse(event.detail);
      // A null or malformed payload must not wipe out the working settings.
      if (parsed && typeof parsed === 'object') settings = parsed;
    } catch (e) { /* keep previous settings */ }
  }, true);

  /* ---------------------------------------------------------------- *
   * Hook bookkeeping
   * ---------------------------------------------------------------- */

  /**
   * @param {function(): boolean} apply installs the patch and returns false if
   *        the API was not there to patch.
   */
  function hook(name, apply) {
    let outcome;
    try {
      outcome = apply() === false ? null : name;
    } catch (error) {
      // A page that freezes built-ins throws here in strict mode. Record it
      // and carry on rather than losing every later hook.
      outcome = '!' + name;
    }
    if (outcome) installed.push(outcome);
    markInstalled();
  }

  // The isolated world may already be waiting with our settings.
  try {
    document.dispatchEvent(new CustomEvent('cleanurl:hello'));
  } catch (e) { /* nothing listening yet; it will push instead */ }

  function report(kind, count) {
    try {
      document.dispatchEvent(new CustomEvent('cleanurl:report', {
        detail: JSON.stringify({ kind: kind, count: count }),
      }));
    } catch (e) { /* page tore down the event constructor */ }
  }

  function copying() {
    return !!settings && settings.enabled && settings.cleanCopies;
  }

  /** Returns the rewritten text, or null when there was nothing to do. */
  function cleanCopyText(value) {
    if (!copying()) return null;
    const result = Clean.cleanText(String(value), settings);
    return result.changed ? result : null;
  }

  /** Makes a patched function look native to feature-detecting page code. */
  function mask(patched, original) {
    try {
      Object.defineProperty(patched, 'name', { value: original.name, configurable: true });
      Object.defineProperty(patched, 'length', { value: original.length, configurable: true });
      patched.toString = function toString() {
        return Function.prototype.toString.call(original);
      };
    } catch (e) { /* best effort */ }
    return patched;
  }

  const TEXT_TYPES = ['text/plain', 'text/uri-list'];

  /* ---------------------------------------------------------------- *
   * navigator.clipboard - what "Copy link" buttons actually call
   * ---------------------------------------------------------------- */

  hook('clipboard', () => {
    const proto = window.Clipboard && window.Clipboard.prototype;
    if (!proto || typeof proto.writeText !== 'function') return false;
    const original = proto.writeText;
    proto.writeText = mask(function writeText(text) {
      let value = text;
      try {
        const result = cleanCopyText(text);
        if (result) {
          value = result.text;
          report('copy', result.count);
        }
      } catch (e) { /* copy the original rather than nothing */ }
      return original.call(this, value);
    }, original);
    // A frozen prototype throws in strict mode, but verify regardless: the
    // whole point of this hook is knowing whether it really took.
    return proto.writeText !== original;
  });

  /*
   * ClipboardItem values may be promises, which lets us rebuild the item
   * synchronously and keep the caller inside its user-gesture window. Reading
   * the blobs first would make the write fail with a NotAllowedError.
   */
  function cleanClipboardItem(item) {
    if (!item || !item.types) return item;
    const types = Array.from(item.types);
    const interesting = types.filter((t) => TEXT_TYPES.includes(t) || t === 'text/html');
    if (!interesting.length) return item;

    const data = {};
    for (const type of types) {
      const blob = item.getType(type);
      if (TEXT_TYPES.includes(type)) {
        data[type] = blob.then((b) => b.text()).then((text) => {
          const result = cleanCopyText(text);
          if (!result) return new Blob([text], { type: type });
          report('copy', result.count);
          return new Blob([result.text], { type: type });
        });
      } else if (type === 'text/html') {
        data[type] = blob.then((b) => b.text()).then((html) => {
          const result = copying() ? Clean.cleanHtml(html, settings) : null;
          return new Blob([result && result.changed ? result.html : html], { type: type });
        });
      } else {
        data[type] = blob;
      }
    }
    return new ClipboardItem(data);
  }

  hook('clipboard-write', () => {
    const proto = window.Clipboard && window.Clipboard.prototype;
    if (!proto || typeof proto.write !== 'function' || !window.ClipboardItem) return false;
    const original = proto.write;
    proto.write = mask(function write(items) {
      let payload = items;
      try {
        if (copying()) payload = Array.from(items || []).map(cleanClipboardItem);
      } catch (e) {
        payload = items;
      }
      return original.call(this, payload);
    }, original);
    return proto.write !== original;
  });

  /* ---------------------------------------------------------------- *
   * DataTransfer.setData - copy handlers and drag and drop
   * ---------------------------------------------------------------- */

  let originalSetData = null;

  hook('setdata', () => {
    const proto = window.DataTransfer && window.DataTransfer.prototype;
    if (!proto || typeof proto.setData !== 'function') return false;
    const native = proto.setData;
    proto.setData = mask(function setData(format, data) {
      let value = data;
      try {
        const kind = String(format).toLowerCase();
        if (copying()) {
          if (kind === 'text' || kind === 'url' || TEXT_TYPES.includes(kind)) {
            const result = cleanCopyText(data);
            if (result) {
              value = result.text;
              report('copy', result.count);
            }
          } else if (kind === 'text/html') {
            const result = Clean.cleanHtml(String(data), settings);
            if (result.changed) value = result.html;
          }
        }
      } catch (e) { /* fall back to the original payload */ }
      return native.call(this, format, value);
    }, native);
    if (proto.setData === native) return false;
    originalSetData = native;
    return true;
  });

  /* ---------------------------------------------------------------- *
   * Plain Ctrl+C, and pages that write their own copy payload
   * ---------------------------------------------------------------- */

  hook('copyevent', () => {
    CopyGuard.install({
      getSettings: () => settings,
      report: report,
      // Bypass our own setData patch so one copy is not counted twice.
      write: (data, type, value) => {
        if (typeof originalSetData === 'function') originalSetData.call(data, type, value);
        else data.setData(type, value);
      },
    });
    return true;
  });

  /* ---------------------------------------------------------------- *
   * Web Share
   * ---------------------------------------------------------------- */

  hook('share', () => {
    const proto = window.Navigator && window.Navigator.prototype;
    if (!proto || typeof proto.share !== 'function') return false;
    const original = proto.share;
    proto.share = mask(function share(data) {
      let payload = data;
      try {
        if (copying() && data && typeof data === 'object') {
          const next = Object.assign({}, data);
          let changed = false;
          if (typeof next.url === 'string') {
            const result = Clean.cleanUrl(next.url, settings);
            if (result.changed) { next.url = result.url; changed = true; }
          }
          if (typeof next.text === 'string') {
            const result = Clean.cleanText(next.text, settings);
            if (result.changed) { next.text = result.text; changed = true; }
          }
          if (changed) {
            payload = next;
            report('copy', 1);
          }
        }
      } catch (e) { /* share the original */ }
      return original.call(this, payload);
    }, original);
    return proto.share !== original;
  });

  /* ---------------------------------------------------------------- *
   * Single page app navigations that re-add trackers
   * ---------------------------------------------------------------- */

  hook('history', () => {
    const proto = window.History && window.History.prototype;
    if (!proto) return false;
    let patched = false;
    for (const method of ['pushState', 'replaceState']) {
      const original = proto[method];
      if (typeof original !== 'function') continue;
      proto[method] = mask(function (state, title, url) {
        let target = url;
        try {
          if (settings && settings.enabled && settings.cleanAddressBar &&
              target !== undefined && target !== null) {
            const absolute = new URL(String(target), location.href);
            const result = Clean.cleanUrl(absolute.href, Object.assign({}, settings, {
              unwrapRedirects: false,
            }));
            if (result.changed) {
              target = result.url;
              report('url', result.removed.length || 1);
            }
          }
        } catch (e) { target = url; }
        return original.call(this, state, title, target);
      }, original);
      if (proto[method] !== original) patched = true;
    }
    return patched;
  });
})();
