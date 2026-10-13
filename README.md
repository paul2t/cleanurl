# CleanURL

A Chrome extension (Manifest V3) that removes campaign trackers and share
identifiers from URLs — before the page loads, and when you copy a link.

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=Kd8sPqR2   ->  …/watch?v=dQw4w9WgXcQ
https://example.com/post?utm_source=news&utm_medium=email  ->  https://example.com/post
https://www.instagram.com/p/Cx1y2z3/?igsh=MWQx%3D%3D       ->  https://www.instagram.com/p/Cx1y2z3/
```

## Install

**[CleanURL on the Chrome Web Store](https://chromewebstore.google.com/detail/cleanurl/cbgpaokaogdlafkoohoggdajocnhakbc)**

Or from source, which is also the [debug build](#debug-build):

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → pick this folder

Firefox cannot load this folder directly: it is Chrome's manifest. Run
`npm run dev:firefox`, then `about:debugging` → **This Firefox** → **Load
Temporary Add-on…** → pick `dist/firefox-debug/manifest.json`. For the build
that ships, pick `dist/cleanurl-<version>.xpi` instead (from
`npm run package:firefox`). Never the `.zip`: that is the Chrome package. For
Android, see [Testing on Firefox for Android](#testing-on-firefox-for-android).

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
wildcard parameter names that `declarativeNetRequest` cannot express, trackers
in the path (Amazon's `/ref=…` segments, and share ids after a stray `&` in a
`youtu.be/ID&si=…` link), and trackers a single-page app adds via `pushState`.

## What it removes

Roughly 210 parameters everywhere (`utm_*`, `gclid`, `fbclid`, `msclkid`,
`mc_cid`, `mkt_tok`, `yclid`, `igshid`, Matomo, HubSpot, Klaviyo, Bronto,
Webtrends, Branch.io…) plus site-specific share identifiers for about 40 sites
and site groups: YouTube `si`/`pp`/`is`, Instagram and Threads `igsh`/`psln`,
X `s`/`t`, TikTok's `share_*` set, Reddit `share_id`, Spotify `si`, LinkedIn
`trk`/`rcm`, Amazon's `pd_rd_*`/`pf_rd_*` and Associates tracking (`source`,
`asc_source`, `asc_refurl` - the page you clicked the link on), Bilibili,
AliExpress, and so on. Run the extension's **Settings** page for the full list.

Redirect links are unwrapped to their destination when copied: Google, Facebook,
Instagram, DuckDuckGo, Reddit, VK, Steam and a dozen more.

Two deliberate omissions:

- **Affiliate tags are kept by default.** They pay whoever shared the link, so
  removing them is a choice rather than a fix. There is a switch for it, which
  also unwraps affiliate network redirect links (Awin, Skimlinks, VigLink, CJ…).
  On Amazon, `asc_campaign` and `ascsubtag` count as affiliate too: they are the
  publisher's own reporting ids, kept alongside the `tag` that pays them.
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

At the bottom, **Source code** opens this repository and **Report an issue**
opens a new GitHub issue with questions about the link: what was opened or
copied, what CleanURL turned it into, and what was expected. Only the
extension version and browser are filled in. The current page's URL is left
for you to paste, since putting it in the link would hand it to GitHub on the
click, before you have decided to send anything.

It also has a **Clean clipboard link** button. Press it and whatever link is on
the clipboard right now is rewritten in place, with a line underneath saying
which parameters came off — or that there was nothing to do. It is for links
copied somewhere the extension could not reach: another browser, a chat app,
Chrome's own *Copy link address*. Being an explicit action it runs even when
the automatic passes are switched off; only the allowlist still applies. If the
clipboard holds a block of text, every link in it is cleaned and the rest is
left byte for byte identical.

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

The [ClearURLs rules](https://docs.clearurls.xyz/specs/rules) (LGPL-3.0) are a
good place to look for candidates; several entries here were picked from them.
Check each name before adding it: some of theirs are broad regexes, and a few
strip parameters a page needs, such as gift-article tokens or product variants.

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

## Packaging

```
npm run package          # dist/cleanurl-<version>.zip  for the Chrome Web Store
npm run package:firefox  # dist/cleanurl-<version>.xpi  for addons.mozilla.org
npm run dev:firefox      # dist/firefox-debug/          the debug build, for Firefox
```

Both build, test, then write an archive with `manifest.json` at its root.

### Firefox and Firefox for Android

One source tree, two manifests. Android runs the same build: the manifest
declares `gecko_android` with the same version floor, because
`declarativeNetRequest` and `content_scripts` `world` both mirror their desktop
versions there.

One API does not exist on Android at all: **`menus`/`contextMenus`**. That
matters more than a missing feature, because the listener is registered at the
top level of the background script, so an unguarded reference throws during
load and takes everything after it down - including the network rules, which
work on Android perfectly well. `src/background.js` feature-detects it, and a
test loads the background script with `chrome.contextMenus` deleted and asserts
it still produces rules.

So on Android you get the cleaning and the popup, but no right-click **Copy
clean link** - there is no right-click menu to put it in. The packager rewrites three things for Firefox:

- **`background`.** Firefox has no background service worker, and its event
  page has no `importScripts()` either, so the files the worker imports are
  listed in `background.scripts` for the browser to load first, worker last.
  That list is parsed out of the actual `importScripts()` call so it cannot
  drift; `src/background.js` guards the call with
  `typeof importScripts === 'function'` and works either way.
- **`browser_specific_settings.gecko`.** An add-on id, without which
  `storage.sync` does not work and AMO cannot sign the build.
- **`strict_min_version`: 140 on desktop, 142 on Android.** `content_scripts`
  `world` needs Firefox 128. Below that Firefox ignores the key and runs the
  page-world bundle in the isolated world, where it patches its own copy of
  `navigator.clipboard`, reports every hook as installed, and so stops the
  share-field fallback from ever starting. A hard floor beats a degraded mode
  that reports itself healthy. The floor is higher still because of
  `data_collection_permissions`, which AMO requires and Firefox only reads from
  140 (142 on Android); below those, AMO's validator warns the declaration
  would be ignored.

`declarativeNetRequest` itself needs only Firefox 113, so the floor is about
the clipboard hook and AMO's data declaration rather than the core cleaning.

The manifest on disk cannot serve both browsers: Firefox needs
`background.scripts`, and Chrome flags that key in a Manifest V3 manifest
("'background.scripts' requires manifest version of 2 or lower"). So in Firefox
the [debug build](#debug-build) is a generated folder: `npm run dev:firefox`
writes `dist/firefox-debug/`, the Firefox package's files and manifest with the
dev-only permissions kept and the debug log page added.

### Testing on Firefox for Android

Firefox for Android only installs signed add-ons from a file, so for testing,
load it from your computer over USB with Mozilla's
[`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):

