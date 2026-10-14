/*
 * GENERATED FILE - do not edit. Run `npm run build` after changing any of:
 *   src/rules.js, src/cleaner.js, src/copy-guard.js, src/content-main.js
 *
 * The main-world content script entry loads this one file and nothing the
 * isolated entry also lists. A path appearing in both entries is injected
 * only once, into whichever comes first, which previously left the main
 * world with content-main.js and none of its dependencies.
 */
'use strict';

/* ---- src/rules.js ---------------------------------------------------- */
/*
 * CleanURL - tracking parameter database.
 *
 * Loaded as a plain script in three places (service worker via importScripts,
 * isolated-world content script, main-world content script), so it must stay
 * dependency-free and only publish itself on globalThis.
 *
 * Rules of thumb for adding entries:
 *   - globalParams must be safe to drop on ANY site. When in doubt, scope it
 *     to a site entry instead.
 *   - Never list anything a site needs to render the page or complete a login
 *     (code, state, token, id, q, v, page, ...).
 */
'use strict';
(function (root) {
  const RULES = {
    version: 3,

    /* ------------------------------------------------------------------ *
     * Removed everywhere. Exact, case-insensitive parameter names.
     * ------------------------------------------------------------------ */
    globalParams: [
      // Urchin / Google Analytics campaign tagging
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'utm_name', 'utm_cid', 'utm_reader', 'utm_referrer',
      'utm_social', 'utm_social-type', 'utm_brand', 'utm_campaignid',
      'utm_place', 'utm_pubreferrer', 'utm_swu', 'utm_viz_id',
      'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
      'ga_source', 'ga_medium', 'ga_term', 'ga_content', 'ga_campaign',
      'ga_place', '_ga', '_gl', '_gac',

      // Google Ads / DoubleClick click identifiers
      'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'gad_source',
      'gad_campaignid', 'gcl_au', 'srsltid', 'gad',

      // Meta
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
      'fbadid', 'fb_comment_id', 'action_object_map', 'action_type_map',
      'action_ref_map',

      // Microsoft / Bing
      'msclkid',

      // Mailchimp, HubSpot, Marketo, Klaviyo, Drip, MailerLite, Vero
      'mc_cid', 'mc_eid', 'mkt_tok',
      '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'hsCtaTracking',
      // hss_channel is the social account a HubSpot post was shared from
      // (tw-…, fbp-…, lcp-…); neither ^hsa_ nor ^__hs reaches it.
      'hss_channel',
      'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt',
      'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
      '_ke', '_kx', '__s', 'ml_subscriber', 'ml_subscriber_hash',
      'vero_conv', 'vero_id', 'sb_referer_host',

      // Yandex / Mail.ru
      'yclid', 'ysclid', '_openstat', 'frommail',

      // Other ad networks and click identifiers
      'twclid', 'ttclid', 'li_fat_id', 'epik', 'rdt_cid', 'obOrigUrl',
      'outbrainclickid', 'tblci', 'wickedid',
      'wickedsource', 'wickedpicked', 'oly_anon_id', 'oly_enc_id',
      'rb_clickid', 's_kwcid', 'ef_id',
      'dicbo', 'sc_customer', 'igshid', 'guccounter', 'guce_referrer',
      'guce_referrer_sig', 'mibextid', 'ncid', 'ito', 'icid', 'cmpid',
      'CMP', 'cmp', 'ref_src', 'ref_url', 'soc_src', 'soc_trk',
      'trk_contact', 'trk_msg', 'trk_module', 'trk_sid', 'sznclid',
      '__twitter_impression',

      // Matomo / Piwik
      'pk_campaign', 'pk_kwd', 'pk_medium', 'pk_source', 'pk_content',
      'pk_cid', 'pk_vid', 'piwik_campaign', 'piwik_kwd', 'piwik_keyword',
      'matomo_campaign', 'matomo_kwd', 'matomo_keyword',
      'mtm_source', 'mtm_medium', 'mtm_campaign', 'mtm_keyword', 'mtm_kwd',
      'mtm_content', 'mtm_cid', 'mtm_group', 'mtm_placement',

      // Adobe / AT Internet / AWS docs
      's_cid', 'ss_email_id', 'sc_campaign', 'sc_channel', 'sc_content',
      'sc_medium', 'sc_outcome', 'sc_geo', 'sc_country', 'sc_publisher',
      'sc_detail', 'sc_segment', 'sc_category',

      // Misc newsletter / CMS campaign tags
      'hmb_campaign', 'hmb_medium', 'hmb_source', 'campaign_id', 'ceneo_spo',
      'itm_source', 'itm_medium', 'itm_campaign', 'itm_term', 'itm_content',
      'stm_source', 'stm_medium', 'stm_campaign', 'stm_term', 'stm_content',
      'cid_source', 'campaignid', 'adgroupid', 'adid', 'ad_id',
      'assetId', 'wtrid', 'xtor', 'wt_mc', 'wt_zmc', 'os_ehash',
      'tracking_source', 'Echobox', 'WT.mc_id', 'WT.nav', 'hootPostID',
      'wprov', 'mkwid', 'pcrid', 'sms_click', 'sms_source', 'sms_uph',

      // Email marketing: Bronto, GoDaddy, dotdigital
      '_bta_tid', '_bta_c', 'gdfms', 'gdftrk', 'gdffi', 'dm_i',

      // Branch.io deep links, used by many apps
      '_branch_match_id', '_branch_referrer',

      // From the tracking query params registry
      // (github.com/mpchadwick/tracking-query-params-registry, Unlicense).
      // Exact names only: nb_* would also catch French "nb" (number) fields.
      // Ad click and ad ids: Nextdoor, Snapchat, Yahoo, Rokt, Google, TikTok,
      // Pinterest, Criteo, real-time bidding
      'ndclid', 'ScCid', 'scadid', 'vmcid', 'rtid', 'gadid', 'ttadid', 'padid',
      'cto_pld', 'rtbhc',
      // Attribution tools: Triple Whale, Northbeam, Klar, Billy Grace, Hyros
      'tw_source', 'tw_campaign', 'tw_term', 'tw_content', 'tw_adid', 'tw_kwdid',
      'nbt', 'nb_adtype', 'nb_ap', 'nb_expid_meta', 'nb_fii', 'nb_klid',
      'nb_kwd', 'nb_li_ms', 'nb_lp_ms', 'nb_mi', 'nb_mt', 'nb_pc', 'nb_pi',
      'nb_placement', 'nb_ppi', 'nb_ti',
      'klar_source', 'klar_cpid', 'klar_adid',
      'bg_kw', 'bg_aid_k', 'bg_aid_v', 'bg_campaign', 'bg_source', 'bg_source_id',
      'fbc_id', 'h_ad_id',
      // Meta placements, Springbot email, Channable feeds, cq_* campaign tags
      'meta_placement', 'meta_site_source', 'redirect_mongo_id',
      'redirect_log_mongo_id', 'channable',
      'cq_cmp', 'cq_con', 'cq_med', 'cq_net', 'cq_plac', 'cq_plt', 'cq_src',
      'cq_term',

      // Seznam's recommendation widget (Czech news sites)
      'dop_ab_variant', 'dop_source_zone_name', 'dop_req_id', 'dop_id',

      // From the comparison with laststance/clean-url's list.
      // utm_nooverride and utm_ad already match the ^utm_ pattern, but that
      // only runs in the content script; spelled out here, the network rules
      // remove them before the request leaves.
      'utm_nooverride', 'utm_ad',
      // Google Ads keyword reporting, landing on the advertiser's page
      'matchtype', 'adgroup', 'adposition',
      // TikTok referral, ConvertKit subscriber, beehiiv link, ShareThis hash
      'tiktok_r', 'ck_subscriber_id', '_bhlid', 'sthash',

      // From the comparison with anti-racist/TinyTools_GetCleanURL.
      // msockid is Bing's and Edge's MUID cookie copied into the link;
      // ga_cid is the Analytics client id, beside the ga_* family above.
      'msockid', 'ga_cid',
      // camelCase siblings of the trk_* family: ^trk_ does not match these
      'trkCampaign', 'trkContact',
      // Newsletter link tagging. email_id is left out: it is plausible as a
      // record id in a webmail or CRM, and those pages need it.
      'email_campaign', 'email_placement', 'email_source',

      // Seen independently in Eraser, CleanLinks and Linkumori's rulesets.
      // otm_* is a third campaign-tag family alongside itm_* and stm_* above.
      'otm_source', 'otm_medium', 'otm_campaign', 'otm_content', 'otm_term',
      // mc_tc is a MailChimp tracking variant beside mc_cid and mc_eid
      'mc_tc',
      // Oracle Eloqua marketing automation
      'recipientId', 'elqTrackId', 'elqTrack',
      // utm_* siblings not in the original Urchin spec but used in the wild
      'utm_userid', 'utm_mailing',
      // Pinterest's own documented spelling, alongside epik above
      '_epik',

      // AppsFlyer's mobile-attribution parameters, landing on whatever page
      // the install link points at. af_dp, af_web_dp and other af_*_dp
      // fallback-destination fields are deliberately absent: those route the
      // link and must survive.
      'af_ad', 'af_ad_id', 'af_adset', 'af_adset_id', 'af_channel',
      'af_keywords', 'af_cost_currency', 'af_cost_value', 'af_cost_model',
      'af_click_lookback', 'af_viewthrough_lookback',
      'af_reengagement_window', 'af_c_id', 'af_siteid',
      'af_sub1', 'af_sub2', 'af_sub3', 'af_sub4', 'af_sub5', 'af_prt',

      // Microsoft/Bing Ads' ValueTrack-style macros, landing on the
      // advertiser's own page like matchtype above - not on bing.com itself
      'hvadid', 'hvbmt', 'hvdev', 'hvlocint', 'hvlocphy', 'hvnetw', 'hvqmt',
      'hvtargid',

      // comScore Digital Analytix, seen on BBC and other news sites but a
      // third-party vendor rather than anything BBC-specific
      'ns_source', 'ns_mchannel', 'ns_campaign', 'ns_linkname', 'ns_fee',

      // From AdGuard's URL Tracking Protection filter and the @tickhq/clean-url
      // and @inframanufaktur/clean-urls npm packages (see docs/sources.md).
      //
      // Adjust: both spellings its partners actually use. adj_t is excluded
      // on adj.st and *.go.link, where it is the redirect's own payload - a
      // nuance only AdGuard's domain exceptions capture; everywhere else it
      // is safe.
      'adjust_adgroup', 'adjust_campaign', 'adjust_creative',
      'adjust_referrer', 'adjust_tracker', 'adjust_tracker_limit',
      'adj_campaign', 'adj_creative', 'adj_label', 'adj_t',
      'adj_tracker_limit',
      // AppsFlyer siblings of the af_* family above. af_force_deeplink is
      // deliberately absent: it controls deep-link behaviour, like af_dp.
      'af_xp', 'is_retargeting',
      // Google Play Services advertising id, Google Ads Shopping feed ids
      'gps_adid', 'feeditemid', 'targetid',
      'external_click_id', 'unicorn_click_id', 'iclid',
      'erid',          // Russian ad-transparency identifier
      'idealoid',      // Idealo
      '_zucks_suid',   // Zucks
      'mindbox-click-id', 'mindbox-message-key', // Mindbox CRM
      'ebisAdID', 'ebisOther1', 'ebisOther2', 'ebisOther3', 'ebisOther4',
      'ebisOther5',    // Ebis (Japan)
      // Oracle Eloqua, siblings of recipientId/elqTrackId/elqTrack above
      'elq', 'elqaid', 'elqat', 'elqCampaignId', 'elqak',
      // A fourth campaign-tag family alongside utm_/itm_/stm_/otm_
      'int_campaign', 'int_content', 'int_medium', 'int_source', 'int_term',
      'int_cmp_creative', 'int_cmp_id', 'int_cmp_name',
      'dpg_campaign', 'dpg_content', 'dpg_medium', 'dpg_source',
      'sc_cid',        // Adobe, beside the sc_* family above
      'spot_im_redirect_source', // Spot.IM
      'user_email_address',
      'ymid', 'ym_tracking_id', // Yandex Metrica, beside yclid/ysclid
      // Yahoo Japan and LINE ads (ads-help.yahoo-net.jp, help.linebiz.com)
      'yj_r', 'line_uid', '_ly_c', '_ly_r', 'ldtag_cl', 'lt_r', 'srclt',
      'cm_mmc', 'cm_cr', 'cm_me',
      // MyTracker (mobile attribution)
      'mt_adset', 'mt_campaign', 'mt_click_id', 'mt_creative', 'mt_link_id',
      'mt_medium', 'mt_network', 'mt_sub1', 'mt_sub2', 'mt_sub3', 'mt_sub4',
      'mt_sub5',
      'uzcid', 'beyond_uzcvid', 'beyond_uzmcvid',
      'vs_campaign_id', 'vsm_cid', 'vsm_pid', 'vsm_type', // Visumo
      'winflncrtag',   // Winfluencer
      // Confirmed in real links on avira.com, malwarebytes.com and others
      'x-clickref', 'x-source', 'x-a-medium',
      'tgclid',        // Telegram Ads
      'adsterra_clid', 'adsterra_placement_id', // Adsterra
      'aiad_clid',
      'bance_xuid',    // Bance
      'famad_xuid',    // Famad
      // Blueshift email-subscription tracking
      'bsft_clkid', 'bsft_eid', 'bsft_mid', 'bsft_uid', 'bsft_aaid', 'bsft_ek',
      'analytics_context', 'analytics_trace_id',
      'asgtbndr', 'janet',
      'loclid',        // LOGLY
      'emcs_t', 'ems_dl', // Emarsys
      'eml-name', 'eml-mediaplan', 'eml-publisher',
      'at_link',       // bare form of the at_* family above
      'usqp',          // Google AMP analytics
      'Tcsack',        // TCS
      'nx_source', 'oprtrack', 'rtkcid', 'cstrackid', // ChannelSight (cstrackid)
      'cx_click', 'cx_recsOrder', 'cx_recsWidget', // Cxense
      'tw_medium', 'tw_profile_id', // Triple Whale, beside tw_source above
      'gci',           // GLAMI click id
      'btag',          // affiliate tag seen on gambling/casino links
      'adfrom',
      'recommended_by', 'recommended_code', // personaclick.com

      // Matomo/Piwik siblings of the matomo_campaign/matomo_kwd/pk_kwd above
      'matomo_source', 'matomo_medium', 'matomo_content', 'matomo_cid',
      'matomo_group', 'matomo_placement', 'pk_keyword',
    ],

    /* Regexes (as strings, matched case-insensitively) applied by the content
     * script. declarativeNetRequest can only match exact names, so everything
     * here is a belt-and-braces catch for variants not spelled out above. */
    globalPatterns: [
      '^utm_',
      '^pk_',
      '^piwik_',
      '^matomo_',
      '^mtm_',
      '^hsa_',
      '^trk_',
      '^__hs',
      '^_hs(enc|mi)$',
      '^at_(medium|campaign|custom\\d|link_|recipient|creation|variant|type|format|general|emailtype|send_date|ptr_)',
      // Salesforce Marketing Cloud
      '^sfmc_',
    ],

    /* Affiliate / referral credit. Off by default: stripping these takes money
     * away from whoever shared the link, which is the user's call to make. */
    affiliateParams: [
      'tag', 'ascsubtag', 'linkCode', 'creative', 'creativeASIN', 'camp',
      'affiliate', 'aff', 'aff_id', 'afftrack', 'partner', 'partnerid',
      'partner_id', 'ranMID', 'ranEAID', 'ranSiteID', 'siteID', 'clickid',
      'subid', 'sub_id', 'utm_affiliate',
      // Affiliate networks' click ids: CJ, Awin, ShareASale, Impact
      'cjevent', 'awc', 'sscid', 'irclickid', 'irgwc',
      // Generic referral and affiliate click ids. They credit a sharer, so
      // they belong here rather than in globalParams.
      'affiliate_id', 'afid', 'click_id', 'referral',
      // Zanox, now part of Awin
      'zanpid',
      // From AdGuard's filter and @tickhq/clean-url (see docs/sources.md)
      'admitad_uid',   // Admitad
      'cjdata',        // CJ, beside cjevent above
      'ir_adid', 'ir_campaignid', 'ir_partnerid', // Impact, beside irclickid/irgwc
      'tduid',         // Tradedoubler
      'maf',           // moshimo affiliate
    ],

    /* ------------------------------------------------------------------ *
     * Per-site rules. `hosts` matches the host and any of its subdomains.
     * `dnrDomains` are the literal domains handed to declarativeNetRequest
     * (omit for sites only reachable through hostRe).
     * ------------------------------------------------------------------ */
    sites: [
      {
        name: 'YouTube',
        hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
        dnrDomains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
        // si = share identifier, pp = share payload, feature = entry point
        params: ['si', 'pp', 'feature', 'kw', 'ab_channel',
                 'embeds_referring_euri', 'embeds_referring_origin',
                 'source_ve_path', 'themeRefresh', 'is'],
      },
      {
        name: 'Instagram / Threads',
        hosts: ['instagram.com', 'threads.net', 'threads.com'],
        dnrDomains: ['instagram.com', 'threads.net', 'threads.com'],
        // xtok is base64 of a short opaque id, minted per share like igsh
        params: ['igsh', 'igshid', 'igsi', 'xmt', 'img_index_share', 'psln',
                 'stkn', 'xtok'],
      },
      {
        name: 'X / Twitter',
        hosts: ['twitter.com', 'x.com'],
        dnrDomains: ['twitter.com', 'x.com'],
        params: ['s', 't', 'cxt', 'ref_src', 'ref_url', 'twclid', 'src',
                 'cn', 'refsrc'],
      },
      {
        name: 'Facebook',
        hosts: ['facebook.com', 'fb.com', 'fb.watch', 'messenger.com'],
        dnrDomains: ['facebook.com', 'fb.com', 'fb.watch', 'messenger.com'],
        params: ['mibextid', '__tn__', '__cft__[0]', '__cft__[1]', '__so__',
                 'rdid', 'refsrc', 'hrc', 'dti', 'video_source', 'extid',
                 'paipv', 'eav', '_rdr',
                 'eid', 'comment_tracking', 'ls_ref', 'action_history',
                 'referral_story_type', 'sfnsn', 'wtsid', 'rdc', 'rdr',
                 'hc_ref', 'hc_location', 'fref', '__xts__[0]', 'tracking'],
      },
      {
        name: 'TikTok',
        hosts: ['tiktok.com'],
        dnrDomains: ['tiktok.com'],
        params: ['is_from_webapp', 'sender_device', 'sender_web_id', 'web_id',
                 '_r', '_t', '_d', 'share_app_id', 'share_item_id',
                 'share_link_id', 'share_iid', 'tt_from', 'source',
                 'preview_pb', 'checksum', 'u_code', 'timestamp',
                 'social_sharing', 'enable_checksum',
                 'user_id', 'share_app_name',
                 'embed_source', 'referer_url', 'referer_video_id',
                 'share_author_id'],
      },
      {
        name: 'Reddit',
        hosts: ['reddit.com', 'redd.it'],
        dnrDomains: ['reddit.com', 'redd.it'],
        params: ['share_id', 'correlation_id', 'ref_campaign', 'ref_source',
                 'rdt', 'post_fullname', '$deep_link', '$original_url',
                 'chainedPosts',
                 '$3p',
                 // one-time tokens from the bot check that redirects back to
                 // the page that was asked for
                 'solution', 'js_challenge', 'jsc_token'],
      },
      {
        name: 'Spotify',
        hosts: ['spotify.com', 'spotify.link'],
        dnrDomains: ['spotify.com', 'spotify.link'],
        // sci = the share card ("spotify:card-config:…") picked when sharing
        params: ['si', 'nd', 'nid', 'sci'],
      },
      {
        name: 'LinkedIn',
        hosts: ['linkedin.com', 'lnkd.in'],
        dnrDomains: ['linkedin.com', 'lnkd.in'],
        params: ['trk', 'trackingId', 'lipi', 'licu', 'midToken', 'midSig',
                 'trkEmail', 'originTrackingId', 'refId', 'eBP', 'rcm',
                 // carried back when LinkedIn's auth wall blocks a page
                 'originalReferer'],
      },
      {
        name: 'Amazon',
        hosts: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
                'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.co.jp',
                'amazon.com.au', 'amazon.in', 'amazon.com.br', 'amazon.nl',
                'amazon.se', 'amazon.pl', 'amazon.com.mx', 'amzn.to',
                // Stores that were missing, so their links kept everything
                'amazon.cn', 'amazon.sg', 'amazon.ae', 'amazon.sa',
                'amazon.eg', 'amazon.com.tr', 'amazon.com.be'],
        dnrDomains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
                     'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.co.jp',
                     'amazon.com.au', 'amazon.in', 'amazon.com.br',
                     'amazon.nl', 'amazon.se', 'amazon.pl', 'amazon.com.mx',
                     'amazon.cn', 'amazon.sg', 'amazon.ae', 'amazon.sa',
                     'amazon.eg', 'amazon.com.tr', 'amazon.com.be'],
        params: ['pd_rd_w', 'pd_rd_wg', 'pd_rd_r', 'pd_rd_i', 'pf_rd_p',
                 'pf_rd_r', 'pf_rd_s', 'pf_rd_t', 'pf_rd_i', 'pf_rd_m',
                 '_encoding', 'psc', 'qid', 'sr', 'sprefix', 'crid',
                 'content-id', 'th', 'dib', 'dib_tag', 'smid', 'ref_',
                 'refRID', 'dchild', 'spIA', 'ms3_c', 'aaxitk', 'hsa_cr_id',
                 'social_share', 'starsLeft', 'skipTwisterOG', 'srs', 'colid',
                 'coliid',
                 // asc_refurl carries the page the link was clicked on
                 'source', 'asc_source', 'asc_refurl',
                 // bare ref, beside the ref_ above and the /ref= path segment
                 'ref'],
        affiliate: ['tag', 'ascsubtag', 'linkCode', 'creative', 'creativeASIN',
                    'asc_campaign', 'linkId'],
        patterns: ['^cv_ct_', '^sb-ci-'],
      },
      {
        name: 'eBay',
        hosts: ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it',
                'ebay.es', 'ebay.ca', 'ebay.com.au'],
        dnrDomains: ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it',
                     'ebay.es', 'ebay.ca', 'ebay.com.au'],
        // sojTags is eBay's own click-analytics blob, not a partner credit
        params: ['_trkparms', '_trksid', '_from', 'hash', 'amdata', 'sojTags'],
        affiliate: ['mkevt', 'mkcid', 'mkrid', 'campid', 'customid', 'toolid',
                    'mkgroupid', 'mkpid', 'mktype'],
      },
      {
        name: 'AliExpress / Taobao',
        hosts: ['aliexpress.com', 'aliexpress.us', 'taobao.com', 'tmall.com',
                'alibaba.com'],
        dnrDomains: ['aliexpress.com', 'aliexpress.us', 'taobao.com',
                     'tmall.com', 'alibaba.com'],
        params: ['spm', 'scm', 'pvid', 'algo_pvid', 'algo_expid', 'btsid',
                 'ws_ab_test', 'gatewayAdapt', 'terminal_id', 'sk', 'cv',
                 'af', 'dp', 'mall_affr', 'curPageLogUid', 'ad_pvid',
                 'gps-id', 'scm-url', 'scm_id', 'pdp_npi',
                 'ut_sk', 'sp_tk', 'share_crt_v',
                 'shareurl', 'short_name', 'suid', 'sourceType', 'ali_refid',
                 'ali_trackid', 'acm', 'utparam', 'abbucket', 'trackInfo',
                 'utkn', 'mytmenu', 'turing_bucket', 'lygClk', 'impid',
                 'bftTag', 'bftRwd', 'user_number_id'],
        affiliate: ['aff_fcid', 'aff_fsk', 'aff_platform', 'aff_trace_key',
                    'aff_request_id'],
      },
      {
        name: 'Bilibili',
        hosts: ['bilibili.com', 'b23.tv'],
        dnrDomains: ['bilibili.com', 'b23.tv'],
        params: ['spm_id_from', 'from_source', 'vd_source', 'share_source',
                 'share_medium', 'share_plat', 'share_session_id',
                 'share_tag', 'share_from', 'unique_k', 'bbid', 'ts',
                 'timestamp', 'buvid', 'is_story_h5', 'up_id', 'plat_id',
                 'from_spmid', 'msource', 'refer_from',
                 'seid', 'visit_id', 'broadcast_type', 'is_room_feed',
                 // spm_id_from's sibling, and two more referral trackers
                 'spmid', 'tdsourcetag', 'bsource', 'referfrom'],
      },
      {
        name: 'Google search',
        hosts: ['google.com'],
        hostRe: '^([a-z0-9-]+\\.)?google(\\.[a-z]{2,3}){1,2}$',
        dnrDomains: ['google.com', 'google.co.uk', 'google.de', 'google.fr',
                     'google.es', 'google.it', 'google.nl', 'google.ca',
                     'google.com.au', 'google.co.jp', 'google.co.in',
                     'google.com.br', 'google.pl', 'google.ru', 'google.be',
                     'google.ch', 'google.at', 'google.se', 'google.dk',
                     'google.no', 'google.fi', 'google.pt', 'google.ie'],
        params: ['ved', 'ei', 'sxsrf', 'sca_esv', 'sa', 'gs_lcp', 'gs_lcrp',
                 'gs_ssp', 'gs_l', 'sclient', 'uact', 'oq', 'usg', 'bih',
                 'biw', 'dpr', 'iflsig', 'aqs', 'rlz', 'source', 'sourceid',
                 'psi', 'ictx', 'cshid', 'vet', 'bshm',
                 'sei', 'gws_rd', 'gfe_rd', 'pcampaignid', 'fbs',
                 // gs_lp succeeds gs_lcp, sca_upv pairs with sca_esv, lei with ei
                 'gs_lp', 'sca_upv', 'lei',
                 // AI Mode conversation state; the page mints a fresh set
                 'mstk', 'csuir', 'mtid'],
      },
      {
        name: 'Twitch',
        hosts: ['twitch.tv'],
        dnrDomains: ['twitch.tv'],
        params: ['tt_content', 'tt_medium', 'sr', 'referrer'],
      },
      {
        name: 'Netflix',
        hosts: ['netflix.com'],
        dnrDomains: ['netflix.com'],
        params: ['trkid', 'tctx', 'trackId', 'trackIdEpisode', 'trackIdJaw',
                 'trackIdTrailer'],
      },
      {
        name: 'Steam',
        hosts: ['steampowered.com', 'steamcommunity.com'],
        dnrDomains: ['steampowered.com', 'steamcommunity.com'],
        params: ['snr', 'curator_clanid'],
      },
      {
        name: 'Etsy',
        hosts: ['etsy.com'],
        dnrDomains: ['etsy.com'],
        params: ['click_key', 'click_sum', 'ref', 'frs', 'sts',
                 'organic_search_click', 'bes', 'content_source', 'ga_order',
                 'ga_search_type', 'ga_view_type', 'ga_search_query',
                 // Etsy's own Google Ads/Shopping attribution codes, and a
                 // share-button timestamp
                 'gao', 'gpla', 'share_time'],
      },
      {
        name: 'Substack',
        hosts: ['substack.com'],
        dnrDomains: ['substack.com'],
        params: ['r', 'triedRedirect', 'showWelcomeOnShare', 'isFreemail',
                 'publication_id', 'profile_id'],
      },
      {
        name: 'Medium',
        hosts: ['medium.com'],
        dnrDomains: ['medium.com'],
        params: ['source', 'sk', 'gi', 'postPublishedType'],
      },
      {
        name: 'IMDb',
        hosts: ['imdb.com'],
        dnrDomains: ['imdb.com'],
        params: ['ref_', 'pf_rd_p', 'pf_rd_r', 'pf_rd_s', 'pf_rd_t',
                 'pf_rd_i', 'pf_rd_m'],
      },
      {
        name: 'Pinterest',
        hosts: ['pinterest.com', 'pin.it'],
        dnrDomains: ['pinterest.com', 'pin.it'],
        params: ['sender', 'invite_code', 'sfo', 'nic_v1', 'nic_v2',
                 'amp_client_id'],
      },
      {
        name: 'SoundCloud',
        hosts: ['soundcloud.com'],
        dnrDomains: ['soundcloud.com'],
        params: ['si', 'ref', 'in_system_playlist'],
      },
      {
        name: 'Apple',
        hosts: ['apple.com', 'apple.co'],
        dnrDomains: ['apple.com', 'apple.co'],
        params: ['uo', 'ls', 'itsct', 'itscg', 'cid',
                 'ign-itscg', 'ign-itsct'],
        // mttn* is the Mattermost/Apptentive-style attribution vendor
        // family mttnsubad already belonged to - all credit a sharer
        affiliate: ['at', 'ct', 'mttnsubad', 'mttn3pid', 'mttnagencyid',
                    'mttncc', 'mttnpid', 'mttnsiteid', 'mttnsubkw',
                    'mttnsubplmnt'],
      },
      {
        name: 'Vimeo',
        hosts: ['vimeo.com'],
        dnrDomains: ['vimeo.com'],
        params: ['share', 'fl', 'signup'],
      },
      {
        name: 'Zalando / Otto / Bol',
        hosts: ['zalando.com', 'zalando.de', 'zalando.fr', 'zalando.co.uk',
                'otto.de', 'bol.com'],
        dnrDomains: ['zalando.com', 'zalando.de', 'zalando.fr',
                     'zalando.co.uk', 'otto.de', 'bol.com'],
        params: ['tmad', 'tmcp', 'tms', 'wt_cc1', 'wt_cc2',
                 'wt_cc3', 'wt_cc4', 'wt_cc5', 'wt_cc6', 'wt_cc7', 'wt_cc8',
                 'wt_cc9', 'ug', 'Referrer'],
        affiliate: ['AffiliateID'],
      },
      {
        name: 'Booking / Expedia',
        hosts: ['booking.com', 'expedia.com', 'hotels.com'],
        dnrDomains: ['booking.com', 'expedia.com', 'hotels.com'],
        params: ['sb_price_type', 'srepoch', 'srpvid',
                 'from_sf', 'highlighted_blocks', 'MDPCID', 'MDPDTL'],
        affiliate: ['aid', 'label'],
      },
      {
        name: 'Stack Exchange',
        hosts: ['stackoverflow.com', 'stackexchange.com', 'superuser.com',
                'serverfault.com', 'askubuntu.com'],
        dnrDomains: ['stackoverflow.com', 'stackexchange.com', 'superuser.com',
                     'serverfault.com', 'askubuntu.com'],
        params: ['r', 'rq'],
      },
      {
        name: 'GitHub',
        hosts: ['github.com'],
        dnrDomains: ['github.com'],
        params: ['email_source', 'email_token', 'notification_referrer_id',
                 'ref_cta', 'ref_loc', 'ref_page', 'reference_location'],
      },
      {
        name: 'Bing / MSN',
        hosts: ['bing.com', 'msn.com'],
        dnrDomains: ['bing.com', 'msn.com'],
        // nclid is Bing's own click id, parallel to Nextdoor's ndclid above
        params: ['cvid', 'ocid', 'form', 'sk', 'sp', 'sc', 'qs', 'qp',
                 'nclid'],
      },
      {
        name: 'News sites',
        hosts: ['nytimes.com', 'cnet.com', 'gamespot.com', 'techcrunch.com',
                'reuters.com', 'forbes.com', 'cnbc.com', 'newyorker.com',
                'wired.com', 'nikkei.com'],
        dnrDomains: ['nytimes.com', 'cnet.com', 'gamespot.com',
                     'techcrunch.com', 'reuters.com', 'forbes.com', 'cnbc.com',
                     'newyorker.com', 'wired.com', 'nikkei.com'],
        params: ['smid', 'ftag', 'PostType', 'ServiceType', 'UniqueID',
                 'TheTime', 'sr_share', 'taid', 'sh', '__source', 'intcid',
                 'bxid', 'cndid', 'esrc', 'mbid', 'i_cid', 'n_cid', 'waad'],
      },
      {
        name: 'BBC',
        hosts: ['bbc.com', 'bbc.co.uk'],
        dnrDomains: ['bbc.com', 'bbc.co.uk'],
        params: ['at_medium', 'at_campaign', 'at_campaign_type', 'at_bbc_team',
                 'at_format', 'at_link_id', 'at_link_origin', 'at_link_type',
                 'at_ptr_name', 'at_ptr_type',
                 // BBC Live Page's "pinned post" feature and an internal
                 // link tracker on bbc.co.uk
                 'pinned_post_asset_id', 'pinned_post_locator',
                 'pinned_post_type', 'intlink_from_url', 'src_origin'],
        patterns: ['^at_[a-z_]+$'],
      },
      {
        name: 'Walmart / Best Buy',
        hosts: ['walmart.com', 'bestbuy.com'],
        dnrDomains: ['walmart.com', 'bestbuy.com'],
        // wl10-13, wmlspartner, selectedSellerId and veh ride along on a
        // Google Shopping referral; TinyTools tested that a product keeps
        // its colour, size and price once its whole query is stripped
        params: ['athbdg', 'athcpid', 'athpgid', 'athznid', 'athieid',
                 'athstid', 'athguid', 'athancid', 'athena', 'mpid',
                 'wl10', 'wl11', 'wl12', 'wl13', 'wmlspartner',
                 'selectedSellerId', 'veh', 'cn'],
        affiliate: ['u1', 'acampID'],
      },
      {
        name: 'Airbnb',
        hosts: ['airbnb.com', 'airbnb.co.uk', 'airbnb.de', 'airbnb.ca',
                'airbnb.com.au', 'airbnb.ie', 'airbnb.co.in'],
        dnrDomains: ['airbnb.com', 'airbnb.co.uk', 'airbnb.de', 'airbnb.ca',
                     'airbnb.com.au', 'airbnb.ie', 'airbnb.co.in'],
        params: ['federated_search_id', 'source_impression_id'],
      },
      {
        name: 'Shopee / Lazada',
        hosts: ['shopee.com', 'shopee.co.th', 'shopee.tw', 'lazada.com',
                'lazada.co.th', 'lazada.co.id', 'lazada.com.my',
                'lazada.com.ph', 'lazada.sg', 'lazada.vn'],
        dnrDomains: ['shopee.com', 'shopee.co.th', 'shopee.tw', 'lazada.com',
                     'lazada.co.th', 'lazada.co.id', 'lazada.com.my',
                     'lazada.com.ph', 'lazada.sg', 'lazada.vn'],
        params: ['publish_id', 'sp_atk', 'xptdk', 'clickTrackInfo', 'abid',
                 'ad_src', 'pid_pvid', 'impsrc', 'spm', 'scm', 'pvid',
                 // Lazada's own share/session tokens
                 'dsource', 'exlaz', 'laz_share_info', 'laz_token'],
      },
      {
        name: 'Flipkart',
        hosts: ['flipkart.com'],
        dnrDomains: ['flipkart.com'],
        params: ['otracker', 'otracker1', 'ssid', 'srno', 'ppt', 'ppn', 'hpid',
                 'qH', 'fm'],
      },
      {
        name: 'Mercado Libre',
        hosts: ['mercadolibre.com', 'mercadolivre.com'],
        dnrDomains: ['mercadolibre.com', 'mercadolivre.com'],
        params: ['tracking_id', 'search_layout', 'ad_click_id', 'DEAL_ID',
                 'reco_id', 'reco_item_pos', 'reco_backend',
                 'reco_backend_type', 'reco_client'],
        patterns: ['^c_[a-z_]+$', '^reco_[a-z_]+$'],
      },
      {
        name: 'Xiaohongshu / Weibo',
        hosts: ['xiaohongshu.com', 'weibo.com', 'weibo.cn'],
        dnrDomains: ['xiaohongshu.com', 'weibo.com', 'weibo.cn'],
        params: ['xhsshare', 'author_share', 'xsec_source',
                 'share_from_user_hidden', 'app_version', 'app_platform',
                 'apptime', 'appuid', 'shareRedId', 'share_id', 'exSource',
                 'ignoreEngage', 'weibo_id', 'dt_dapp'],
      },
      {
        name: 'Snapchat',
        hosts: ['snapchat.com'],
        dnrDomains: ['snapchat.com'],
        params: ['sc_referrer', 'sc_ua'],
      },
      {
        name: 'Goodreads',
        hosts: ['goodreads.com'],
        dnrDomains: ['goodreads.com'],
        params: ['from_search', 'from_srp', 'qid', 'rank'],
      },
      {
        name: 'Other shops and services',
        hosts: ['change.org', 'fiverr.com', 'quizlet.com', 'kahoot.it',
                'roblox.com', 'zillow.com', 'redfin.com', 'gog.com',
                'argos.co.uk', 'allrecipes.com', 'allegro.pl', 'meetup.com'],
        dnrDomains: ['change.org', 'fiverr.com', 'quizlet.com', 'kahoot.it',
                     'roblox.com', 'zillow.com', 'redfin.com', 'gog.com',
                     'argos.co.uk', 'allrecipes.com', 'allegro.pl',
                     'meetup.com'],
        params: ['source_location', 'psf_variant', 'share_intent',
                 'context_referrer', 'ref_ctx_id', 'funnelUUID',
                 'refer_method', 'refPageId', 'rtoken', 'riftinfo',
                 'track_click', 'link_id', 'istCompanyId', 'istFeedId',
                 'istItemId', 'istBid', 'clickOrigin', 'internalSource',
                 'referringId', 'referringContentType', 'reco_id', '_xtd'],
      },
    ],

    /* Tracking baked into the path rather than the query string. */
    pathRules: [
      {
        // youtu.be/ID&si=… - an "&" where the "?" should be, so the share ids
        // are part of the path and the network rules cannot see them. The
        // server turns them back into parameters on youtube.com, where they
        // are removed, but a copied link would still carry them.
        name: 'youtu.be share ids after "&" in the path',
        hosts: ['youtu.be'],
        re: '&(?:si|is|pp|feature)=[^&/?#]*',
        replace: '',
      },
      {
        name: 'Amazon /ref= path segment',
        hosts: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
                'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.co.jp',
                'amazon.com.au', 'amazon.in', 'amazon.com.br', 'amazon.nl',
                'amazon.se', 'amazon.pl', 'amazon.com.mx',
                'amazon.cn', 'amazon.sg', 'amazon.ae', 'amazon.sa',
                'amazon.eg', 'amazon.com.tr', 'amazon.com.be'],
        re: '/ref=[^/?#]*',
        replace: '',
      },
    ],

    /* Interstitial "click through" URLs whose real destination sits in a query
     * parameter. Unwrapped when cleaning a link (not during navigation).
     * `affiliate: true` marks an affiliate network's link: unwrapping it drops
     * the sharer's commission, so it only happens when affiliate removal is on.
     * Either way a redirector's own parameters are never edited. */
    redirects: [
      {
        hostRe: '^(www\\.)?google(\\.[a-z]{2,3}){1,2}$',
        // Needed by the network rules, which cannot evaluate hostRe.
        dnrDomains: ['google.com', 'google.co.uk', 'google.de', 'google.fr',
                     'google.es', 'google.it', 'google.nl', 'google.ca',
                     'google.com.au', 'google.co.jp', 'google.co.in',
                     'google.com.br', 'google.pl', 'google.ru', 'google.be',
                     'google.ch', 'google.at', 'google.se', 'google.dk',
                     'google.no', 'google.fi', 'google.pt', 'google.ie'],
        paths: ['/url'],
        params: ['q', 'url'],
      },
      { hosts: ['l.facebook.com', 'lm.facebook.com', 'l.messenger.com'], paths: ['/l.php'], params: ['u'] },
      { hosts: ['l.instagram.com', 'l.threads.net', 'l.threads.com'], params: ['u'] },
      { hosts: ['vk.com'], paths: ['/away.php'], params: ['to'] },
      { hosts: ['out.reddit.com', 'click.redditmail.com'], params: ['url'] },
      { hosts: ['t.umblr.com'], paths: ['/redirect'], params: ['z'] },
      { hosts: ['steamcommunity.com'], paths: ['/linkfilter/'], params: ['url'] },
      { hosts: ['youtube.com'], paths: ['/redirect'], params: ['q'] },
      { hosts: ['slack-redir.net'], params: ['url'] },
      { hosts: ['exit.sc', 'gate.sc'], params: ['url'] },
      { hosts: ['linkedin.com'], paths: ['/redir/redirect'], params: ['url'] },
      { hosts: ['href.li'], rawQueryIsUrl: true },
      { hosts: ['bing.com'], paths: ['/newtabredir'], params: ['url'] },
      { hosts: ['duckduckgo.com'], paths: ['/l/'], params: ['uddg'] },
      { hosts: ['googleadservices.com'], params: ['adurl'] },
      { hosts: ['curseforge.com'], paths: ['/linkout'], params: ['remoteUrl'] },
      { hosts: ['deviantart.com'], paths: ['/users/outgoing'], rawQueryIsUrl: true },
      { hosts: ['mailtrack.io'], params: ['url'] },
      { hosts: ['app.adjust.com'], params: ['redirect'] },

      // Affiliate networks
      { hosts: ['shareasale.com'], params: ['urllink', 'url'], affiliate: true },
      { hosts: ['click.linksynergy.com'], params: ['murl', 'RD_PARM1'], affiliate: true },
      // p is awclick.php's parameter; ued is cread.php's
      { hosts: ['awin1.com'], paths: ['/cread.php', '/awclick.php'],
        params: ['ued', 'p'], affiliate: true },
      { hosts: ['go.skimresources.com'], params: ['url'], affiliate: true },
      { hosts: ['redirect.viglink.com'], params: ['u'], affiliate: true },
      // tradedoubler.com covers every subdomain already: clk. and redir. too
      { hosts: ['tradedoubler.com'], params: ['url', '_td_deeplink'], affiliate: true },
      // Commission Junction's click domains
      { hosts: ['dpbolvw.net', 'anrdoezrs.net', 'jdoqocy.com', 'kqzyfj.com',
                'tkqlhce.com'], params: ['url'], affiliate: true },
      { hosts: ['ad.admitad.com'], params: ['ulp'], affiliate: true },
      { hosts: ['track.webgains.com'], params: ['wgtarget'], affiliate: true },
      { hosts: ['partner-ads.com'], params: ['htmlurl'], affiliate: true },
      { hosts: ['track.effiliation.com'], params: ['url'], affiliate: true },
      { hosts: ['digidip.net'], params: ['url'], affiliate: true },
      { hosts: ['idealo-partner.com'], params: ['trg'], affiliate: true },
      // A commerce-content redirector used by many media sites' "buy" links
      { hosts: ['redirectingat.com'], params: ['url'], affiliate: true },
      { hosts: ['ojrq.net'], paths: ['/p/'], params: ['return'], affiliate: true },
      // bizrate.com is Connexity's older brand, same redirect shape
      { hosts: ['rd.connexity.net', 'rd.bizrate.com'], paths: ['/rd'],
        params: ['t'], affiliate: true },
      { hosts: ['t.cfjump.com'], params: ['Url'], affiliate: true },
      // From Brave's Debouncer list and the linkcl npm package (see
      // docs/sources.md). Several of Brave's entries need base64-decoding
      // or path-regex extraction this project's redirect unwrapper does not
      // support (ActiveCampaign's lt.acemlnN.com family, ouo.today,
      // click.pstmrk.it, awstrack.me, AMP viewer paths); left for later.
      { hosts: ['shareasale-analytics.com'], params: ['urllink'], affiliate: true },
      { hosts: ['c.pepperjamnetwork.com'], params: ['url'], affiliate: true },
      { hosts: ['avantlink.com'], params: ['url'], affiliate: true },
      // Partnerize, formerly Performance Horizon
      { hosts: ['pntrac.com', 'pjtra.com', 'pntrs.com', 'gopjn.com'],
        params: ['url'], affiliate: true },
      { hosts: ['clixgalore.com'], params: ['AffDirectURL', 'LP'], affiliate: true },
      { hosts: ['ck.jp.ap.valuecommerce.com', 'atrrd.valuecommerce.com',
                'valuecommerce.ne.jp'], params: ['vc_url'], affiliate: true },
      { hosts: ['target.georiot.com'], params: ['GR_URL'], affiliate: true },
      // Impact.com's own and its "goto" retailer-branded redirect domains -
      // a large, rotating pool, all sharing the same param and path shape
      { hosts: ['pxf.io', 'sjv.io', 'pjatr.com', 'goto.target.com',
                'goto.walmart.com', 'goto.carters.com', 'c9ftyd.net', 'iyhh.net',
                'glg9ob.net', 'evyy.net', 'uikc.net', 'ztk5.net', 'rg35.net',
                '8ocm68.net', 'xovt.net', 'i114863.net', '58dp.net', '7tiv.net',
                '5ad6.net', 'q77h.net', '3uu8.net', 'uxsi.net', 'njih.net',
                'pdy5.net', 'igs4ds.net', 'mvvx.net', 'xwrk.net', 'fziv.net',
                'lvuv.net', 'xibx.net', 'attfm2.net', 'tkjf.net', 'a9yw.net',
                'pfm4.net', 'i254217.net', 'i182465.net', 'vthnbx.net',
                'ryvx.net', '7eer.net', 'microsoft.msafflnk.net', 'i312864.net',
                'tmfhgn.net', 'obak77.net', 'yvzx.net', 'ioym.net', 'ntaf.net',
                'zlwlj8.net', 'uvwgb9.net', '3anx.net', 'rrmo.net', 'i308314.net',
                'uqhv.net', 'vzew.net', 'qflm.net', 'rfvk.net', 'am3t9s.net'],
        paths: ['/c/'], params: ['u'], affiliate: true },

      // Non-affiliate redirects: nobody's commission to unwrap, just noise.
      { hosts: ['search.app'], params: ['link'] },
      { hosts: ['page.link'], params: ['ofl'] }, // Firebase Dynamic Links
      { hosts: ['c212.net'], params: ['u'] }, // PR Newswire
      { hosts: ['recruitics.com'], paths: ['/redirect'], params: ['rx_url'] },
      { hosts: ['t.mailpgn.com'], params: ['fl'] },
      { hosts: ['demdex.net'], params: ['d_rd'] }, // Adobe Audience Manager
      { hosts: ['d.agkn.com'], params: ['l1'] }, // Neustar/Agkn
      { hosts: ['ad.atdmt.com'], params: ['h'] }, // Microsoft Atlas
      { hosts: ['getprice.com.au'], params: ['link'] },
      { hosts: ['mailchimp.com'], paths: ['/mctx/clicks'], params: ['url'] },
    ],
  };

  root.CLEANURL_RULES = RULES;
  if (typeof module !== 'undefined' && module.exports) module.exports = RULES;
})(typeof globalThis !== 'undefined' ? globalThis : self);

