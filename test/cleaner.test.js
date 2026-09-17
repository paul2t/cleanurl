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

url('instagram igsh',
  'https://www.instagram.com/p/Cx1y2z3/?igsh=MWQx%3D%3D&img_index=1',
  'https://www.instagram.com/p/Cx1y2z3/?img_index=1');

url('x.com s/t share ids',
  'https://x.com/someone/status/1234567890?s=20&t=Ab3dEf',
  'https://x.com/someone/status/1234567890');

url('site-scoped params do not leak to other sites',
  'https://example.com/search?s=shoes&t=now',
  'https://example.com/search?s=shoes&t=now');

url('spotify si',
  'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=8f2b1c',
  'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');

url('tiktok share ids',
  'https://www.tiktok.com/@user/video/7100?is_from_webapp=1&sender_device=pc&web_id=99',
  'https://www.tiktok.com/@user/video/7100');

url('reddit branch share ids (percent-encoded name)',
  'https://www.reddit.com/r/x/comments/abc/title/?share_id=Zm9v&%24deep_link=true&rdt=567',
  'https://www.reddit.com/r/x/comments/abc/title/');

url('facebook mibextid',
  'https://www.facebook.com/photo?fbid=123&mibextid=abcdef&__tn__=EH',
  'https://www.facebook.com/photo?fbid=123');

url('amazon /ref= path segment and query noise',
  'https://www.amazon.com/Some-Product/dp/B0ABCDEFGH/ref=sr_1_3?qid=1700000000&sr=8-3&keywords=thing',
  'https://www.amazon.com/Some-Product/dp/B0ABCDEFGH?keywords=thing');

url('linkedin trk',
  'https://www.linkedin.com/posts/someone_activity-123?trk=public_post&lipi=urn%3Ali%3Apage%3Ax',
  'https://www.linkedin.com/posts/someone_activity-123');

url('google search noise',
  'https://www.google.com/search?q=hello&sca_esv=abc&ei=xyz&ved=2ahUKEwi&sourceid=chrome',
  'https://www.google.com/search?q=hello');

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