1. **Phone:** turn on Android's Developer options and **USB debugging**, then
   in Firefox for Android: **Settings → Remote debugging via USB**.
2. **Computer:** install [adb](https://developer.android.com/tools/releases/platform-tools),
   plug the phone in, accept the prompt on the phone, and get its id - the
   first column, e.g. `R58M12ABCDE` (`unauthorized` means the prompt is still
   waiting on the phone):

   ```
   adb devices
   ```

3. Build the Firefox debug folder and run it on the phone, with your id in
   place of `DEVICE_ID`. `--firefox-apk` is `org.mozilla.firefox` for the
   release, `org.mozilla.firefox_beta` for Beta, `org.mozilla.fenix` for
   Nightly. `npx` downloads `web-ext` the first time:

   ```
   npm run dev:firefox
   npx web-ext run --target=firefox-android --android-device=DEVICE_ID --firefox-apk=org.mozilla.firefox --source-dir=dist/firefox-debug
   ```

   To test exactly what ships instead, unzip `dist/cleanurl-<version>.xpi` into
   a folder and point `--source-dir` at it.

   If it loops on *"Waiting for org.mozilla.firefox Remote Debugging Server..."*,
   Firefox's own switch is off: Android's USB debugging is not enough. In
   Firefox on the phone: **⋮ → Settings → Advanced → Remote debugging via
   USB**, then run it again. To check, with Firefox open,
   `adb shell "cat /proc/net/unix | grep firefox-debugger-socket"` must print
   a line. Add `--adb-remove-old-artifacts` to clear the copies earlier runs
   left on the phone.

4. **Debugging:** desktop Firefox → `about:debugging` → **Setup** → enable USB
   devices, then pick the phone to inspect the background page and see its
   console. The popup opens from Firefox's menu → **Extensions** → CleanURL.

The extension stays installed until Firefox on the phone closes. No phone? An
Android emulator from Android Studio with Firefox installed works the same way.

To install it on a phone for everyday use, it has to be signed by Mozilla: an
[unlisted](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
signing gives an `.xpi` installable on any Firefox, and a listed one puts it on
addons.mozilla.org.

The manifest is rewritten on the way in to drop the dev-only permissions,
`declarativeNetRequestFeedback` and `webRequest`. Chrome only fires
`onRuleMatchedDebug` for an unpacked extension, so in a published build that
permission does nothing except invite a reviewer to ask what it is for, and
`webRequest` is what turns on the [debug build](#debug-build). The file on
disk keeps both, so loading this folder unpacked still gets them. Add to
`DEV_ONLY_PERMISSIONS` in `tools/package.js` to strip more.

The file list is walked
out of the manifest (icons, content scripts, the service worker's
`importScripts` arguments, and what the popup and options pages load), so
`test/`, `tools/`, `package.json` and `src/content-main.js` - which exists only
to feed the generated bundle - are left out without a hand-maintained list to
drift. Output is reproducible: the same tree packs to the same bytes on Node
20 and later, on Windows and Linux alike. The 1.0.9 release, built on Windows
with Node 24, came out byte for byte the same from Node 20, 22 and 24 under
WSL. Node 18 packs the same files, but its older bundled zlib compresses them
differently, so its archives differ.

The tooling needs Node 18, or 20 and later, and nothing else: no
`npm install`, and no `zip` or `unzip` on the system. Node 19 cannot run the
tests: it alone makes `Event.isTrusted` an unchangeable property of each
event, and the copy tests need to fake a user's event. Node 18 needs the
`CustomEvent` stand-in in `test/clipboard.test.js`, so releases up to 1.0.9
only build on Node 20 or later.

There is no command that produces a Web Store submission directly; you upload
that zip. A `.crx` comes from Chrome itself:

```
chrome.exe --pack-extension=. --pack-extension-key=key.pem
```

but Chrome refuses to install a `.crx` from outside the Web Store, so that is
only useful for enterprise policy deployment. For local use, **Load unpacked**
on this folder.

## Debug build

Loading this folder unpacked (**Load unpacked** in `chrome://extensions`) is
the debug build; in Firefox, load `dist/firefox-debug/` from
`npm run dev:firefox`. Both manifests keep `webRequest`, which every package
drops, and `Settings.isDebugBuild()` keys off that. A published build can
never switch any of this on.

- **Debug log.** The popup shows a **debug log** link, which opens
  `src/debug.html`. Every top-level navigation with a query string, every
  address bar or `history` cleanup, every cleaned copy and every right-click
  copy is listed with the URL it started from, each redirect on the way and
  whether CleanURL or the server made it, and where it ended. Parameters are
  colour-coded, as chips and in every URL line:
  - **red** - tracking that was removed;
  - **yellow** - affiliate credit, crossed out in the list when "Also remove
    affiliate tags" took it out;
  - **green** - everything else that was kept. This is where a missing rule
    shows up.

  You can filter by URL or parameter, show only entries with parameters left,
  and copy the log as JSON. The same entries are echoed with `console.debug`
  in the service worker's console.
- **Removed when opened.** The popup says which trackers the network rules
  removed before the page loaded, with a **Copy original link** button for
  when a site needed one of them.

The network rules rewrite a URL before the page exists, so the page never sees
the original. `webRequest` (observe-only, no blocking) reports the rewrite,
which is the one place it is still visible - though not tidily. Chrome often
aborts a navigation's first attempt and restarts it under a new request id,
sometimes from where a redirect led; and when a rule rewrites the target of a
server redirect, some versions report no redirect at all while others report
the pre-rewrite URL at the end. So navigations are followed per tab, a
restart joins the navigation it continues, and the newest URL seen wins. The
tests replay event sequences captured from Chrome.

The log keeps the last 500 entries in `storage.session`: memory only, cleared
when the browser closes, and not readable by content scripts. The page-world
script only describes copies in its report events when the debug flag is set,
since a page can see those events.

## Permissions

`<all_urls>` is unavoidable: `declarativeNetRequest` will only *redirect* a
request when the extension has host access to it, and the copy interception has
to be present wherever a share button is.

`clipboardRead` ("Read data you copy and paste") exists solely for the popup's
**Clean clipboard link** button, and the clipboard is only ever read when you
press it — never in the background, and never by a content script.

Nothing is sent anywhere — the rules are a static file in this folder and the
only stored state is your settings plus two counters. (The debug build also
keeps its log in memory; see above.) The popup's GitHub links only open a tab
when you click them.

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
only visible to an unpacked extension (the debug build counts them from
`webRequest`) — in a packed build the counter tracks in-page and copy cleanups
only, and a quiet counter does not mean nothing is being stripped. In the debug
build, the debug log shows exactly what each layer did.

## Known limits

- Chrome's own right-click → *Copy link address* is browser UI and cannot be
  intercepted; use **Copy clean link** instead.
- **Some sites are reserved by the browser and cannot be cleaned at all.**
  Chrome reserves `chromewebstore.google.com` and `chrome.google.com/webstore`;
  Firefox reserves its own list in `extensions.webextensions.restrictedDomains`,
  which includes `support.mozilla.org`, `addons.mozilla.org` and
  `accounts.firefox.com`. On those, no extension may run a content script and
  `declarativeNetRequest` rules do not apply, so a `?utm_source=` survives.
  Nothing an extension can do changes it. The popup recognises them and says so
  instead of suggesting a reload, and its **Copy clean link** button still
  works, because it runs in the extension's own page rather than the site's.

  The two lists are different, so `Clean.isBrowserRestricted()` holds the union
  and is only ever used to *explain* a content script already known to be
  missing - never to predict one, or Chrome would be told it cannot run on
  `support.mozilla.org`, where it runs perfectly well.
- Redirect unwrapping (`google.com/url?q=…`) applies to links you copy, not to
  navigation, where following the redirect is usually the point.
- **A redirector's parameters are never edited, only unwrapped.** They are its
  payload and its signature: `google.com/url` rejects the whole request as
  invalid if `usg` is missing. Since Google puts `sa` and `usg` on its own
  search results too, the site rule that cleans a search page would otherwise
  strip the signature off the redirector and break the link rather than clean
  it. Every host and path in the `redirects` list is exempt from parameter
  removal, in the content script and in a `declarativeNetRequest` `allow` rule
  that outranks every stripping rule. The destination the redirect lands on is
  a fresh navigation and is cleaned normally.
- Trackers inside the path rather than the query string need a per-site rule;
  only Amazon (`/ref=…`) and youtu.be (`/ID&si=…`) have one so far. These run
  in the content script and on copies only: the network rules can remove query
  parameters, not edit a path, so `youtu.be/ID&si=…` still reaches youtu.be as
  typed. Its server turns the ids into real parameters on youtube.com, where
  they are removed before that page loads.
- `test/`, `tools/` and `package.json` are development-only. Publish with
  `npm run package` / `npm run package:firefox`, which leave them out, along
  with the debug page and the dev-only permissions.

## License

[MIT](LICENSE). The `LICENSE` file ships inside both packages.