/* ---- src/cleaner.js -------------------------------------------------- */
/*
 * CleanURL - URL rewriting logic.
 *
 * Pure, synchronous and dependency-free (beyond CLEANURL_RULES) so the same
 * code can run in the service worker, in an isolated content script, in the
 * page's main world and under Node for the tests.
 */
'use strict';
(function (root) {
  const RULES = root.CLEANURL_RULES;

  const DEFAULT_SETTINGS = {
    enabled: true,
    cleanAddressBar: true,
    cleanCopies: true,
    unwrapRedirects: true,
    removeAffiliate: false,
    allowlist: [],      // domains to leave completely alone
    customParams: [],   // extra names; "foo_*" is treated as a wildcard
    keepParams: [],     // names never removed, even if a rule matches
  };

  /* ------------------------------------------------------------------ *
   * Host helpers
   * ------------------------------------------------------------------ */

  function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
  }

  /** True when `host` is `domain` or a subdomain of it. */
  function hostMatches(host, domain) {
    const h = normalizeHost(host);
    const d = normalizeHost(domain);
    return !!d && (h === d || h.endsWith('.' + d));
  }

  const reCache = new Map();
  function toRegExp(source, flags) {
    const key = (flags || 'i') + ':' + source;
    let re = reCache.get(key);
    if (!re) {
      try {
        re = new RegExp(source, flags || 'i');
      } catch (e) {
        re = /(?!)/; // never matches
      }
      reCache.set(key, re);
    }
    return re;
  }

  function ruleMatchesHost(rule, host) {
    if (rule.hosts && rule.hosts.some((d) => hostMatches(host, d))) return true;
    if (rule.hostRe && toRegExp(rule.hostRe).test(normalizeHost(host))) return true;
    return false;
  }

  /*
   * Origins a browser reserves for itself: extensions may not run content
   * scripts there and declarativeNetRequest rules do not apply, so nothing this
   * extension does can reach them. Worth naming, because the symptom is
   * identical to a bug and the advice for a bug ("reload the page") is wrong.
   *
   * The lists differ per browser, and this one is the union: a site restricted
   * in Firefox is ordinary in Chrome and the other way round. So this only ever
   * explains a content script that is already known to be missing - it must
   * never be used to predict one, or Chrome would be told it cannot run on
   * support.mozilla.org, where it runs perfectly well.
   */
  const BROWSER_RESTRICTED = [
    // Chrome
    { host: 'chromewebstore.google.com' },
    { host: 'chrome.google.com', path: '/webstore' },
    // Firefox: the default extensions.webextensions.restrictedDomains list.
    { host: 'accounts-static.cdn.mozilla.net' },
    { host: 'accounts.firefox.com' },
    { host: 'addons.cdn.mozilla.net' },
    { host: 'addons.mozilla.org' },
    { host: 'api.accounts.firefox.com' },
    { host: 'content.cdn.mozilla.net' },
    { host: 'discovery.addons.mozilla.org' },
    { host: 'input.mozilla.org' },
    { host: 'install.mozilla.org' },
    { host: 'oauth.accounts.firefox.com' },
    { host: 'profile.accounts.firefox.com' },
    { host: 'support.mozilla.org' },
    { host: 'sync.services.mozilla.com' },
    { host: 'testpilot.firefox.com' },
  ];

  function isBrowserRestricted(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return false;
    }
    return BROWSER_RESTRICTED.some((entry) => hostMatches(parsed.hostname, entry.host) &&
      (!entry.path || parsed.pathname.startsWith(entry.path)));
  }

  function isAllowlisted(host, allowlist) {
    if (!allowlist || !allowlist.length) return false;
    return allowlist.some((d) => hostMatches(host, d));
  }

  /** "utm_*" -> /^utm_.*$/i, anything else is matched literally. */
  function wildcardToRegExp(pattern) {
    const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return toRegExp('^' + escaped.replace(/\\\*/g, '.*') + '$');
  }

  /* ------------------------------------------------------------------ *
   * Parameter matching
   * ------------------------------------------------------------------ */

  const matcherCache = new Map();

  function settingsKey(settings) {
    return [
      settings.removeAffiliate ? 1 : 0,
      (settings.customParams || []).join(','),
      (settings.keepParams || []).join(','),
    ].join('|');
  }

  /** Builds `name => shouldRemove` for a given host. */
  function buildMatcher(host, settings) {
    // A NUL separator cannot occur in a hostname or a settings key, so the
    // cache key is unambiguous. Written as an escape: a literal NUL byte in
    // the source makes git treat the file as binary.
    const key = normalizeHost(host) + '\u0000' + settingsKey(settings);
    const cached = matcherCache.get(key);
    if (cached) return cached;

    const exact = new Set();
    const regexes = [];
    const add = (list) => {
      for (const name of list || []) exact.add(String(name).toLowerCase());
    };

    add(RULES.globalParams);
    for (const source of RULES.globalPatterns) regexes.push(toRegExp(source));
    if (settings.removeAffiliate) add(RULES.affiliateParams);

    for (const site of RULES.sites) {
      if (!ruleMatchesHost(site, host)) continue;
      add(site.params);
      for (const source of site.patterns || []) regexes.push(toRegExp(source));
      if (settings.removeAffiliate) add(site.affiliate);
    }

    for (const custom of settings.customParams || []) {
      const name = String(custom).trim();
      if (!name) continue;
      if (name.includes('*')) regexes.push(wildcardToRegExp(name));
      else exact.add(name.toLowerCase());
    }

    const keep = new Set(
      (settings.keepParams || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean)
    );

    const matcher = (name) => {
      const lower = String(name).toLowerCase();
      if (keep.has(lower)) return false;
      if (exact.has(lower)) return true;
      return regexes.some((re) => re.test(name));
    };

    if (matcherCache.size > 200) matcherCache.clear();
    matcherCache.set(key, matcher);
    return matcher;
  }

  /* ------------------------------------------------------------------ *
   * Query string rewriting
   * ------------------------------------------------------------------ */

  function decodeName(raw) {
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch (e) {
      return raw;
    }
  }

  /**
   * Filters `query` (no leading "?") keeping each surviving pair byte for
   * byte, so we never re-encode parts of the URL we are not removing.
   */
  function filterQuery(query, matcher, removed) {
    if (!query) return query;
    const kept = [];
    for (const pair of query.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const name = decodeName(eq === -1 ? pair : pair.slice(0, eq));
      if (matcher(name)) removed.push(name);
      else kept.push(pair);
    }
    return kept.join('&');
  }

  /** Only treat a fragment as tracker-bearing when it is a pure query string. */
  function isQueryLikeFragment(fragment) {
    return !!fragment && /^[^/?#]*=[^#]*$/.test(fragment) && !fragment.includes(' ');
  }

  /* ------------------------------------------------------------------ *
   * Redirect unwrapping
   * ------------------------------------------------------------------ */

  function parseHttpUrl(value) {
    if (!value) return null;
    let url = null;
    try {
      url = new URL(value);
    } catch (e) {
      try {
        url = new URL(decodeURIComponent(value));
      } catch (e2) {
        return null;
      }
    }
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  }

  function matchesRedirect(rule, url) {
    if (!ruleMatchesHost(rule, url.hostname)) return false;
    if (!rule.paths) return true;
    return rule.paths.some((p) => url.pathname === p || url.pathname.startsWith(p));
  }

  /*
   * An interstitial whose parameters are its payload and its signature. These
   * are unwrapped, never edited: google.com/url rejects the whole request as
   * invalid if usg is missing, so stripping the trackers Google puts on its own
   * search results would break the link rather than clean it.
   */
  function isRedirector(url) {
    let parsed;
    try {
      parsed = typeof url === 'string' ? new URL(url) : url;
    } catch (e) {
      return false;
    }
    return RULES.redirects.some((rule) => matchesRedirect(rule, parsed));
  }

  function unwrapRedirect(url, depth, settings) {
    if (depth > 3) return url;
    for (const rule of RULES.redirects) {
      if (rule.affiliate && !settings.removeAffiliate) continue;
      if (!matchesRedirect(rule, url)) continue;
      if (rule.rawQueryIsUrl) {
        const target = parseHttpUrl(decodeName(url.search.slice(1)));
        if (target) return unwrapRedirect(target, depth + 1, settings);
      }
      for (const param of rule.params || []) {
        const target = parseHttpUrl(url.searchParams.get(param));
        if (target) return unwrapRedirect(target, depth + 1, settings);
      }
    }
    return url;
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  /**
   * @returns {{url: string, changed: boolean, removed: string[], unwrapped: boolean}}
   *          `url` is the original string unchanged when nothing matched, so
   *          URL normalisation never leaks into text the user copied.
   */
  function cleanUrl(input, options) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, options || {});
    const result = { url: input, changed: false, removed: [], unwrapped: false };
    if (!settings.enabled || typeof input !== 'string' || !input) return result;

    let url;
    try {
      url = new URL(input);
    } catch (e) {
      return result;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return result;
    if (isAllowlisted(url.hostname, settings.allowlist)) return result;

    if (settings.unwrapRedirects) {
      const target = unwrapRedirect(url, 0, settings);
      if (target !== url) {
        if (isAllowlisted(target.hostname, settings.allowlist)) return result;
        url = target;
        result.unwrapped = true;
      }
    }

    /*
     * Still on a redirector: unwrapping is switched off, or the target could
     * not be read. Either way its parameters must be left exactly as they are.
     */
    if (isRedirector(url)) return result;

    const matcher = buildMatcher(url.hostname, settings);
    const removed = [];

    const query = filterQuery(url.search.slice(1), matcher, removed);
    if (removed.length) url.search = query ? '?' + query : '';

    const fragment = url.hash.slice(1);
    if (isQueryLikeFragment(fragment)) {
      const before = removed.length;
      const cleanedFragment = filterQuery(fragment, matcher, removed);
      if (removed.length > before) url.hash = cleanedFragment ? '#' + cleanedFragment : '';
    }

    let pathChanged = false;
    for (const rule of RULES.pathRules) {
      if (!ruleMatchesHost(rule, url.hostname)) continue;
      // Global: a path can carry the same tracker more than once.
      const next = url.pathname.replace(toRegExp(rule.re, 'gi'), rule.replace);
      if (next !== url.pathname) {
        url.pathname = next || '/';
        pathChanged = true;
      }
    }

    result.changed = result.unwrapped || removed.length > 0 || pathChanged;
    result.removed = removed;
    if (result.changed) result.url = url.href;
    return result;
  }

  /* Matches an http(s) URL inside arbitrary text. */
  const URL_IN_TEXT = /https?:\/\/[^\s<>"'`\\|^{}[\]]+/gi;
  const CLOSERS = { ')': '(', ']': '[', '}': '{' };

  /** Drops sentence punctuation that the greedy match swallowed. */
  function trimTrailingPunctuation(candidate) {
    let end = candidate.length;
    while (end > 0) {
      const ch = candidate[end - 1];
      if ('.,;:!?"\''.includes(ch)) {
        end--;
        continue;
      }
      if (CLOSERS[ch]) {
        const head = candidate.slice(0, end);
        const opens = head.split(CLOSERS[ch]).length - 1;
        const closes = head.split(ch).length - 1;
        if (closes > opens) {
          end--;
          continue;
        }
      }
      break;
    }
    return candidate.slice(0, end);
  }

  /**
   * Rewrites every URL found in a block of text, leaving everything else
   * (including surrounding punctuation) byte for byte identical.
   *
   * @returns {{text: string, changed: boolean, count: number, removed: string[]}}
   *          `removed` is every parameter name dropped, in order and without
   *          repeats, so a caller can say what it actually did.
   */
  function cleanText(text, options) {
    if (typeof text !== 'string' || text.indexOf('http') === -1) {
      return { text: text, changed: false, count: 0, removed: [] };
    }
    let count = 0;
    const removed = [];
    const output = text.replace(URL_IN_TEXT, (match) => {
      const candidate = trimTrailingPunctuation(match);
      const tail = match.slice(candidate.length);
      const cleaned = cleanUrl(candidate, options);
      if (!cleaned.changed) return match;
      count++;
      for (const name of cleaned.removed) {
        if (removed.indexOf(name) === -1) removed.push(name);
      }
      return cleaned.url + tail;
    });
    return { text: output, changed: count > 0, count: count, removed: removed };
  }

  /**
   * Cleans hrefs and text nodes of an HTML fragment. Needs a DOM, so it is a
   * no-op in the service worker.
   */
  function cleanHtml(html, options) {
    if (typeof html !== 'string' || !html) return { html: html, changed: false };
    if (typeof root.DOMParser === 'undefined') return { html: html, changed: false };
    let doc;
    try {
      doc = new root.DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return { html: html, changed: false };
    }
    let changed = false;

    for (const el of doc.querySelectorAll('a[href], area[href]')) {
      const cleaned = cleanUrl(el.getAttribute('href'), options);
      if (cleaned.changed) {
        el.setAttribute('href', cleaned.url);
        changed = true;
      }
    }

    const walker = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      const cleaned = cleanText(node.nodeValue, options);
      if (cleaned.changed) {
        node.nodeValue = cleaned.text;
        changed = true;
      }
    }

    return { html: changed ? doc.body.innerHTML : html, changed: changed };
  }

  const API = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    cleanUrl: cleanUrl,
    cleanText: cleanText,
    cleanHtml: cleanHtml,
    hostMatches: hostMatches,
    isAllowlisted: isAllowlisted,
    isBrowserRestricted: isBrowserRestricted,
    isRedirector: isRedirector,
    normalizeHost: normalizeHost,
  };

  root.CleanURL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : self);

