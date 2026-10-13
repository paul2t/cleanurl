/* Run with: node test/cleaner.test.js */
'use strict';

require('../src/rules.js');
const Clean = require('../src/cleaner.js');

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failures.push(`${label}\n    expected: ${expected}\n    actual:   ${actual}`);
  }
}

function url(label, input, expected, options) {
  check(label, Clean.cleanUrl(input, options).url, expected);
}

function text(label, input, expected, options) {
  check(label, Clean.cleanText(input, options).text, expected);
}

/* ---------------------------------------------------------------- *
 * Campaign trackers
 * ---------------------------------------------------------------- */
url('utm_* stripped, real params kept',
  'https://example.com/article?id=42&utm_source=newsletter&utm_medium=email&utm_campaign=spring',
  'https://example.com/article?id=42');

url('sole tracker leaves no dangling ?',
  'https://example.com/article?utm_source=x',
  'https://example.com/article');

url('unknown utm variant caught by pattern',
  'https://example.com/?utm_totally_new=1&keep=2',
  'https://example.com/?keep=2');

url('google/meta/microsoft click ids',
  'https://shop.example.com/p/1?gclid=abc&fbclid=def&msclkid=ghi&mc_cid=jkl&size=large',
  'https://shop.example.com/p/1?size=large');

url('matomo mtm_*, seznam sznclid and dop_* recommendation ids',
  'https://example.cz/a?mtm_campaign=x&sznclid=abc&dop_ab_variant=1&dop_id=2&page=2',
  'https://example.cz/a?page=2');

url('email, webtrends, hootsuite and wikipedia trackers',
  'https://example.com/a?_bta_tid=1&gdfms=2&dm_i=3&WT.mc_id=4&hootPostID=5&wprov=sfla1&sms_click=6&keep=1',
  'https://example.com/a?keep=1');

url('branch.io ids removed on any site',
  'https://example.com/a?_branch_match_id=123&_branch_referrer=abc',
  'https://example.com/a');

url('attribution tools from the tracking params registry',
  'https://shop.example/p?ndclid=1&ScCid=2&tw_source=fb&nbt=x&nb_placement=y&klar_cpid=3&bg_source=g&h_ad_id=4&cq_src=z&color=red',
  'https://shop.example/p?color=red');

url('French "nb" fields are not mistaken for Northbeam tags',
  'https://boutique.example/liste?nb_articles=20&nb_pages=3',
  'https://boutique.example/liste?nb_articles=20&nb_pages=3');

url('Merchant Center promo codes are kept (they give the shopper a discount)',
  'https://shop.example/p?gPromoCode=SAVE10&utm_source=google',
  'https://shop.example/p?gPromoCode=SAVE10');

url('ad reporting, newsletter and ShareThis ids on any site',
  'https://shop.example/p?matchtype=e&adgroup=1&adposition=2&tiktok_r=3&ck_subscriber_id=4&_bhlid=5&sthash=6&utm_nooverride=1&utm_ad=7&size=M',
  'https://shop.example/p?size=M');

url('generic names a site may need are kept everywhere',
  'https://example.com/a?ref=nav&referrer=x&source=menu&campaign=flood-relief&trk=1',
  'https://example.com/a?ref=nav&referrer=x&source=menu&campaign=flood-relief&trk=1');

url('hubspot email, cookies, ads and social sharing',
  'https://blog.example/post?_hsenc=p2ANq&_hsmi=12&__hstc=1.2&__hssc=3&__hsfp=4&hsa_cam=5&hsa_new_thing=6&hss_channel=tw-613456&page=2',
  'https://blog.example/post?page=2');

url('Bing MUID, GA client id, trk camelCase and newsletter tagging',
  'https://example.com/a?msockid=0a1b&ga_cid=123.456&trkCampaign=x&trkContact=y&email_campaign=z&email_placement=hero&email_source=newsletter&id=7',
  'https://example.com/a?id=7');

url('unknown trk_* variant caught by pattern',
  'https://example.com/a?trk_new_thing=1&trk=keep',
  'https://example.com/a?trk=keep');

url('otm_* campaign family, mc_tc and Eloqua recipient ids',
  'https://shop.example/p?otm_source=x&otm_medium=y&otm_campaign=z&mc_tc=1&recipientId=2&elqTrackId=3&elqTrack=4&utm_userid=5&utm_mailing=6&_epik=7&id=8',
  'https://shop.example/p?id=8');

url('AppsFlyer attribution fields, deep-link destinations kept',
  'https://app.example/x?af_ad=1&af_ad_id=2&af_adset=3&af_channel=4&af_sub1=5&af_sub5=6&af_c_id=7&af_dp=myapp%3A%2F%2Fhome&af_web_dp=https%3A%2F%2Fexample.com&id=9',
  'https://app.example/x?af_dp=myapp%3A%2F%2Fhome&af_web_dp=https%3A%2F%2Fexample.com&id=9');

url('Bing/Microsoft Ads ValueTrack macros on the advertiser\'s own page',
  'https://shop.example/p?hvadid=1&hvbmt=bb&hvdev=c&hvlocint=&hvlocphy=2&hvnetw=o&hvqmt=e&hvtargid=kwd-3&id=4',
  'https://shop.example/p?id=4');

