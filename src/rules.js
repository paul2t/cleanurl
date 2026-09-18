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
      'fbadid', 'fb_comment_id',

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
      'twclid', 'ttclid', 'li_fat_id', 'epik', 'rdt_cid', 'irclickid',
      'irgwc', 'obOrigUrl', 'outbrainclickid', 'tblci', 'wickedid',
      'wickedsource', 'wickedpicked', 'oly_anon_id', 'oly_enc_id',
      'rb_clickid', 's_kwcid', 'ef_id', 'cjevent', 'awc', 'sscid',
      'dicbo', 'sc_customer', 'igshid', 'guccounter', 'guce_referrer',
      'guce_referrer_sig', 'mibextid', 'ncid', 'ito', 'icid', 'cmpid',
      'CMP', 'cmp', 'ref_src', 'ref_url', 'soc_src', 'soc_trk',
      'trk_contact', 'trk_msg', 'trk_module', 'trk_sid',

      // Matomo / Piwik
      'pk_campaign', 'pk_kwd', 'pk_medium', 'pk_source', 'pk_content',
      'pk_cid', 'pk_vid', 'piwik_campaign', 'piwik_kwd', 'piwik_keyword',
      'matomo_campaign', 'matomo_kwd', 'matomo_keyword',

      // Adobe / AT Internet / AWS docs
      's_cid', 'ss_email_id', 'sc_campaign', 'sc_channel', 'sc_content',
      'sc_medium', 'sc_outcome', 'sc_geo', 'sc_country', 'sc_publisher',
      'sc_detail', 'sc_segment', 'sc_category',

      // Misc newsletter / CMS campaign tags
      'hmb_campaign', 'hmb_medium', 'hmb_source', 'campaign_id', 'ceneo_spo',
      'itm_source', 'itm_medium', 'itm_campaign', 'itm_term', 'itm_content',
      'stm_source', 'stm_medium', 'stm_campaign', 'stm_term', 'stm_content',
      'cid_source', 'campaignid', 'adgroupid', 'adid', 'ad_id',
      'assetId', 'wtrid', 'xtor',
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
                 'source_ve_path', 'themeRefresh'],
      },
      {
        name: 'Instagram / Threads',
        hosts: ['instagram.com', 'threads.net', 'threads.com'],
        dnrDomains: ['instagram.com', 'threads.net', 'threads.com'],
        params: ['igsh', 'igshid', 'xmt', 'img_index_share'],
      },
      {
        name: 'X / Twitter',
        hosts: ['twitter.com', 'x.com'],
        dnrDomains: ['twitter.com', 'x.com'],
        params: ['s', 't', 'cxt', 'ref_src', 'ref_url', 'twclid', 'src'],
      },
      {
        name: 'Facebook',
        hosts: ['facebook.com', 'fb.com', 'fb.watch', 'messenger.com'],
        dnrDomains: ['facebook.com', 'fb.com', 'fb.watch', 'messenger.com'],
        params: ['mibextid', '__tn__', '__cft__[0]', '__cft__[1]', '__so__',
                 'rdid', 'refsrc', 'hrc', 'dti', 'video_source', 'extid',
                 'paipv', 'eav', '_rdr'],
      },
      {
        name: 'TikTok',
        hosts: ['tiktok.com'],
        dnrDomains: ['tiktok.com'],
        params: ['is_from_webapp', 'sender_device', 'sender_web_id', 'web_id',
                 '_r', '_t', '_d', 'share_app_id', 'share_item_id',
                 'share_link_id', 'share_iid', 'tt_from', 'source',
                 'preview_pb', 'checksum', 'u_code', 'timestamp',
                 'social_sharing', 'enable_checksum'],
      },
      {
        name: 'Reddit',
        hosts: ['reddit.com', 'redd.it'],
        dnrDomains: ['reddit.com', 'redd.it'],
        params: ['share_id', 'correlation_id', 'ref_campaign', 'ref_source',
                 'rdt', 'post_fullname', '$deep_link', '$original_url',
                 '_branch_match_id', '_branch_referrer', 'chainedPosts'],
      },
      {
        name: 'Spotify',
        hosts: ['spotify.com', 'spotify.link'],
        dnrDomains: ['spotify.com', 'spotify.link'],
        params: ['si', 'nd', 'nid', '_branch_match_id'],
      },
      {
        name: 'LinkedIn',
        hosts: ['linkedin.com', 'lnkd.in'],
        dnrDomains: ['linkedin.com', 'lnkd.in'],
        params: ['trk', 'trackingId', 'lipi', 'licu', 'midToken', 'midSig',
                 'trkEmail', 'originTrackingId', 'refId', 'eBP'],
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
                 'content-id', 'th', 'dib', 'dib_tag', 'smid', 'linkId',
                 'ref_'],
        affiliate: ['tag', 'ascsubtag', 'linkCode', 'creative', 'creativeASIN'],
      },
      {
        name: 'eBay',
        hosts: ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it',
                'ebay.es', 'ebay.ca', 'ebay.com.au'],
        dnrDomains: ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it',
                     'ebay.es', 'ebay.ca', 'ebay.com.au'],
        params: ['_trkparms', '_trksid', '_from', 'hash', 'mkevt', 'mkcid',
                 'mkrid', 'campid', 'customid', 'toolid', 'amdata'],
      },
      {
        name: 'AliExpress / Taobao',
        hosts: ['aliexpress.com', 'aliexpress.us', 'taobao.com', 'tmall.com',
                'alibaba.com'],
        dnrDomains: ['aliexpress.com', 'aliexpress.us', 'taobao.com',
                     'tmall.com', 'alibaba.com'],
        params: ['spm', 'scm', 'pvid', 'algo_pvid', 'algo_expid', 'btsid',
                 'ws_ab_test', 'gatewayAdapt', 'aff_fcid', 'aff_fsk',
                 'aff_platform', 'aff_trace_key', 'terminal_id', 'sk', 'cv',
                 'af', 'dp', 'mall_affr', 'curPageLogUid', 'ad_pvid',
                 'gps-id', 'scm-url', 'scm_id', 'pdp_npi'],
      },
      {
        name: 'Bilibili',
        hosts: ['bilibili.com', 'b23.tv'],
        dnrDomains: ['bilibili.com', 'b23.tv'],
        params: ['spm_id_from', 'from_source', 'vd_source', 'share_source',
                 'share_medium', 'share_plat', 'share_session_id',
                 'share_tag', 'share_from', 'unique_k', 'bbid', 'ts',
                 'timestamp', 'buvid', 'is_story_h5', 'up_id', 'plat_id',
                 'from_spmid', 'msource', 'refer_from'],
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
                 'psi', 'ictx', 'cshid', 'vet', 'bshm'],
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
        params: ['uo', 'ct', 'ls', 'itsct', 'itscg', 'mttnsubad', 'cid'],
        affiliate: ['at'],
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
        params: ['tmad', 'tmcp', 'tms', 'wt_mc', 'wt_cc1', 'wt_cc2',
                 'wt_cc3', 'wt_cc4', 'wt_cc5', 'wt_cc6', 'wt_cc7', 'wt_cc8',
                 'wt_cc9', 'ug', 'AffiliateID', 'Referrer'],
      },
      {
        name: 'Booking / Expedia',
        hosts: ['booking.com', 'expedia.com', 'hotels.com'],
        dnrDomains: ['booking.com', 'expedia.com', 'hotels.com'],
        params: ['aid', 'label', 'sb_price_type', 'srepoch', 'srpvid',
                 'from_sf', 'highlighted_blocks', 'MDPCID', 'MDPDTL'],
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
    ],

    /* Tracking baked into the path rather than the query string. */
    pathRules: [
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
     * parameter. Unwrapped when cleaning a link (not during navigation). */
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
      { hosts: ['away.vk.com'], paths: ['/away.php'], params: ['to'] },
      { hosts: ['out.reddit.com'], params: ['url'] },
      { hosts: ['t.umblr.com'], paths: ['/redirect'], params: ['z'] },
      { hosts: ['steamcommunity.com'], paths: ['/linkfilter/'], params: ['url'] },
      { hosts: ['youtube.com'], paths: ['/redirect'], params: ['q'] },
      { hosts: ['slack-redir.net'], params: ['url'] },
      { hosts: ['exit.sc', 'gate.sc'], params: ['url'] },
      { hosts: ['shareasale.com'], params: ['urllink', 'url'] },
      { hosts: ['click.linksynergy.com'], params: ['murl', 'RD_PARM1'] },
      { hosts: ['linkedin.com'], paths: ['/redir/redirect'], params: ['url'] },
      { hosts: ['href.li'], rawQueryIsUrl: true },
      { hosts: ['bing.com'], paths: ['/newtabredir'], params: ['url'] },
    ],
  };

  root.CLEANURL_RULES = RULES;
  if (typeof module !== 'undefined' && module.exports) module.exports = RULES;
})(typeof globalThis !== 'undefined' ? globalThis : self);
