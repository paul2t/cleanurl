/*
 * CleanURL - Google redirect links, unwrapped as they are followed.
 *
 * Links on Google's own pages (Search, Maps, Images, News) often lead through
 * google.com/url?url=<destination>&usg=<signature>&ved=...: Google logs the
 * click, then redirects. The network rules cannot unwrap that redirect - the
 * destination is percent-encoded and they cannot decode it - and should not:
 * for a google.com/url link found anywhere else, Google's "Redirect notice" is
 * what protects against phishing links dressed up as Google ones.
 *
 * On a Google page the link was made by Google itself, so that concern does
 * not apply. Just before such a link is used - clicked, middle-clicked, or
 * right-clicked (so the browser's own "Copy link address" gets it too) - its
 * href becomes the cleaned destination. Search results also carry a `ping`
 * attribute, a second beacon to Google on the same click; it goes too.
 *
 * The href is changed at that moment rather than when the page loads because
 * Google rewrites its result links to /url on mousedown.
 *
 * Some Google pages skip the href entirely: Maps' "Website" button cancels the
 * click and calls window.open('/url?url=…&usg=…'). The page-world script
 * (content-main.js) wraps window.open on Google pages for that, using
 * destinationFor() below, which is why this file is in that bundle too.
 *
 * Follows the "Unwrap redirect links" setting and the allowlist, like copies.
 */
'use strict';
(function (root) {
  const Clean = root.CleanURL;

  // Any Google page or redirector: google.com, www.google.fr, maps.google.co.uk...
  const GOOGLE_HOST = /^([a-z0-9-]+\.)?google(\.[a-z]{2,3}){1,2}$/i;

  function isGoogleHost(host) {
    return GOOGLE_HOST.test(String(host || ''));
  }

  /** The <a> an event is about, looking through shadow roots. */
  function linkFor(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    for (const node of path) {
      if (node && node.tagName === 'A' && node.href) return node;
    }
    return null;
  }

  /** Whether this page is one where Google's links may be unwrapped. */
  function active(settings, pageHost) {
    return !!settings && settings.enabled && settings.unwrapRedirects &&
      isGoogleHost(pageHost) && !Clean.isAllowlisted(pageHost, settings.allowlist);
  }

  /**
   * Where `url` - possibly relative, as Maps passes it to window.open - should
   * go instead, when it is a Google redirect followed from a Google page:
   * { from, to, removed }, or null to leave it alone.
   */
  function destinationFor(url, settings, page) {
    const pageHost = page && page.hostname;
    if (!active(settings, pageHost)) return null;
    let absolute;
    try {
      absolute = new URL(String(url), page.href);
    } catch (e) {
      return null;
    }
    if (!isGoogleHost(absolute.hostname) || !Clean.isRedirector(absolute.href)) return null;
    const result = Clean.cleanUrl(absolute.href, settings);
    if (!result.unwrapped) return null;
    return { from: absolute.href, to: result.url, removed: result.removed };
  }

  /**
   * Rewrites `link` in place when it is a Google redirect link on a Google
   * page, and drops its ping. Returns what changed, or null.
   */
  function rewrite(link, settings, pageHost) {
    if (!link || !active(settings, pageHost)) return null;

    let pinged = false;
    if (link.hasAttribute && link.hasAttribute('ping')) {
      link.removeAttribute('ping');
      pinged = true;
    }

    const from = link.href;
    const target = destinationFor(from, settings, { hostname: pageHost, href: from });
    if (!target) return pinged ? { from: from, to: from, removed: ['ping'] } : null;
    link.href = target.to;
    return { from: from, to: target.to, removed: target.removed.concat(pinged ? ['ping'] : []) };
  }

  /**
   * @param {object} options
   *   getSettings() -> settings
   *   report(kind, count, detail) - for the counter and the debug log
   */
  function install(options) {
    const getSettings = options.getSettings;
    const report = options.report || function () {};
    function onUse(event) {
      try {
        const done = rewrite(linkFor(event), getSettings(), root.location && root.location.hostname);
        if (done && done.to !== done.from) {
          report('url', 1, { source: 'google link', from: done.from, to: done.to, removed: done.removed });
        }
      } catch (e) { /* never get in the way of a click */ }
    }
    // Capture phase, so this runs after Google's mousedown rewrite but before
    // the browser acts on the click.
    for (const type of ['click', 'auxclick', 'contextmenu']) {
      root.addEventListener(type, onUse, true);
    }
    return onUse;
  }

  root.CleanURLLinkGuard = {
    install: install,
    rewrite: rewrite,
    destinationFor: destinationFor,
    isGoogleHost: isGoogleHost,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CleanURLLinkGuard;
})(typeof globalThis !== 'undefined' ? globalThis : self);
