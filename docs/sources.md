# Rule sources

A record of other tracking-parameter removers checked against `src/rules.js`,
so a later pass can re-diff instead of starting from scratch. "Added" lists
what rules.js didn't already have; "Skipped" notes real candidates that were
deliberately left out and why. Projects with nothing worth taking are listed
with a one-line reason.

Checking one of these again later: pull its current rules file, diff the
parameter names against `globalParams`/`affiliateParams`/`globalPatterns` and
each site's `params`/`affiliate`/`patterns` (case-insensitive), and read
anything new in context before adding it - several lists here turned out to
contain generic words, broken regexes stored as literal strings, or
parameters that are actually functional on the page.

## Reviewed

- **[ClearURLs](https://docs.clearurls.xyz/specs/rules)** (LGPL-3.0). The
  original source for much of this project's list; still a good place to
  check new candidates against.
- **[tracking-query-params-registry](https://github.com/mpchadwick/tracking-query-params-registry)**
  (mpchadwick, Unlicense). 168 entries; 52 added in `fb8e4b2` (ad click/ad
  ids, attribution-tool families).
- **[laststance/clean-url](https://github.com/laststance/clean-url)**
  (license: none declared). 57 names; 12 added (Google Ads keyword
  reporting, TikTok/ConvertKit/beehiiv/ShareThis ids, generic
  affiliate/referral ids).
- **[anti-racist/TinyTools_GetCleanURL](https://github.com/anti-racist/TinyTools_GetCleanURL)**
  (license: none declared). Small, carefully-reasoned and tested ruleset.
  Added: msockid, ga_cid, trkCampaign/trkContact, newsletter tags, hss_channel,
  Reddit bot-check tokens, Google AI Mode state, seven missing Amazon stores.
  Its path-canonicalization approach (collapsing a product URL to one true
  form) was not adopted - different feature from what this extension does.
- **[Cimbali/CleanLinks](https://github.com/Cimbali/CleanLinks)** (MPL-2.0).
  A large per-domain rule tree, more aggressive than this project's style
  (removes many single-word/generic names on the assumption that most paths
  are whitelisted). Added: BBC's ns_* (comScore) and pinned_post_*/
  intlink_from_url, LinkedIn originalReferer, global recipientId/
  elqTrack/elqTrackId, eBay sojTags. Most of the rest was skipped as too
  generic/functional for this project's "never remove what a page might
  need" rule (`app`, `from`, `id`, `source`, `context`, single letters, etc.)
  or scoped to sites this project doesn't cover.
- **[Linkumori/Linkumori-Rulesets](https://github.com/Linkumori/Linkumori-Rulesets)**
  (Apache-2.0). ~1070 domains, much broader coverage than this project's ~40
  site groups - most of the long tail (small shops, regional sites) was not
  imported; that would be adding new sites, not filling gaps in existing
  ones. Data quality is mixed: several entries are regex strings stored
  literally in a `removeParams` array (e.g. `"/^asc_.*$/"`), which
  `declarativeNetRequest` cannot act on, and a batch of Xiaohongshu/Weibo
  params carry a stray `doc` suffix from what looks like a scraping bug.
  For domains this project already tracks: added Apple's mttn* family, Bing
  nclid, Etsy gao/gpla/share_time, GitHub ref_*, Netflix trackId siblings,
  TikTok referer/embed fields, X refsrc, eBay mk* siblings, Lazada laz_*
  tokens, Walmart's Google-Shopping referral params, Bilibili spmid/
  tdsourcetag/bsource/referfrom, Facebook `tracking`. The universal ruleset
  (`rules3-universal.json`) duplicates ClearURLs-derived names already
  covered, except otm_* and mc_tc (added) and `__s` (already covered).
- **[col1010/tracklessURL](https://github.com/col1010/tracklessURL)**
  (license: none declared). 173 global names. Cross-confirmed the comScore
  ns_* and BBC pinned_post_* finds from CleanLinks/Linkumori. Also surfaced
  Microsoft/Bing Ads' hv* ValueTrack macros (added, global - they land on
  the advertiser's own page, not on bing.com). The rest (ajaxhist, ccid,
  event, id, lq, osid, otpToken, pq, stick, toWww, ...) is either too
  generic, a UI feature flag, or - in otpToken's case - a literal auth
  token; skipped.
- **[Psychosynthesis/Eraser](https://github.com/Psychosynthesis/Eraser)**
  (MIT). Small constants list; surfaced the otm_* family (added) and
  otherwise fully covered already.
- **[mordyovits/Neat-URL](https://github.com/mordyovits/Neat-URL)** /
  **[Smile4ever/Neat-URL](https://github.com/Smile4ever/Neat-URL)** (same
  project, license: none declared). Surfaced utm_userid, utm_mailing,
  recipientId, elqTrack/elqTrackId (the latter two cross-confirmed by
  CleanLinks); otherwise already covered or scoped more narrowly here on
  purpose (e.g. it strips `ref_`/`pf_rd_*`/`tag` globally on `amazon.*`,
  this project scopes those to the Amazon site rule instead).
- **[newhouse/url-tracking-stripper](https://github.com/newhouse/url-tracking-stripper)**
  (MIT). Small tracker list (mostly covered already); its `redirects.js`
  surfaced four affiliate redirect domains not yet unwrapped: RedirectingAt,
  Impact Radius's `ojrq.net`, Connexity, Commission Factory. Also documents
  an Amazon-affiliate redirect (`amazon.ca/gp/redirect.html?location=`,
  rewritten by their own servers) - not added; would need path-scoped host
  entries across every Amazon store this project already lists, for a
  redirect style Amazon itself seems to be phasing out.
- **[jparise/chrome-utm-stripper](https://github.com/jparise/chrome-utm-stripper)**
  (MIT). One regex, ~25 names. Fully covered already; nothing to add.
- **[LuisEnMarroquin/tracking-query-remover](https://github.com/LuisEnMarroquin/tracking-query-remover)**
  (MIT). Its `TRACKING-PARAMETER-RESEARCH.md` is a well-sourced writeup
  (official vendor docs preferred, ClearURLs/Brave as corroboration) rather
  than just a rule dump. Surfaced two real gaps: the `sfmc_` prefix
  (Salesforce Marketing Cloud, added as a global pattern) and AppsFlyer's
  `af_*` attribution fields (added - `af_dp`/`af_web_dp` deliberately
  excluded, those route the link). Also documented Adjust's `adj_*` family
  without an exhaustive list of exact names, which held up adding it until
  AdGuard's filter (below) gave the precise spellings.
- **[hkitago/CleanURL](https://github.com/hkitago/CleanURL)** (MIT). Ships
  with an *empty* default parameter list (`DEFAULT_PARAM_KEYS = { general: [] }`)
  - fully user-configured, nothing to diff against.

## Reviewed (npm registry)

A `npm search`-style sweep (the registry API, since `npm search` itself is
deprecated) for packages that strip tracking parameters. Most are thin
wrappers around a short, already-covered list; a few package-manager entries
are themselves a feed from a GitHub rules repo, already covered above under
that project. Noted here to avoid re-checking the trivial ones.

- **[@tickhq/clean-url](https://github.com/tickhq/clean-url)** (ISC). A large
  (~970-domain) ClearURLs-style ruleset bundled as `dist/lib/rules.js`.
  Its "Global" section surfaced real gaps later confirmed independently by
  AdGuard's filter (below): the `adjust_*` family, Oracle Eloqua siblings,
  `ir_adid`/`ir_campaignid`/`ir_partnerid`, `gps_adid`, `erid`, and more -
  see the commit that added them. Its ~970 site-specific sections were not
  diffed site-by-site; importing them wholesale would mean adding new sites,
  not filling gaps in this project's existing ~40.
- **[@inframanufaktur/clean-urls](https://github.com/inframanufaktur/clean-urls)**
  (MIT). Small vendor-attributed list (`data/params.js`). Surfaced
  `feeditemid`/`targetid` (Google Ads Shopping) and the full-word Matomo
  siblings (`matomo_source` etc., beside the already-covered `mtm_*` and
  `matomo_campaign`/`matomo_kwd`/`matomo_keyword`) and `pk_keyword`.
- **[@url-sanitize/merged](https://www.npmjs.com/package/@url-sanitize/merged)**
  (MIT) led to its real payoff: the per-source packages it depends on.
  - **[@url-sanitize/adguard](https://www.npmjs.com/package/@url-sanitize/adguard)**
    (LGPL-3.0-only) bundles AdGuard's actual "URL Tracking Protection" filter
    list (github.com/AdguardTeam/FiltersRegistry) as adblock-syntax text with
    a comment naming the tracking vendor above nearly every rule - the best
    sourcing of any list checked so far. Its "General" section (global rules)
    had 156 names this project didn't have; about two-thirds were added,
    each with the vendor or GitHub issue AdGuard's own comment cited (Adjust,
    AppsFlyer siblings, Oracle Eloqua, Mindbox, Ebis, Visumo, MyTracker,
    Blueshift, Adsterra, Telegram Ads, Yahoo Japan/LINE ads, Cxense, GLAMI,
    ChannelSight, Winfluencer, Emarsys, PersonaClick, and more). Its
    ~3000-line "Specific web sites" section was not diffed - same reasoning
    as tickhq's site sections above.
  - **[@url-sanitize/brave](https://www.npmjs.com/package/@url-sanitize/brave)**
    (MPL-2.0) bundles Brave's "Debouncer" redirect-skip list
    (github.com/brave/adblock-lists). 178 redirect rules; most of the plain
    ones not already covered were added (ShareASale Analytics, Pepperjam,
    AvantLink, Partnerize, ClixGalore, ValueCommerce, GeoRiot, Impact.com's
    pooled redirect domains, Firebase's `page.link`, PR Newswire, Adobe
    Audience Manager, and more). A chunk need base64-decoding
    (ActiveCampaign's `lt.acemlnN.com` family, `ouo.today`) or path-regex
    extraction (`click.pstmrk.it`, `awstrack.me`, AMP viewer paths, Yandex's
    `turbopages.org`) that this project's redirect unwrapper (`params` or
    `rawQueryIsUrl` only) cannot express - a real feature gap, not just a
    missing rule; left for whenever that lands.
  - **[@url-sanitize/clearurls](https://www.npmjs.com/package/@url-sanitize/clearurls)**
    (LGPL-3.0-only) and **[@url-sanitize/firefox](https://www.npmjs.com/package/@url-sanitize/firefox)**
    (MPL-2.0, Mozilla's official query-stripping list from Remote Settings):
    both fully covered already - useful as a confirmation that this
    project's ClearURLs-derived core hasn't drifted, not as a source of
    anything new.
- **[linkcl](https://github.com/apiraino/link_cleaner)** (MIT). A small
  redirect-unwrap map; cross-confirmed `t.mailpgn.com` and
  `recruitics.com` from Brave's list (both added) and the Facebook `efg`
  parameter and Matomo `pk_keyword` already covered by the time it was
  checked.
- **strip-tracking-params**, **url-cleaner-fiicher** (both MIT): short,
  fully-covered lists, nothing to add.
- **vue-url-cleaner** (MIT): an allowlist-based sanitizer with no built-in
  blocklist at all - nothing to diff.
- **@petitchevalroux/canonical-url** (GPL-3.0): two names
  (`utm_*`, `xtor`), both already covered.
- **@backrunner/url-cleaner**: despite the name, bundles uBlock Origin's
  core engine and uAssets filter lists (blocking/redirecting scripts) rather
  than query-parameter stripping - a different category of tool, not
  compared.
- **@url-sanitize/cli**, **@url-sanitize/core**: the CLI and compiler around
  the catalogs above; no rule data of their own.

## Looked at, not worth a full pass

- **Copy Clean Link**, **URL Cleaner — Strip Tracking Links**, **Clean
  Link — Link Cleaner & Clear URL**, **Get Clean URL**, **CleanLink Pro**:
  Chrome Web Store listings found via search; no public source repository
  found linked from the listing.
- **URL Stripper**, **Tracking Query Remover** (the chrome-stats.com
  listing, not LuisEnMarroquin's project of the same name), **CleanLinks —
  URL Tracking Stripper**, **CleanURL Extension**: Web Store listings only
  checked for a source-code link; none found, not pursued further.
