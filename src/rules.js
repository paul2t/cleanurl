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
        params: ['igsh', 'igshid', 'igsi', 'xmt', 'img_index_share', 'psln',
                 'stkn'],
      },
      {
        name: 'X / Twitter',
        hosts: ['twitter.com', 'x.com'],
        dnrDomains: ['twitter.com', 'x.com'],
        params: ['s', 't', 'cxt', 'ref_src', 'ref_url', 'twclid', 'src',
                 'cn'],
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
                 'hc_ref', 'hc_location', 'fref', '__xts__[0]'],
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
                 'user_id', 'share_app_name'],
      },
      {
        name: 'Reddit',
        hosts: ['reddit.com', 'redd.it'],
        dnrDomains: ['reddit.com', 'redd.it'],
        params: ['share_id', 'correlation_id', 'ref_campaign', 'ref_source',
                 'rdt', 'post_fullname', '$deep_link', '$original_url',
                 'chainedPosts',
                 '$3p'],
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
                 'trkEmail', 'originTrackingId', 'refId', 'eBP', 'rcm'],
      },
      {
        name: 'Amazon',
        hosts: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
                'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.co.jp',
                'amazon.com.au', 'amazon.in', 'amazon.com.br', 'amazon.nl',
                'amazon.se', 'amazon.pl', 'amazon.com.mx', 'amzn.to'],
        dnrDomains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
                     'amazon.it', 'amazon.es', 'amazon.ca', 'amazon.co.jp',
                     'amazon.com.au', 'amazon.in', 'amazon.com.br',
                     'amazon.nl', 'amazon.se', 'amazon.pl', 'amazon.com.mx'],
        params: ['pd_rd_w', 'pd_rd_wg', 'pd_rd_r', 'pd_rd_i', 'pf_rd_p',
                 'pf_rd_r', 'pf_rd_s', 'pf_rd_t', 'pf_rd_i', 'pf_rd_m',
                 '_encoding', 'psc', 'qid', 'sr', 'sprefix', 'crid',
                 'content-id', 'th', 'dib', 'dib_tag', 'smid', 'ref_',
                 'refRID', 'dchild', 'spIA', 'ms3_c', 'aaxitk', 'hsa_cr_id',
                 'social_share', 'starsLeft', 'skipTwisterOG', 'srs', 'colid',
                 'coliid',
                 // asc_refurl carries the page the link was clicked on
                 'source', 'asc_source', 'asc_refurl'],
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
        params: ['_trkparms', '_trksid', '_from', 'hash', 'amdata'],
        affiliate: ['mkevt', 'mkcid', 'mkrid', 'campid', 'customid', 'toolid'],
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
                 'seid', 'visit_id', 'broadcast_type', 'is_room_feed'],
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
                 'sei', 'gws_rd', 'gfe_rd', 'pcampaignid', 'fbs'],
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
        params: ['trkid', 'tctx', 'trackId'],
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
                 'ga_search_type', 'ga_view_type', 'ga_search_query'],
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
        params: ['uo', 'ls', 'itsct', 'itscg', 'mttnsubad', 'cid',
                 'ign-itscg', 'ign-itsct'],
        affiliate: ['at', 'ct'],
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
        params: ['email_source', 'email_token', 'notification_referrer_id'],
      },
      {
        name: 'Bing / MSN',
        hosts: ['bing.com', 'msn.com'],
        dnrDomains: ['bing.com', 'msn.com'],
        params: ['cvid', 'ocid', 'form', 'sk', 'sp', 'sc', 'qs', 'qp'],
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
                 'at_ptr_name', 'at_ptr_type'],
        patterns: ['^at_[a-z_]+$'],
      },
      {
        name: 'Walmart / Best Buy',
        hosts: ['walmart.com', 'bestbuy.com'],
        dnrDomains: ['walmart.com', 'bestbuy.com'],
        params: ['athbdg', 'athcpid', 'athpgid', 'athznid', 'athieid',
                 'athstid', 'athguid', 'athancid', 'athena', 'mpid'],
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
                 'ad_src', 'pid_pvid', 'impsrc', 'spm', 'scm', 'pvid'],
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
                'amazon.se', 'amazon.pl', 'amazon.com.mx'],
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
      { hosts: ['awin1.com'], params: ['ued'], affiliate: true },
      { hosts: ['go.skimresources.com'], params: ['url'], affiliate: true },
      { hosts: ['redirect.viglink.com'], params: ['u'], affiliate: true },
      { hosts: ['clk.tradedoubler.com'], params: ['url', '_td_deeplink'], affiliate: true },
      // Commission Junction's click domains
      { hosts: ['dpbolvw.net', 'anrdoezrs.net', 'jdoqocy.com', 'kqzyfj.com',
                'tkqlhce.com'], params: ['url'], affiliate: true },
      { hosts: ['ad.admitad.com'], params: ['ulp'], affiliate: true },
      { hosts: ['track.webgains.com'], params: ['wgtarget'], affiliate: true },
      { hosts: ['partner-ads.com'], params: ['htmlurl'], affiliate: true },
      { hosts: ['track.effiliation.com'], params: ['url'], affiliate: true },
      { hosts: ['digidip.net'], params: ['url'], affiliate: true },
      { hosts: ['idealo-partner.com'], params: ['trg'], affiliate: true },
    ],
  };

  root.CLEANURL_RULES = RULES;
  if (typeof module !== 'undefined' && module.exports) module.exports = RULES;
})(typeof globalThis !== 'undefined' ? globalThis : self);
