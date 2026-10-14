# Chrome Web Store submission answers

Copy-paste answers for the **Privacy practices** tab of the developer dashboard. Every claim here was checked against the code; if the code changes, re-check before resubmitting. Character counts are against the dashboard's 1000 limit.

Verified for this version:

- no `eval()`, `new Function()`, or string-argument `setTimeout`
- no `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon` anywhere
- no external `src`/`href` in any HTML page
- exactly one `chrome.scripting.executeScript` call, with a packaged function
- exactly one `navigator.clipboard.readText()` call, in the popup button handler

Re-run the checks with:

```
grep -rnE "\beval\(|new Function\(" src/
grep -rnE "\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon" src/
grep -rnE "(src|href)=\"https?:" src/*.html
```

---

## Summary (the 132-character field)

The dashboard takes this from `description` in manifest.json (132 characters at most), so it changes with a release, not in the dashboard. Since 1.0.11 it is option 0. Counts are in the check below.

0. Removes 750+ tracking parameters from links before they load and from links you copy. Nothing is collected, nothing is sent. (124)
1. Removes tracking parameters and share IDs from links before they load, and from links you copy.
2. Strips utm_source, gclid, fbclid and share IDs out of URLs you open and URLs you copy.
3. Cleans tracking junk out of links automatically, and out of anything you copy.

Suggested: 0. It says what happens and where, gives a number a reader can weigh against other extensions, and answers the privacy question before it is asked. 1 is the version without the number.

---

## Detailed description

No site, app or brand names: the Chrome Web Store treats a list of them as keyword spam, an attempt to rank for those searches. Parameter names are fine; they are what the extension removes. The figures are worded "over" and "more than" so they stay true as rules are added. Recompute them with:

```
node -e "const R=require('./src/rules.js');const s=new Set(R.sites.flatMap(x=>x.params||[]));console.log(R.globalParams.length,'everywhere,',s.size,'site-specific,',new Set([...R.globalParams,...s].map(x=>x.toLowerCase())).size,'distinct,',R.redirects.length,'redirect services')"
```

The number of websites (76 in 1.0.10) is counted by hand from the `hosts` in `src/rules.js`, one per service: regional domains and short-link domains do not count again.

```
CleanURL removes tracking parameters and share identifiers from the links you open and the links you copy.

A link from a share button, a newsletter or an ad usually carries more than the address of the page. "utm_source" and "utm_campaign" record which campaign sent you. "gclid", "fbclid" and "msclkid" tie your visit to an ad click. The share identifiers that video, music and social apps add to their links record who shared the link with you. None of it is needed to open the page.

WHAT IT REMOVES

Over 750 different tracking parameters.

More than 300 of them are removed on every website: campaign tags (utm_* and similar), ad click identifiers (gclid, gbraid, wbraid, dclid, fbclid, msclkid, yclid and more), and the tags that email marketing and analytics tools add to links. Wildcards catch new variants of the common families.

More than 400 are share and tracking identifiers specific to more than 75 popular websites: video, music, social, shopping, news, travel and search sites, on their regional domains too.

Redirect links from more than 30 services are unwrapped to their destination when you copy them, so you share the page itself rather than a tracked detour.

Affiliate tags are deliberately left alone. They pay whoever shared the link, so removing them is your decision rather than a default. There is a switch if you want it, which also unwraps affiliate network links.

So is anything a site needs to work. Sign-in and session parameters such as code, state, token and redirect_uri, and ordinary ones like q, v, id and page, are never touched.

WHAT IT DOES

Cleans links before they load. The rewrite happens on the request itself, so the tracking parameters never reach the site, and never appear in your address bar or your history.

Cleans links when you copy them. Share panel "Copy link" buttons, Ctrl+C over a selected link, a page's own copy button, and dragging a link all produce a clean URL.

Adds "Copy clean link" to the right-click menu, for a link or for the page you are on.

Cleans the clipboard on demand. One button in the popup rewrites a link you have already copied, which covers links copied in another browser or app, or with Chrome's own "Copy link address", which an extension cannot intercept. The first time you press it, Chrome asks for permission to read the clipboard. It is read only when you press the button.

SETTINGS

Switch any of the cleaning passes off on its own. Leave chosen sites alone entirely, with a one-click toggle in the popup. Add your own parameters to remove, with * wildcards. Keep a parameter that a site turns out to need.

WHAT IT DOES NOT DO

This is not an ad blocker or an anti-tracking suite. It does not block requests, scripts, cookies or fingerprinting, and it will not stop a site knowing you visited. It edits URLs, and that is all it does.

PRIVACY

No data is collected. The extension makes no network request of any kind, contacts no server, and contains no analytics. The list of parameters it removes is a plain file inside the extension, not something fetched or updated remotely. The only things stored are your settings and two counters, and they stay on your device.

It asks for access to all sites because tracking parameters turn up on links to any domain, including small and personal ones, and because a URL can only be rewritten before it loads if the extension has access to it.

CleanURL is open source under the MIT license.
```

