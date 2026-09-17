# CleanURL

A Chrome extension (Manifest V3) that removes campaign trackers and share
identifiers from URLs — before the page loads, and when you copy a link.

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=Kd8sPqR2   ->  …/watch?v=dQw4w9WgXcQ
https://example.com/post?utm_source=news&utm_medium=email  ->  https://example.com/post
https://www.instagram.com/p/Cx1y2z3/?igsh=MWQx%3D%3D       ->  https://www.instagram.com/p/Cx1y2z3/
```

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → pick this folder

## How it works

Two layers, because neither one covers the whole problem on its own.

**Before the page loads.** The service worker compiles the rule database into
[declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
redirect rules. Chrome applies them to the request itself, so the tracker never
reaches the server and never appears in the address bar or your history. Only
top-level `GET` navigations are rewritten — rewriting sub-resources or form
posts would break far more than it fixes.

**When you copy.** A content script running in the page's own JavaScript world
(`world: "MAIN"`) wraps the APIs that share buttons use:

| What you do | What is patched |
| --- | --- |
| Click "Copy link" on YouTube, Instagram, X… | `navigator.clipboard.writeText` / `.write` |
| Ctrl+C over selected text | the `copy` event (plain and rich text) |
| A page's own copy handler | `DataTransfer.setData` |
| Drag a link somewhere | `DataTransfer.setData` |
| Tap a native share sheet | `navigator.share` |
| Right-click → **Copy clean link** | the extension's context menu |

The main-world entry loads one generated file, `src/page-world.js`, built by
`npm run build`. That is not tidiness: **a JS file listed in two
`content_scripts` entries is injected once, into whichever entry comes first.**
Sharing `rules.js` and `cleaner.js` between the two entries left the main world
with `content-main.js` and none of its dependencies, silently. A test asserts
no file is ever listed in both entries.

Patching `navigator.clipboard` has to happen in the page's world: a normal
content script would patch its own isolated copy and the page would never
notice. This is the only mechanism that can catch a share panel's Copy button,
because `navigator.clipboard.writeText()` **fires no `copy` event** — nothing
in the isolated world can observe it.

So the page-world script records which hooks it installed on
`<html data-cleanurl-page-world>`, and two fallbacks cover it not getting in
(a strict page CSP can keep a main-world script out):

- The `copy` event guard ([`src/copy-guard.js`](src/copy-guard.js)) runs in
  **both** worlds. It reads back a payload the page wrote itself and rewrites
  it, and it walks shadow roots to find the focused field —
  `document.activeElement` stops at the shadow host. Whichever world gets there
  second sees clean text and does nothing. This covers Ctrl+C, not Copy
  buttons.
- If the marker comes back without `clipboard`, the isolated world installs
  [`src/field-guard.js`](src/field-guard.js), which cleans the share panel's
  URL **in the field itself**, so whatever the page copies out of it is already
  clean. Only `readonly`/`disabled` fields are touched — an editable field is
  someone typing. It is not installed at all when the clipboard hook works.

A third, smaller pass rewrites the address bar after load, which catches
wildcard parameter names that `declarativeNetRequest` cannot express, Amazon's
`/ref=…` path segments, and trackers a single-page app adds via `pushState`.

## What it removes

Roughly 180 parameters everywhere (`utm_*`, `gclid`, `fbclid`, `msclkid`,
`mc_cid`, `mkt_tok`, `yclid`, `igshid`, Matomo, HubSpot, Klaviyo…) plus
site-specific share identifiers for ~28 sites: YouTube `si`/`pp`, Instagram and
Threads `igsh`, X `s`/`t`, TikTok's `share_*` set, Reddit `share_id`, Spotify
`si`, LinkedIn `trk`, Amazon's `pd_rd_*`/`pf_rd_*`, Bilibili, AliExpress, and
so on. Run the extension's **Settings** page for the full list.

Two deliberate omissions:

- **Affiliate tags are kept by default.** They pay whoever shared the link, so
  removing them is a choice rather than a fix. There is a switch for it.
- **Nothing load-bearing is ever touched** — `code`, `state`, `token`,
  `redirect_uri`, `q`, `v`, `id`, `page` and friends. A test asserts this.

## Settings

Right-click the toolbar icon → **Options**, or open the popup and hit
**Settings**.

- Individual switches for the address bar pass, copy cleaning, redirect
  unwrapping and affiliate tags
- **Sites to leave alone** — an allowlist; the popup has a per-site toggle too
- **Parameters to always keep** — an escape hatch if a rule breaks a site
- **Extra parameters to remove** — supports `*` wildcards

The popup shows what would be stripped from the current page and offers a
one-click clean copy.

## Adding rules

Everything lives in [`src/rules.js`](src/rules.js). Add a global parameter only
if it is safe on *every* site; otherwise add it to that site's entry, or add a
new one:

```js
{
  name: 'Example',
  hosts: ['example.com'],       // matches subdomains too
  dnrDomains: ['example.com'],  // literal domains for the network rules
  params: ['share_token'],
}
```

Site rules also accept `hostRe` (a regex, for things like Google's many
ccTLDs), `patterns` (regex parameter names, content-script only) and
`affiliate` (only removed when the user opts in).

## Tests

```
npm test
```

- `test/cleaner.test.js` — URL and text rewriting, including guard rails for
  parameters that must never be removed
- `test/extension.test.js` — manifest wiring, every script parses, and the
  generated `declarativeNetRequest` rules are shaped the way Chrome requires
- `test/clipboard.test.js` — runs the built `page-world.js` bundle (what Chrome
  actually loads) against a stubbed DOM and checks each clipboard path end to
  end, plus the share-field fallback

`npm run build` regenerates `src/page-world.js`; a test fails if it is stale.

`npm run icons` regenerates `icons/*.png` from `tools/make-icons.js`.

## Permissions

`<all_urls>` is unavoidable: `declarativeNetRequest` will only *redirect* a
request when the extension has host access to it, and the copy interception has
to be present wherever a share button is. Nothing is sent anywhere — the rules
are a static file in this folder and the only stored state is your settings plus
two counters.

## A copy came out dirty

Open the popup — it says which layers are live on that tab. Or ask the page
directly, in DevTools console:

```js
document.documentElement.getAttribute('data-cleanurl-page-world')
```

- `"clipboard,clipboard-write,setdata,copyevent,share,history"` — every hook is
  in. A Copy button producing a dirty link now means the parameter is not in
  the rules; add it under **Extra parameters to remove** in Settings.
- `null` — the page-world script never ran at all. Either the tab predates the
  extension being loaded (content scripts only inject on page load, so reload
  it), or nothing was injected into the main world. The field fallback takes
  over.
- `"running,!deps"` — the script ran but its dependencies did not load
  alongside it: a broken file list in the manifest, not the page. This is what
  the shared-file bug above looked like. The marker is written before the
  dependency check precisely so it is not mistaken for the case above.
- A list containing `!clipboard` — the script ran but the page refused that
  patch, which is what freezing built-in prototypes does. Every other hook
  still went in, and the field fallback is active.

The popup asks frame 0 specifically. A sandboxed subframe cannot host a
main-world script, so letting one answer would report the whole page as
blocked when it is fine.

Note that the counter only sees what it can verify. Network-level cleanups are
counted through `onRuleMatchedDebug`, which Chrome only fires for an unpacked
extension — in a packed build the counter tracks in-page and copy cleanups
only, and a quiet counter does not mean nothing is being stripped.

## Known limits

- Chrome's own right-click → *Copy link address* is browser UI and cannot be
  intercepted; use **Copy clean link** instead.
- Redirect unwrapping (`google.com/url?q=…`) applies to links you copy, not to
  navigation, where following the redirect is usually the point.
- Trackers inside the path rather than the query string need a per-site rule;
  only Amazon has one so far.
- `test/`, `tools/` and `package.json` are development-only. Zip just
  `manifest.json`, `src/` and `icons/` if you publish this.
