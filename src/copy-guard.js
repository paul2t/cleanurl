/*
 * CleanURL - the copy event.
 *
 * Installed in BOTH content script worlds. The page world can patch
 * navigator.clipboard, which the isolated world cannot; the isolated world is
 * guaranteed to run, which the page world is not (a strict page CSP can keep
 * a main-world script out). Running the same guard in both means a copy is
 * cleaned as long as either one is alive, and whichever gets there second sees
 * text that is already clean and does nothing.
 */
'use strict';
(function (root) {
  const Clean = root.CleanURL;

  /** document.activeElement stops at a shadow host; the real field is inside. */
  function deepActiveElement() {
    let el = document.activeElement;
    for (let depth = 0; depth < 20; depth++) {
      if (!el || !el.shadowRoot || !el.shadowRoot.activeElement) break;
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  /** Text selected inside an <input>/<textarea>, which getSelection() hides. */
  function fieldSelection(el) {
    try {
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
          typeof el.selectionStart === 'number' && el.selectionStart !== el.selectionEnd) {
        return String(el.value).slice(el.selectionStart, el.selectionEnd);
      }
    } catch (e) { /* selectionStart throws on some input types */ }
    return '';
  }

  /** A selection inside a shadow tree is only reachable through that root. */
  function selectionFor(el) {
    try {
      const node = el && el.getRootNode ? el.getRootNode() : null;
      if (node && node !== document && typeof node.getSelection === 'function') {
        const inShadow = node.getSelection();
        if (inShadow && String(inShadow)) return inShadow;
      }
    } catch (e) { /* not a shadow root, or no selection api */ }
    return window.getSelection ? window.getSelection() : null;
  }

  function selectionHtml(selection) {
    if (!selection || !selection.rangeCount) return '';
    try {
      const holder = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        holder.appendChild(selection.getRangeAt(i).cloneContents());
      }
      return holder.innerHTML;
    } catch (e) {
      return '';
    }
  }

  function read(data, type) {
    try {
      return data.getData(type) || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * @param {object} options
   *   getSettings() -> settings
   *   report(kind, count)
   *   write(dataTransfer, type, value) - lets the page world bypass its own
   *     patched setData so a copy is not counted twice.
   */
  function install(options) {
    const getSettings = options.getSettings;
    const report = options.report || function () {};
    const write = options.write || function (data, type, value) { data.setData(type, value); };

    function onCopy(event) {
      let settings;
      try {
        settings = getSettings();
      } catch (e) {
        return;
      }
      if (!settings || !settings.enabled || !settings.cleanCopies) return;

      const data = event.clipboardData;
      if (!data) return;

      try {
        let source = '';
        let selection = null;
        let html = '';

        if (event.defaultPrevented) {
          /*
           * The page cancelled the event and wrote its own payload. That
           * payload can be read back and rewritten, which is how a share
           * button still gets cleaned where the page world patches could not
           * be installed. A cancelled event with nothing written is a page
           * suppressing the copy on purpose, so leave it alone.
           */
          source = read(data, 'text/plain');
          html = read(data, 'text/html');
          if (!source) return;
        } else {
          const active = deepActiveElement();
          source = fieldSelection(active);
          if (!source) {
            selection = selectionFor(active);
            source = selection ? String(selection) : '';
          }
          if (!source) return;
        }

        const result = Clean.cleanText(source, settings);
        if (!result.changed) return;

        write(data, 'text/plain', result.text);

        // Keep the rich flavour rather than flattening the copy to plain text.
        if (!html && selection) html = selectionHtml(selection);
        if (html) {
          const cleanedHtml = Clean.cleanHtml(html, settings);
          if (cleanedHtml.changed) write(data, 'text/html', cleanedHtml.html);
        }

        // setData only reaches the clipboard on a cancelled event.
        if (!event.defaultPrevented) event.preventDefault();
        report('copy', result.count);
      } catch (e) { /* never break the page's own copy */ }
    }

    window.addEventListener('copy', onCopy, false);
    return onCopy;
  }

  root.CleanURLCopyGuard = {
    install: install,
    deepActiveElement: deepActiveElement,
    fieldSelection: fieldSelection,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CleanURLCopyGuard;
})(typeof globalThis !== 'undefined' ? globalThis : self);
