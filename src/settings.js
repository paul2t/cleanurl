/*
 * CleanURL - settings storage.
 *
 * Loaded after cleaner.js everywhere (service worker, content script, popup,
 * options) so DEFAULT_SETTINGS stays defined in exactly one place.
 */
'use strict';
(function (root) {
  const AREA = 'sync';
  const DEFAULTS = root.CleanURL.DEFAULT_SETTINGS;

  function toList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  /** Parses one-per-line or comma separated user input. */
  function parseList(raw) {
    return String(raw || '')
      .split(/[\s,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  /** Reduces user input like "https://www.Example.com/x" to "example.com". */
  function toDomain(raw) {
    let value = String(raw || '').trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    value = value.split('/')[0].split('?')[0].split('#')[0];
    value = value.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '');
    value = value.split('@').pop().split(':')[0];
    // "www." is dropped so allowlisting a pasted URL covers the whole site:
    // declarativeNetRequest matches subdomains downwards, never upwards.
    value = value.replace(/^www\./, '');
    // Single labels are allowed so "localhost" and intranet names work.
    return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(value) ? value : '';
  }

  function normalize(stored) {
    const settings = Object.assign({}, DEFAULTS, stored || {});
    for (const key of ['enabled', 'cleanAddressBar', 'cleanCopies',
                       'unwrapRedirects', 'removeAffiliate']) {
      settings[key] = typeof settings[key] === 'boolean' ? settings[key] : DEFAULTS[key];
    }
    settings.allowlist = toList(settings.allowlist).map(toDomain).filter(Boolean);
    settings.customParams = toList(settings.customParams);
    settings.keepParams = toList(settings.keepParams);
    return settings;
  }

  function load() {
    return new Promise((resolve) => {
      try {
        chrome.storage[AREA].get(null, (items) => {
          void chrome.runtime.lastError;
          resolve(normalize(items));
        });
      } catch (e) {
        resolve(normalize(null));
      }
    });
  }

  function save(patch) {
    return new Promise((resolve) => {
      try {
        chrome.storage[AREA].set(patch, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  async function setSiteAllowed(domain, allowed) {
    const settings = await load();
    const clean = toDomain(domain);
    if (!clean) return settings;
    const next = settings.allowlist.filter((d) => d !== clean);
    if (allowed) next.push(clean);
    await save({ allowlist: next });
    settings.allowlist = next;
    return settings;
  }

  root.CleanURLSettings = {
    AREA: AREA,
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    normalize: normalize,
    parseList: parseList,
    toDomain: toDomain,
    setSiteAllowed: setSiteAllowed,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
