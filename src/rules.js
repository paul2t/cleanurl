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
        // igsh, igsi, stkn, xtok and cplk all carry the same per-share id,
        // base64 of a short random string: Instagram keeps renaming it.
        params: ['igsh', 'igshid', 'igsi', 'xmt', 'img_index_share', 'psln',
                 'stkn', 'xtok', 'cplk'],
        /*
         * Since late 2026 every share gets a fresh, random parameter name
         * (dlrf, xtok, ...), so naming them cannot keep up. On a post's own
         * page, keep only what does something and drop the rest. img_index
         * opens a carousel at the right slide; the post is in the path.
         */
        keepOnly: {
          hosts: ['instagram.com'],
          paths: ['/p/', '/reel/', '/reels/', '/tv/'],
          params: ['img_index'],
        },
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
        // Best-seller lists add the session id after it, as its own segment:
        // /ref=zg_bsnr_…/257-9953909-8897161. It goes with the ref.
        re: '/ref=[^/?#]*(?:/\\d{3}-\\d{7}-\\d{7}(?=[/?#]|$))?',
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