---

## Images

Upload from `webstore/`, written by `npm run store-images`:

- Screenshots (1280×800): `screenshot-1-before-load.png`, `screenshot-2-copies.png`, `screenshot-3-settings.png`
- Small promo tile (440×280): `promo-small-440x280.png`
- Marquee (1400×560): `promo-marquee-1400x560.png`
- Icon (128×128): `icon-128.png`

---

## Category

Privacy & Security is the better fit than Tools: the listing is about what leaves your browser, and reviewers read the category alongside the single-purpose statement.

---

## Single purpose (731/1000)

CleanURL removes tracking parameters and share identifiers from URLs.

It does this in three places: it rewrites a link before the page loads, so parameters like utm_source, gclid and fbclid never reach the site; it removes them from links the user copies, including share-panel buttons such as YouTube's "si" parameter; and it offers a right-click "Copy clean link" and a popup button for cleaning a link on demand.

That is the extension's only function. It has no other feature, does not alter page content or behaviour beyond the URL, collects no data, and communicates with no server. The list of parameters it removes is a static file inside the package, and users can add their own or exclude sites they do not want touched.

---

## declarativeNetRequestWithHostAccess (898/1000)

Requested instead of declarativeNetRequest as the narrower permission: rules act only where the extension has host access, which redirect rules need anyway.

It removes tracking parameters (utm_*, gclid, fbclid, share IDs) from a navigation before the request is sent, so they never reach the server, the address bar or history. Acting after page load would mean they had already been sent.

The rules are generated at startup from a static list in the package (src/rules.js). They use only "redirect" with queryTransform.removeParams, plus "allow" rules for sites on the user's allowlist and for redirect links, whose parameters are their destination. Every rule is scoped to resourceTypes ["main_frame"] and requestMethods ["get"], so sub-resources and form submissions are never touched.

Nothing is blocked, throttled or inspected, no request body is read, and no rule is fetched from a server.

---

## declarativeNetRequestFeedback

**Not applicable.** `npm run package` strips this permission from the packaged manifest, so the published build does not request it and the dashboard will not ask for a justification. It stays in the manifest on disk, where loading the folder unpacked still gets the full popup counter.

If you ever ship it, the reason is: `onRuleMatchedDebug` is used only to count cleaned links for the popup, the count is two integers in `chrome.storage.local`, and no URL or request detail is stored or transmitted.

---

## clipboardRead (optional permission)

Declared under optional_permissions, so it is not requested at install. The popup asks for it the first time the user presses "Clean clipboard link", and never otherwise.

The popup has a single button, "Clean clipboard link". Pressing it reads the clipboard, removes tracking parameters from any URL found there, writes the cleaned text back, and displays which parameters were removed.

This exists for links copied somewhere the extension cannot intercept: from another browser or application, or through Chrome's own right-click "Copy link address", which is browser UI that an extension cannot hook.

The clipboard is read in exactly one place, inside that button's click handler in the popup (src/popup.js), and only as a direct result of the user pressing it. Nothing reads the clipboard in the background, on a timer, on page load, or from a content script. The contents are processed in memory and written straight back; they are never stored, logged, or transmitted.

---

## storage (680/1000)

Stores the user's own settings and two counters, and nothing else.

chrome.storage.sync holds the settings shown on the options page: the on/off switches for each cleaning pass, the list of sites to leave alone, extra parameters to remove, and parameters to always keep. Sync is used so these preferences follow the user's Chrome profile across their devices.

chrome.storage.local holds two integers used for the "N links cleaned" line in the popup.