url('comScore ns_* family, a third-party vendor rather than BBC-specific',
  'https://example.com/a?ns_source=x&ns_mchannel=y&ns_campaign=z&ns_linkname=w&ns_fee=0&id=1',
  'https://example.com/a?id=1');

url('Salesforce Marketing Cloud sfmc_* prefix',
  'https://shop.example/p?sfmc_id=1&sfmc_activityid=2&id=3',
  'https://shop.example/p?id=3');

url('Adjust attribution fields, both spellings',
  'https://app.example/x?adjust_campaign=1&adjust_tracker=2&adj_campaign=3&adj_label=4&id=5',
  'https://app.example/x?id=5');

url('AppsFlyer af_xp/is_retargeting and Google Play/Shopping ids',
  'https://shop.example/p?af_xp=1&is_retargeting=true&gps_adid=2&feeditemid=3&targetid=4&id=5',
  'https://shop.example/p?id=5');

url('Eloqua, Ebis, Mindbox and comScore-adjacent campaign families',
  'https://shop.example/p?elq=1&elqaid=2&elqat=3&elqCampaignId=4&elqak=5&ebisAdID=6&ebisOther1=7' +
  '&mindbox-click-id=8&mindbox-message-key=9&int_source=a&int_medium=b&int_campaign=c&dpg_source=d' +
  '&sc_cid=e&id=f',
  'https://shop.example/p?id=f');

url('Yahoo Japan, LINE ads, MyTracker and misc regional ad vendors',
  'https://shop.example/p?yj_r=1&line_uid=2&_ly_c=3&_ly_r=4&ldtag_cl=5&lt_r=6&srclt=7&cm_mmc=8' +
  '&mt_click_id=9&mt_network=a&uzcid=b&vsm_cid=c&vsm_type=d&winflncrtag=e&x-clickref=f&tgclid=g' +
  '&adsterra_clid=h&bance_xuid=i&famad_xuid=j&bsft_clkid=k&analytics_trace_id=l&asgtbndr=m&janet=n' +
  '&loclid=o&emcs_t=p&eml-name=q&at_link=r&usqp=s&Tcsack=t&nx_source=u&cstrackid=v&cx_click=w' +
  '&tw_medium=x&gci=y&btag=z&recommended_by=aa&recommended_code=bb&id=cc',
  'https://shop.example/p?id=cc');

url('Matomo full-word siblings and pk_keyword',
  'https://example.com/a?matomo_source=1&matomo_medium=2&matomo_content=3&matomo_cid=4&matomo_group=5' +
  '&matomo_placement=6&pk_keyword=7&id=8',
  'https://example.com/a?id=8');

url('generic ad/affiliate click ids added from AdGuard and tickhq',
  'https://shop.example/p?external_click_id=1&unicorn_click_id=2&iclid=3&erid=4&idealoid=5' +
  '&_zucks_suid=6&ymid=7&ym_tracking_id=8&user_email_address=9&spot_im_redirect_source=a&adfrom=b&id=c',
  'https://shop.example/p?id=c');

{
  const affInput = 'https://shop.example/p?admitad_uid=1&cjdata=2&ir_adid=3&ir_campaignid=4' +
    '&ir_partnerid=5&tduid=6&maf=7&id=8';
  url('affiliate siblings from AdGuard and tickhq: kept by default', affInput,
    'https://shop.example/p?admitad_uid=1&cjdata=2&ir_adid=3&ir_campaignid=4&ir_partnerid=5&tduid=6&maf=7&id=8');
  url('affiliate siblings from AdGuard and tickhq: removed when opted in', affInput,
    'https://shop.example/p?id=8', { removeAffiliate: true });
}

url('encoding of surviving params is preserved byte for byte',
  'https://example.com/?q=a%20b%2Bc&utm_source=x&r=1+2',
  'https://example.com/?q=a%20b%2Bc&r=1+2');

url('valueless params survive',
  'https://example.com/?debug&utm_source=x',
  'https://example.com/?debug');

url('tracker-only fragment is cleaned',
  'https://example.com/page#utm_source=twitter',
  'https://example.com/page');

url('hash router is left alone',
  'https://example.com/app#/route?utm_source=x',
  'https://example.com/app#/route?utm_source=x');

url('untouched URL is returned verbatim (no normalisation)',
  'https://Example.com:443/a/../b?z=1',
  'https://Example.com:443/a/../b?z=1');

url('non-http schemes are ignored',
  'mailto:someone@example.com?utm_source=x',
  'mailto:someone@example.com?utm_source=x');

url('not a URL at all',
  'just some words',
  'just some words');

/* ---------------------------------------------------------------- *
 * Share identifiers
 * ---------------------------------------------------------------- */
