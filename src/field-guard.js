/*
 * CleanURL - share field fallback.
 *
 * A share panel builds its link into an <input> and its Copy button hands that
 * string straight to navigator.clipboard.writeText(). That call fires no
 * `copy` event, so the only way to catch it is the main-world hook in
 * content-main.js.
 *
 * When that hook could not be installed, this is what is left: clean the field
 * itself, so whatever the page copies out of it is already clean. The isolated
 * world only installs this after finding the clipboard hook missing, so it
 * costs nothing on a page where the hook works.
 *
 * Which fields are fair game is the whole design problem. Rewriting a URL
 * someone is typing, or is about to submit, would be a real bug. So a field is
 * only touched when it is clearly a display of a link rather than input:
 *
 *   - read-only or disabled, or
 *   - standalone (not part of a <form>) and never typed in, clicked on or
 *     pasted into by the user.
 *
 * and never while it is the focused element.
 */
'use strict';
(function (root) {
  const Clean = root.CleanURL;
  const CopyGuard = root.CleanURLCopyGuard;

  // A panel opens in response to a click and may render over several frames.
  const SCAN_DELAYS = [0, 150, 500, 1200];
  // Only one of those passes walks shadow trees; it is the expensive one.
  const DEEP_SCAN_AT = 500;
  const NODE_BUDGET = 20000;

  const touched = typeof WeakSet === 'function' ? new WeakSet() : null;

  function isField(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  function noteUserInput(event) {
    // Synthetic events do not count, and neither does focus on its own: a
    // dialog that autofocuses its URL field has not been typed in.
    if (!touched || !event.isTrusted || !isField(event.target)) return;
    touched.add(event.target);
  }

  function isDisplayField(el, active) {
    if (el === active) return false;
    if (el.readOnly || el.disabled) return true;
    if (el.form) return false;
    return !touched || !touched.has(el);
  }

  /** Walks open shadow trees as well, within a node budget. */
  function collectDeep(out, budget) {
    const scopes = [document];
    while (scopes.length && budget.n > 0) {
      const scope = scopes.shift();
      let all;
      try {
        all = scope.querySelectorAll('*');
      } catch (e) {
        continue;
      }
      for (const el of all) {
        if (--budget.n <= 0) return;
        if (isField(el)) out.push(el);
        else if (el.shadowRoot) scopes.push(el.shadowRoot);
      }
    }
  }

  function cleanField(el, settings, active) {
    let value;
    try {
      if (!isField(el) || !isDisplayField(el, active)) return false;
      value = el.value;
    } catch (e) {
      return false;
    }
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;

    const result = Clean.cleanUrl(trimmed, Object.assign({}, settings, {
      unwrapRedirects: false,
    }));
    if (!result.changed) return false;
    try {
      // Assigning .value fires no input/change event, so the page is none the
      // wiser and its own listeners do not re-run.
      el.value = value.replace(trimmed, result.url);
      return true;
    } catch (e) {
      return false;
    }
  }

  function install(options) {
    const getSettings = options.getSettings;
    const onCleaned = options.onCleaned || function () {};
    let scheduled = false;

    function scan(deep) {
      let settings;
      try {
        settings = getSettings();
      } catch (e) {
        return 0;
      }
      if (!settings || !settings.enabled || !settings.cleanCopies) return 0;

      const fields = [];
      if (deep) {
        collectDeep(fields, { n: NODE_BUDGET });
      } else {
        try {
          for (const el of document.querySelectorAll('input,textarea')) fields.push(el);
        } catch (e) { /* no document yet */ }
      }

      let active = null;
      try {
        active = CopyGuard ? CopyGuard.deepActiveElement() : document.activeElement;
      } catch (e) { /* never mind */ }

      let cleaned = 0;
      for (const field of fields) if (cleanField(field, settings, active)) cleaned++;
      if (cleaned) onCleaned(cleaned);
      return cleaned;
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      let remaining = SCAN_DELAYS.length;
      for (const delay of SCAN_DELAYS) {
        setTimeout(() => {
          try {
            scan(delay === DEEP_SCAN_AT);
          } finally {
            if (--remaining === 0) scheduled = false;
          }
        }, delay);
      }
    }

    for (const type of ['keydown', 'paste', 'cut', 'input', 'beforeinput', 'pointerdown']) {
      document.addEventListener(type, noteUserInput, true);
    }
    document.addEventListener('click', schedule, true);
    document.addEventListener('focusin', schedule, true);
    schedule();
    return { scan: scan, schedule: schedule };
  }

  root.CleanURLFieldGuard = {
    install: install,
    cleanField: cleanField,
    isDisplayField: isDisplayField,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CleanURLFieldGuard;
})(typeof globalThis !== 'undefined' ? globalThis : self);