No browsing history, no URLs, no hostnames, no page content, and no personal or identifying data are stored. Nothing that is stored is ever transmitted: the extension contacts no server and makes no network requests of any kind.

---

## contextMenus (670/1000)

Adds two right-click menu items, which are the extension's main manual action:

"Copy clean link" appears when right-clicking a link, and copies that link with its tracking parameters removed.

"Copy clean page URL" appears on a page and on the extension's toolbar icon, and copies the current page's URL, cleaned.

These are necessary because Chrome's own "Copy link address" is browser UI that an extension cannot intercept, so a separate menu item is the only way to offer a cleaned copy from the right-click menu.

No menu item is added in any other context, no page content is read in order to build them, and the URL being cleaned comes from the menu event itself.

---

## scripting (810/1000)

Used in exactly one place, and only in direct response to the user clicking one of the extension's two context-menu items (src/background.js).

A service worker has no DOM and therefore no way to place text on the clipboard. When the user chooses "Copy clean link" or "Copy clean page URL", the extension runs one short function, defined in the package, in the tab that was right-clicked. That function creates a hidden textarea holding the already-cleaned URL, copies it, removes the textarea, and restores the user's previous selection.

No script is ever injected from a remote source or constructed from a string. Nothing is injected automatically on page load through this API. The injected function reads nothing from the page: it receives the cleaned URL as an argument and only writes to the clipboard.

---

## Host permission (855/1000)

<all_urls> is required for the extension's core function and cannot be narrowed.

declarativeNetRequest only applies a "redirect" action when the extension has host access to the request URL. Without <all_urls>, tracking parameters could not be removed from navigations at all.

Tracking parameters are not confined to any list of sites. utm_*, gclid, fbclid and similar appear on links to any domain, including small and personal sites, so any fixed host list would silently fail in exactly the places a user expects the extension to work. The same applies to the copy interception, which must be present wherever a share button might appear.

The extension reads no page content, collects no data, contacts no server, and changes nothing about a page beyond removing tracking parameters from URLs. Its parameter list is a static file inside the package.

---

## Remote code

**Answer: No, I am not using remote code.**

Justification (766/1000):

All JavaScript is contained in the extension package.

The extension loads no external script, module, or stylesheet, uses no CDN, and makes no network request of any kind: there is no fetch, XMLHttpRequest, WebSocket, or sendBeacon call anywhere in the code. The popup and options pages reference only local files.

Nothing is evaluated from a string: there is no eval(), no new Function(), and no string-argument setTimeout.

The tracking-parameter rules are a plain JavaScript object in a packaged file (src/rules.js). They are not fetched, updated, or configured remotely; changing them requires publishing a new version.

chrome.scripting.executeScript is called once, with a function reference defined in the package, never with a remote file or a code string.

---

## Privacy policy URL

https://github.com/paul2t/cleanurl/blob/main/PRIVACY.md

Enter it in the Privacy tab, and on addons.mozilla.org under the listing's privacy policy. It states what the answers below declare: nothing collected, nothing transmitted.

---

## Data usage

Tick **nothing** in the data collection section, and certify all three statements. The extension collects none of the listed categories:

| Category | Collected |
| --- | --- |
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

The three certifications are all true: data is not sold to third parties, is not used for a purpose unrelated to the single purpose, and is not used to determine creditworthiness or for lending.

Note on "web history": the extension reads URLs in order to rewrite them, but never stores, logs, or transmits them. The only persisted values are the user's settings and two integer counters.

The Firefox build makes the same declaration in the manifest, where AMO requires it: `browser_specific_settings.gecko.data_collection_permissions.required` is `["none"]`. The two must agree, and a test asserts the manifest half.

---

## Note on declarativeNetRequestFeedback

`onRuleMatchedDebug` only fires for extensions loaded unpacked, so in a published build the permission does nothing except invite a reviewer to ask what it is for.

`npm run package` therefore removes it from the manifest it writes into the zip, while leaving the file on disk untouched. `countNetworkCleanups()` in `src/background.js` feature-detects the API and returns quietly when it is absent, so the only effect on the published build is that the popup counter stops counting network-level cleanups and keeps counting in-page and copy ones.

Add another name to `DEV_ONLY_PERMISSIONS` in `tools/package.js` to strip more.