/* ---- src/copy-guard.js ----------------------------------------------- */
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
   *   report(kind, count, detail) - detail says what was cleaned, for the
   *     debug log
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
        report('copy', result.count,
          { source: 'copy event', from: source, to: result.text, removed: result.removed });
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

/* ---- src/content-main.js --------------------------------------------- */
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

  /*
   * `detail` (what was cleaned) only goes out in the debug build: this event
   * is visible to the page, which has no business seeing the user's copies
   * described back to it otherwise.
   */
  function report(kind, count, detail) {
    try {
      document.dispatchEvent(new CustomEvent('cleanurl:report', {
        detail: JSON.stringify({ kind: kind, count: count,
                                 detail: settings && settings.debug ? detail : undefined }),
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
          report('copy', result.count, { source: 'clipboard.writeText',
            from: String(text), to: result.text, removed: result.removed });
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
          report('copy', result.count, { source: 'ClipboardItem',
            from: text, to: result.text, removed: result.removed });
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
              report('copy', result.count, { source: 'setData',
                from: String(data), to: result.text, removed: result.removed });
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
          const removed = [];
          if (typeof next.url === 'string') {
            const result = Clean.cleanUrl(next.url, settings);
            if (result.changed) { next.url = result.url; changed = true; removed.push(...result.removed); }
          }
          if (typeof next.text === 'string') {
            const result = Clean.cleanText(next.text, settings);
            if (result.changed) { next.text = result.text; changed = true; removed.push(...result.removed); }
          }
          if (changed) {
            payload = next;
            report('copy', 1, { source: 'navigator.share',
              from: data.url || data.text, to: next.url || next.text, removed: removed });
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
              report('url', result.removed.length || 1, { source: 'history.' + method,
                from: absolute.href, to: result.url, removed: result.removed });
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

