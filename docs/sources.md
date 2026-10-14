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
  excluded, those route the link). Also documents Adjust's `adj_*` family in
  the same way, but without an exhaustive list of exact names; not added
  without more confidence in the precise spellings, since guessing wrong on
  an attribution-link family risks breaking the actual redirect.
- **[hkitago/CleanURL](https://github.com/hkitago/CleanURL)** (MIT). Ships
  with an *empty* default parameter list (`DEFAULT_PARAM_KEYS = { general: [] }`)
  - fully user-configured, nothing to diff against.

## Looked at, not worth a full pass

- **Copy Clean Link**, **URL Cleaner — Strip Tracking Links**, **Clean
  Link — Link Cleaner & Clear URL**, **Get Clean URL**, **CleanLink Pro**:
  Chrome Web Store listings found via search; no public source repository
  found linked from the listing.
- **URL Stripper**, **Tracking Query Remover** (the chrome-stats.com
  listing, not LuisEnMarroquin's project of the same name), **CleanLinks —
  URL Tracking Stripper**, **CleanURL Extension**: Web Store listings only
  checked for a source-code link; none found, not pursued further.