url('youtube ?si= share id',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=Kd8sPqR2',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

url('youtu.be share link with timestamp kept',
  'https://youtu.be/dQw4w9WgXcQ?si=Kd8sPqR2&t=43',
  'https://youtu.be/dQw4w9WgXcQ?t=43');

url('youtube share payload',
  'https://www.youtube.com/watch?v=abc&pp=ygUFaGVsbG8%3D&feature=shared',
  'https://www.youtube.com/watch?v=abc');

url('youtube is',
  'https://www.youtube.com/watch?v=abc&is=Xy12AbCd',
  'https://www.youtube.com/watch?v=abc');

url('youtu.be share ids after "&" in the path',
  'https://youtu.be/VNvErq7nseM&is=12345&si=abc',
  'https://youtu.be/VNvErq7nseM');

url('youtu.be path keeps a timestamp after "&"',
  'https://youtu.be/VNvErq7nseM&t=42&si=abc',
  'https://youtu.be/VNvErq7nseM&t=42');

url('instagram igsh',
  'https://www.instagram.com/p/Cx1y2z3/?igsh=MWQx%3D%3D&img_index=1',
  'https://www.instagram.com/p/Cx1y2z3/?img_index=1');
url('instagram psln',
  'https://www.instagram.com/reel/Cx1y2z3/?igsh=MWQx&psln=abc123',
  'https://www.instagram.com/reel/Cx1y2z3/');

url('instagram stkn share token',
  'https://www.instagram.com/reel/DcuZPkpAq_m/?stkn=OThqd284MGd1cnR1',
  'https://www.instagram.com/reel/DcuZPkpAq_m/');

url('instagram xtok share token',
  'https://www.instagram.com/reel/DedAQlvTLBR/?xtok=ejV0bG13bDgzMHl6',
  'https://www.instagram.com/reel/DedAQlvTLBR/');

url('instagram igsi share id',
  'https://www.instagram.com/reel/Dc1VyKvtNsZ/?igsi=MW93MGV2enp5b28zag==',
  'https://www.instagram.com/reel/Dc1VyKvtNsZ/');

url('stkn is left alone off instagram',
  'https://example.com/?stkn=abc',
  'https://example.com/?stkn=abc');

url('x.com s/t share ids',
  'https://x.com/someone/status/1234567890?s=20&t=Ab3dEf',
  'https://x.com/someone/status/1234567890');

url('site-scoped params do not leak to other sites',
  'https://example.com/search?s=shoes&t=now',
  'https://example.com/search?s=shoes&t=now');

url('spotify si',
  'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=8f2b1c',
  'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');

url('spotify share card id (sci)',
  'https://open.spotify.com/episode/1Td4r6wo6h0A7RVFCUN7tb?si=2mehyf4-T-CsaUicXz4_fA&utm_source=copy-link&sci=spotify%3Acard-config%3A20miARoHjQtLBW03xrUWAO',
  'https://open.spotify.com/episode/1Td4r6wo6h0A7RVFCUN7tb');

url('tiktok share ids',
  'https://www.tiktok.com/@user/video/7100?is_from_webapp=1&sender_device=pc&web_id=99',
  'https://www.tiktok.com/@user/video/7100');

url('tiktok embed and referer share metadata',
  'https://www.tiktok.com/@user/video/7100?embed_source=1&referer_url=https%3A%2F%2Fx.example&referer_video_id=7099&share_author_id=55',
  'https://www.tiktok.com/@user/video/7100');

url('x.com refsrc (older spelling, no underscore)',
  'https://x.com/someone/status/1234567890?refsrc=twsrc%5Etfw',
  'https://x.com/someone/status/1234567890');

url('reddit branch share ids (percent-encoded name)',
  'https://www.reddit.com/r/x/comments/abc/title/?share_id=Zm9v&%24deep_link=true&rdt=567',
  'https://www.reddit.com/r/x/comments/abc/title/');

url('reddit bot-check tokens',
  'https://www.reddit.com/r/x/comments/abc/title/?solution=eyJ0eXAi&js_challenge=1&jsc_token=abc',
  'https://www.reddit.com/r/x/comments/abc/title/');

url('reddit bot-check names are left alone elsewhere',
  'https://forum.example/thread?solution=42&js_challenge=1',
  'https://forum.example/thread?solution=42&js_challenge=1');

url('facebook mibextid',
  'https://www.facebook.com/photo?fbid=123&mibextid=abcdef&__tn__=EH',
  'https://www.facebook.com/photo?fbid=123');

url('facebook tracking param',
  'https://www.facebook.com/story?fbid=123&tracking=abcdef',
  'https://www.facebook.com/story?fbid=123');

url('BBC pinned post and internal link tracking',
  'https://www.bbc.co.uk/news/live/world-123?pinned_post_asset_id=1&pinned_post_locator=urn:1&pinned_post_type=share&intlink_from_url=x&src_origin=y&page=2',
  'https://www.bbc.co.uk/news/live/world-123?page=2');

url('walmart athena/mpid noise and a Google Shopping referral',
  'https://www.walmart.com/ip/Thing/123?athbdg=XX&mpid=1&wl13=abc&wmlspartner=wlpa&selectedSellerId=0&veh=sem&cn=x&color=red',
  'https://www.walmart.com/ip/Thing/123?color=red');

url('bing nclid click id',
  'https://www.bing.com/search?q=hello&nclid=abc123',
  'https://www.bing.com/search?q=hello');

url('etsy google ads/shopping attribution and share timestamp',
  'https://www.etsy.com/listing/123/thing?gao=1&gpla=1&share_time=1700000000&ref=sc',
  'https://www.etsy.com/listing/123/thing');

url('github referral tracking links',
  'https://github.com/owner/repo?ref_cta=Star&ref_loc=sidebar&ref_page=repo-overview&reference_location=repo-list',
  'https://github.com/owner/repo');

url('lazada share/session tokens',
  'https://www.lazada.com/products/thing-i123.html?dsource=1&exlaz=abc&laz_share_info=x&laz_token=y',
  'https://www.lazada.com/products/thing-i123.html');

url('bilibili spmid, tdsourcetag and referral tags',
  'https://www.bilibili.com/video/BV123?spmid=333.1.list&tdsourcetag=s_pctim_aiomsg&bsource=search&referfrom=search',
  'https://www.bilibili.com/video/BV123');

url('ebay click analytics blob',
  'https://www.ebay.com/itm/123?sojTags=bu:bu&_trksid=p1&hash=item1:g',
  'https://www.ebay.com/itm/123');

url('amazon /ref= path segment and query noise',
  'https://www.amazon.com/Some-Product/dp/B0ABCDEFGH/ref=sr_1_3?qid=1700000000&sr=8-3&keywords=thing',
  'https://www.amazon.com/Some-Product/dp/B0ABCDEFGH?keywords=thing');

url('amazon /ref= segment with the session id after it',
  'https://www.amazon.fr/Castlevania-Belmonts-Curse-Midnight-Edition-PS5/dp/B0GNGVTQNT/ref=zg_bsnr_g_20904281031_d_sccl_3/257-9953909-8897161',
  'https://www.amazon.fr/Castlevania-Belmonts-Curse-Midnight-Edition-PS5/dp/B0GNGVTQNT');

url('a path segment that only looks like digits is kept without a ref before it',
  'https://www.amazon.fr/gp/order/257-9953909-8897161',
  'https://www.amazon.fr/gp/order/257-9953909-8897161');

url('linkedin trk',
  'https://www.linkedin.com/posts/someone_activity-123?trk=public_post&lipi=urn%3Ali%3Apage%3Ax',
  'https://www.linkedin.com/posts/someone_activity-123');
url('linkedin rcm',
  'https://www.linkedin.com/posts/someone_activity-123?rcm=ACoAAB1234',
  'https://www.linkedin.com/posts/someone_activity-123');
url('linkedin originalReferer from the auth wall',
  'https://www.linkedin.com/posts/someone_activity-123?originalReferer=https%3A%2F%2Fexample.com',
  'https://www.linkedin.com/posts/someone_activity-123');

url('netflix trackId siblings',
  'https://www.netflix.com/title/123?trackId=1&trackIdEpisode=2&trackIdJaw=3&trackIdTrailer=4',
  'https://www.netflix.com/title/123');

url('amazon refRID and wildcard cv_ct_* noise',
  'https://www.amazon.de/dp/B0123?refRID=XYZ&dchild=1&cv_ct_cx=foo&th=1',
  'https://www.amazon.de/dp/B0123');

/* These stores were absent from the host list, so their links kept
 * everything, affiliate tags included. */
for (const host of ['www.amazon.com.tr', 'www.amazon.cn', 'www.amazon.sg',
                    'www.amazon.ae', 'www.amazon.sa', 'www.amazon.eg',
                    'www.amazon.com.be']) {
  url(`amazon store ${host}`,
    `https://${host}/dp/B0123/ref=sr_1_1?pd_rd_i=B0123&ref=nav&psc=1&language=en`,
    `https://${host}/dp/B0123?language=en`);
}

url('google AI Mode conversation state',
  'https://www.google.com/search?q=who+won&udm=50&aep=11&mstk=AUtEx&csuir=173&mtid=abc',
  'https://www.google.com/search?q=who+won&udm=50&aep=11');

url('google play share campaign',
  'https://play.google.com/store/apps/details?id=org.mozilla.firefox&pcampaignid=web_share',
  'https://play.google.com/store/apps/details?id=org.mozilla.firefox');

url('bing telemetry, real query kept',
  'https://www.bing.com/search?q=hello&form=QBLH&sp=-1&sc=8-5&qs=n&sk=&cvid=ABC',
  'https://www.bing.com/search?q=hello');

url('nytimes share id',
  'https://www.nytimes.com/2026/01/01/world/story.html?smid=url-share',
  'https://www.nytimes.com/2026/01/01/world/story.html');

url('bbc at_* via site pattern',
  'https://www.bbc.com/news/articles/c123?at_medium=social&at_bbc_team=editorial&at_new_thing=1',
  'https://www.bbc.com/news/articles/c123');

url('mercado libre wildcard c_* and reco_*',
  'https://articulo.mercadolibre.com/MLA-123?c_id=x&c_element_order=1&reco_new=2&tracking_id=abc',
  'https://articulo.mercadolibre.com/MLA-123');

url('new site params do not leak to other sites',
  'https://example.com/?smid=keep&cvid=keep',
  'https://example.com/?smid=keep&cvid=keep');

url('google search noise',
  'https://www.google.com/search?q=hello&sca_esv=abc&ei=xyz&ved=2ahUKEwi&sourceid=chrome',
  'https://www.google.com/search?q=hello');

url('google search: current tracking, but not client, hl or the si tab',
  'https://www.google.com/search?q=cleanurl&sca_esv=a1&sca_upv=1&sxsrf=AH&ei=Zx&ved=0a&uact=5&oq=cleanur' +
    '&gs_lp=Egxnd3Mtd2l6LXNlcnA&sclient=gws-wiz-serp&lei=Zx&client=firefox-b-d&hl=fr&si=AKbGX_o',
  'https://www.google.com/search?q=cleanurl&client=firefox-b-d&hl=fr&si=AKbGX_o');

url('google ccTLD matches via hostRe',
  'https://www.google.co.uk/search?q=hello&ved=2ahUKEwi',
  'https://www.google.co.uk/search?q=hello');

/* ---------------------------------------------------------------- *
 * Affiliate tags (opt-in)
 * ---------------------------------------------------------------- */
url('affiliate tag kept by default',
  'https://www.amazon.com/dp/B0ABCDEFGH?tag=someone-20&qid=1',
  'https://www.amazon.com/dp/B0ABCDEFGH?tag=someone-20');

url('affiliate tag removed when opted in',
  'https://www.amazon.com/dp/B0ABCDEFGH?tag=someone-20&qid=1',
  'https://www.amazon.com/dp/B0ABCDEFGH',
  { removeAffiliate: true });

/*
 * Affiliate codes credit whoever shared the link, so like tag they stay
 * unless affiliate removal is on - the Chrome Web Store's affiliate policy
 * forbids removing them without the user's say-so.
 */
{
  const cases = [
    ['affiliate network click ids on any site',
      'https://shop.example/item?cjevent=abc&awc=1_2&sscid=x&irclickid=y&irgwc=1&utm_source=z',
      'https://shop.example/item?cjevent=abc&awc=1_2&sscid=x&irclickid=y&irgwc=1',
      'https://shop.example/item'],
    ['generic referral and affiliate ids',
      'https://shop.example/item?affiliate_id=a&afid=b&click_id=c&referral=d&zanpid=e&utm_source=z',
      'https://shop.example/item?affiliate_id=a&afid=b&click_id=c&referral=d&zanpid=e',
      'https://shop.example/item'],
    ['eBay Partner Network',
      'https://www.ebay.com/itm/123?mkevt=1&mkcid=1&mkrid=711-1&campid=5338&customid=a&toolid=10001&mkgroupid=2&mkpid=0&mktype=3&_trksid=p1',
      'https://www.ebay.com/itm/123?mkevt=1&mkcid=1&mkrid=711-1&campid=5338&customid=a&toolid=10001&mkgroupid=2&mkpid=0&mktype=3',
      'https://www.ebay.com/itm/123'],
    ['Booking.com affiliate id',
      'https://www.booking.com/hotel/fr/x.html?aid=304142&label=gen173&srpvid=1',
      'https://www.booking.com/hotel/fr/x.html?aid=304142&label=gen173',
      'https://www.booking.com/hotel/fr/x.html'],
    ['AliExpress affiliate set',
      'https://www.aliexpress.com/item/1.html?aff_fcid=a&aff_fsk=b&aff_platform=c&aff_trace_key=d&spm=e',
      'https://www.aliexpress.com/item/1.html?aff_fcid=a&aff_fsk=b&aff_platform=c&aff_trace_key=d',
      'https://www.aliexpress.com/item/1.html'],
    ['Apple affiliate token and campaign',
      'https://apps.apple.com/app/id1?at=1000l&ct=promo&uo=4',
      'https://apps.apple.com/app/id1?at=1000l&ct=promo',
      'https://apps.apple.com/app/id1'],
    ['Apple mttn* attribution family',
      'https://apps.apple.com/app/id1?mttnsubad=1&mttn3pid=2&mttnagencyid=3&mttncc=4&mttnpid=5&mttnsiteid=6&mttnsubkw=7&mttnsubplmnt=8&uo=4',
      'https://apps.apple.com/app/id1?mttnsubad=1&mttn3pid=2&mttnagencyid=3&mttncc=4&mttnpid=5&mttnsiteid=6&mttnsubkw=7&mttnsubplmnt=8',
      'https://apps.apple.com/app/id1'],
  ];
  for (const [label, input, kept, removed] of cases) {
    url(`${label}: kept by default`, input, kept);
    url(`${label}: removed when opted in`, input, removed, { removeAffiliate: true });
  }
}

{
  const gq = 'https://www.amazon.fr/Columbia-Peakfreak-Shandal-Sandale-Mangue/dp/B0D4B63WQG' +
    '?source=ps-sl-shoppingads-lpcontext&linkCode=sl1&tag=condenastfran-21&language=fr_FR' +
    '&asc_source=verso&asc_campaign=68668ef6cbf052ce9f5facb3' +
    '&asc_refurl=https%3A%2F%2Fwww.gqmagazine.fr%2Fgalerie%2Fmeilleures-sandales-de-randonnee-homme' +
    '&ascsubtag=68668ef6cbf052ce9f5facb3';
  url('amazon associates link: tracking and referring page go, credit stays', gq,
    'https://www.amazon.fr/Columbia-Peakfreak-Shandal-Sandale-Mangue/dp/B0D4B63WQG' +
    '?linkCode=sl1&tag=condenastfran-21&language=fr_FR&asc_campaign=68668ef6cbf052ce9f5facb3' +
    '&ascsubtag=68668ef6cbf052ce9f5facb3');
  url('amazon associates link with affiliate removal on', gq,
    'https://www.amazon.fr/Columbia-Peakfreak-Shandal-Sandale-Mangue/dp/B0D4B63WQG?language=fr_FR',
    { removeAffiliate: true });
}

/* ---------------------------------------------------------------- *
 * Redirect unwrapping
 * ---------------------------------------------------------------- */
url('google /url interstitial',
  'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fpost%3Futm_source%3Dgoogle&sa=D&usg=AOv',
  'https://example.com/post');

url('instagram outbound wrapper',
  'https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2F%3Ffbclid%3D123&e=ATxyz',
  'https://example.com/');

url('facebook l.php wrapper',
  'https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&h=AT1',
  'https://example.com/a?b=1');

url('duckduckgo /l/ wrapper',
  'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa%3Futm_source%3Dddg&rut=abc',
  'https://example.com/a');

url('deviantart outgoing wrapper (raw query)',
  'https://www.deviantart.com/users/outgoing?https://example.com/page',
  'https://example.com/page');

url('vk away.php on the bare domain',
  'https://vk.com/away.php?to=https%3A%2F%2Fexample.com%2F&cc_key=',
  'https://example.com/');

/* Affiliate network links pay the sharer: unwrapped only on opt-in, and
 * never edited either way. */
{
  const awin = 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=' +
    'https%3A%2F%2Fshop.example%2Fitem%3Futm_source%3Dawin';
  url('affiliate redirect left whole by default', awin, awin);
  url('affiliate redirect unwrapped when affiliate removal is on', awin,
    'https://shop.example/item', { removeAffiliate: true });
  url('affiliate redirect untouched when unwrapping is off', awin, awin,
    { removeAffiliate: true, unwrapRedirects: false });

  const cj = 'https://www.anrdoezrs.net/click-123-456?url=https%3A%2F%2Fshop.example%2F&sid=x';
  url('cj click link unwrapped on opt-in', cj, 'https://shop.example/',
    { removeAffiliate: true });

  const redirectingat = 'https://press.redirectingat.com/?id=1&url=' +
    'https%3A%2F%2Fshop.example%2Fitem';
  url('RedirectingAt commerce-content link left whole by default',
    redirectingat, redirectingat);
  url('RedirectingAt commerce-content link unwrapped on opt-in',
    redirectingat, 'https://shop.example/item', { removeAffiliate: true });

  const connexity = 'https://rd.connexity.net/rd?cid=1&t=https%3A%2F%2Fshop.example%2F';
  url('Connexity redirect unwrapped on opt-in', connexity,
    'https://shop.example/', { removeAffiliate: true });

  const cfjump = 'https://t.cfjump.com/123/4/?Url=https%3A%2F%2Fshop.example%2F';
  url('Commission Factory redirect unwrapped on opt-in', cfjump,
    'https://shop.example/', { removeAffiliate: true });

  const ojrq = 'https://www.ojrq.net/p/?c=1&return=https%3A%2F%2Fshop.example%2F';
  url('Impact Radius ojrq.net redirect unwrapped on opt-in', ojrq,
    'https://shop.example/', { removeAffiliate: true });

  const awinAwclick = 'https://www.awin1.com/awclick.php?awinmid=1&p=' +
    'https%3A%2F%2Fshop.example%2F';
  url('Awin awclick.php (p=) unwrapped on opt-in', awinAwclick,
    'https://shop.example/', { removeAffiliate: true });

  const tradedoubler = 'https://redir.tradedoubler.com/?td1=1&_td_deeplink=' +
    'https%3A%2F%2Fshop.example%2F';
  url('Tradedoubler redir subdomain unwrapped on opt-in', tradedoubler,
    'https://shop.example/', { removeAffiliate: true });

  const bizrate = 'https://rd.bizrate.com/rd2?t=https%3A%2F%2Fshop.example%2F';
  url('Bizrate (Connexity\'s older brand) unwrapped on opt-in', bizrate,
    'https://shop.example/', { removeAffiliate: true });

  const valuecommerce = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?' +
    'sid=1&vc_url=https%3A%2F%2Fshop.example%2F';
  url('ValueCommerce redirect unwrapped on opt-in', valuecommerce,
    'https://shop.example/', { removeAffiliate: true });

  const impactPool = 'https://www.i182465.net/c/123?param=1&u=' +
    'https%3A%2F%2Fshop.example%2F';
  url('Impact.com pooled redirect domain unwrapped on opt-in', impactPool,
    'https://shop.example/', { removeAffiliate: true });

  const impactGoto = 'https://goto.target.com/c/1?u=https%3A%2F%2Fshop.example%2F';
  url('Impact.com goto.target.com unwrapped on opt-in', impactGoto,
    'https://shop.example/', { removeAffiliate: true });

  url('non-affiliate redirects still unwrap by default',
    'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F',
    'https://example.com/');

  const mailchimpClick = 'https://us1.mailchimp.com/mctx/clicks?url=' +
    'https%3A%2F%2Fexample.com%2F&dc=1';
  url('mailchimp click redirect unwraps by default', mailchimpClick,
    'https://example.com/');

  const pageLink = 'https://myapp.page.link/?ofl=https%3A%2F%2Fexample.com%2F';
  url('Firebase Dynamic Links unwraps by default', pageLink,
    'https://example.com/');
}

/*
 * A redirector's parameters are its payload and its signature. google.com/url
 * signs the redirect with usg, and Google puts sa and usg on its own search
 * results too - so the site rule that cleans a search page would, unexempted,
 * strip the signature off the redirector and produce "the page you were on is
 * trying to send you to an invalid URL".
 */
{
  const wrapped = 'https://www.google.com/url?sa=j&url=https%3A%2F%2Fdeveloper.chrome.com' +
    '%2Fdocs%2Fwebstore%2Fpublish%2F%23item_limits&uct=1725885917' +
    '&usg=0bX9z45YbsChq1z-MdP39RivHuM.&opi=70078707';

  check('a redirector is recognised', Clean.isRedirector(wrapped), true);

  url('copying a redirector unwraps it to the destination', wrapped,
    'https://developer.chrome.com/docs/webstore/publish/#item_limits');

  // The address bar pass cannot unwrap (replaceState cannot cross origins),
  // so it must leave the redirector completely alone rather than edit it.
  url('an unwrapped redirector is never edited', wrapped, wrapped,
    { unwrapRedirects: false });

  url('the signature survives even with cleaning forced on the host',
    'https://www.google.com/url?sa=j&url=https%3A%2F%2Fexample.com%2F&usg=SIG',
    'https://www.google.com/url?sa=j&url=https%3A%2F%2Fexample.com%2F&usg=SIG',
    { unwrapRedirects: false });
}

/*
 * Following a Google redirect link on a Google page: the link is swapped for
 * its cleaned destination as it is used (src/link-guard.js). Only there - a
 * google.com/url link elsewhere keeps Google's "Redirect notice".
 */
{
  const LinkGuard = require('../src/link-guard.js');
  const link = (href, ping) => {
    const attrs = ping ? { ping: ping } : {};
    return {
      tagName: 'A', href: href,
      hasAttribute: (name) => name in attrs,
      removeAttribute: (name) => { delete attrs[name]; },
      get pinged() { return 'ping' in attrs; },
    };
  };
  const on = Object.assign({}, Clean.DEFAULT_SETTINGS);
  const maps = 'https://www.google.com/url?url=https%3A%2F%2Fwww.ap-reiki.fr%2F%3Futm_source%3Dgmb&sa=t' +
    '&rct=j&source=maps&usg=AOvVaw0uNw_xg6SH4tnkZwY2kI6U&ved=1i%3A17';

  let a = link(maps);
  LinkGuard.rewrite(a, on, 'www.google.com');
  check('a Google Maps redirect link is unwrapped and cleaned', a.href, 'https://www.ap-reiki.fr/');

  a = link(maps);
  LinkGuard.rewrite(a, on, 'maps.google.fr');
  check('on any Google domain', a.href, 'https://www.ap-reiki.fr/');

  a = link(maps);
  LinkGuard.rewrite(a, on, 'mail.example.com');
  check('but not on another site: Google keeps its redirect notice', a.href, maps);

  a = link(maps);
  LinkGuard.rewrite(a, Object.assign({}, on, { unwrapRedirects: false }), 'www.google.com');
  check('not when unwrapping is switched off', a.href, maps);

  a = link(maps);
  LinkGuard.rewrite(a, Object.assign({}, on, { allowlist: ['google.com'] }), 'www.google.com');
  check('not when Google is on the allowlist', a.href, maps);

  a = link('https://www.ap-reiki.fr/', 'https://www.google.com/url?sa=t&ved=x');
  LinkGuard.rewrite(a, on, 'www.google.com');
  check('the ping beacon of a result is removed', a.pinged, false);
  check('and a direct link is left as it is', a.href, 'https://www.ap-reiki.fr/');

  a = link('https://evil.example/url?q=https%3A%2F%2Fexample.com%2F');
  LinkGuard.rewrite(a, on, 'www.google.com');
  check('only the Google redirector is unwrapped', a.href, 'https://evil.example/url?q=https%3A%2F%2Fexample.com%2F');
}

/* The same parameters are still noise on a search results page. */
url('google search still loses sa, usg and ved',
  'https://www.google.com/search?q=hello&sa=t&usg=abc&ved=xyz',
  'https://www.google.com/search?q=hello');

check('a search page is not a redirector',
  Clean.isRedirector('https://www.google.com/search?q=hello'), false);

for (const host of ['https://l.instagram.com/?u=x', 'https://out.reddit.com/?url=x',
                    'https://www.youtube.com/redirect?q=x',
                    'https://steamcommunity.com/linkfilter/?url=x',
                    'https://l.facebook.com/l.php?u=x']) {
  check(`redirector: ${host}`, Clean.isRedirector(host), true);
}
for (const host of ['https://www.youtube.com/watch?v=abc',
                    'https://steamcommunity.com/app/570',
                    'https://www.linkedin.com/feed/']) {
  check(`not a redirector: ${host}`, Clean.isRedirector(host), false);
}

url('unwrapping can be turned off',
  'https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2F&e=ATxyz',
  'https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2F&e=ATxyz',
  { unwrapRedirects: false });

/* ---------------------------------------------------------------- *
 * Settings
 * ---------------------------------------------------------------- */
url('allowlisted domain is untouched',
  'https://intranet.example.com/?utm_source=x',
  'https://intranet.example.com/?utm_source=x',
  { allowlist: ['example.com'] });

url('disabled extension is a no-op',
  'https://example.com/?utm_source=x',
  'https://example.com/?utm_source=x',
  { enabled: false });

url('custom wildcard param',
  'https://example.com/?internal_track_a=1&keep=2',
  'https://example.com/?keep=2',
  { customParams: ['internal_track_*'] });

url('keepParams wins over a rule',
  'https://www.youtube.com/watch?v=abc&si=xyz',
  'https://www.youtube.com/watch?v=abc&si=xyz',
  { keepParams: ['si'] });

/* ---------------------------------------------------------------- *
 * Text rewriting (the clipboard path)
 * ---------------------------------------------------------------- */
text('url embedded in a sentence',
  'Look at https://example.com/a?utm_source=x&b=1 today.',
  'Look at https://example.com/a?b=1 today.');

text('trailing sentence punctuation is left outside the url',
  'See https://example.com/?utm_source=x.',
  'See https://example.com/.');

text('balanced parentheses stay part of the url',
  'https://en.wikipedia.org/wiki/Toast_(disambiguation)?utm_source=x',
  'https://en.wikipedia.org/wiki/Toast_(disambiguation)');

text('url wrapped in parentheses',
  '(https://example.com/?utm_source=x)',
  '(https://example.com/)');

text('multiple urls in one blob',
  'a https://example.com/?utm_source=x b https://www.youtube.com/watch?v=1&si=2',
  'a https://example.com/ b https://www.youtube.com/watch?v=1');

text('text with no urls is untouched',
  'nothing to do here',
  'nothing to do here');

check('cleanText reports every parameter it dropped, without repeats',
  Clean.cleanText('https://example.com/?utm_source=x&gclid=y then ' +
                  'https://other.example/?utm_source=z').removed.join(','),
  'utm_source,gclid');

check('cleanText reports nothing removed when it changed nothing',
  Clean.cleanText('https://example.com/clean').removed.length, 0);

check('cleanText counts rewrites',
  Clean.cleanText('https://example.com/?utm_source=x and https://example.com/?gclid=y').count, 2);

check('cleanUrl reports what it removed',
  Clean.cleanUrl('https://example.com/?utm_source=x&gclid=y').removed.join(','), 'utm_source,gclid');

/* ---------------------------------------------------------------- *
 * Pages Chrome reserves for itself
 * ---------------------------------------------------------------- */
for (const restricted of [
  // Chrome
  'https://chromewebstore.google.com/detail/abc?utm_source=item-share-cb',
  'https://chromewebstore.google.com/',
  'https://chrome.google.com/webstore/detail/abc',
  // Firefox, from extensions.webextensions.restrictedDomains
  'https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox?utm_source=x',
  'https://addons.mozilla.org/en-US/firefox/addon/something/',
  'https://accounts.firefox.com/signin',
  'https://sync.services.mozilla.com/',
  'https://install.mozilla.org/',
]) {
  check(`restricted: ${restricted}`, Clean.isBrowserRestricted(restricted), true);
}
for (const ordinary of [
  'https://chrome.google.com/something-else',
  'https://google.com/search?q=x',
  'https://example.com/chromewebstore.google.com',
  'https://www.mozilla.org/en-US/firefox/new/',
  'https://blog.mozilla.org/post',
  'https://developer.mozilla.org/en-US/docs/Web',
  'not a url',
]) {
  check(`not restricted: ${ordinary}`, Clean.isBrowserRestricted(ordinary), false);
}

/*
 * The list is the union across browsers, so it can only ever explain a content
 * script already known to be missing. Being on it must not stop the rules from
 * describing what would come off: the popup shows that, and its Copy clean
 * link button works on these pages even though nothing automatic does.
 */
check('a restricted url is still analysed',
  Clean.cleanUrl('https://chromewebstore.google.com/detail/abc?utm_source=item-share-cb').url,
  'https://chromewebstore.google.com/detail/abc');

check('a firefox-restricted url is still analysed',
  Clean.cleanUrl('https://support.mozilla.org/en-US/kb/x?utm_source=y&as=u').url,
  'https://support.mozilla.org/en-US/kb/x?as=u');

/* ---------------------------------------------------------------- *
 * Guard rails: things that must never be stripped
 * ---------------------------------------------------------------- */
for (const param of ['code', 'state', 'token', 'access_token', 'id_token', 'q',
                     'v', 'page', 'redirect_uri', 'client_id', 'nonce',
                     'session', 'sig', 'signature', 'expires', 'key', 'hl']) {
  const input = `https://login.example.com/callback?${param}=VALUE`;
  url(`auth-critical param "${param}" survives`, input, input);
}

/* ---------------------------------------------------------------- */
console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\n' + failures.map((f) => '  FAIL ' + f).join('\n'));
  process.exit(1);
}
