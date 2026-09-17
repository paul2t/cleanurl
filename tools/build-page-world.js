/*
 * Builds src/page-world.js, the single file the main-world content script
 * entry loads. Run with: npm run build
 *
 * Why this exists: a JS file listed in two content_scripts entries is injected
 * once, into whichever entry comes first. rules.js, cleaner.js and
 * copy-guard.js were listed in both the isolated and the main-world entry, so
 * the isolated world took them and the main world received only
 * content-main.js - which then found none of its dependencies and did nothing.
 *
 * Concatenating them into a file the other entry does not reference means the
 * two entries share no path at all, so there is nothing to collide over. Each
 * source is an IIFE that publishes onto globalThis, so running them joined is
 * identical to running them in sequence.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SOURCES = ['rules.js', 'cleaner.js', 'copy-guard.js', 'content-main.js'];
const OUTPUT = path.join(root, 'src', 'page-world.js');

function build() {
  const banner = [
    '/*',
    ' * GENERATED FILE - do not edit. Run `npm run build` after changing any of:',
    ` *   ${SOURCES.map((f) => 'src/' + f).join(', ')}`,
    ' *',
    ' * The main-world content script entry loads this one file and nothing the',
    ' * isolated entry also lists. A path appearing in both entries is injected',
    ' * only once, into whichever comes first, which previously left the main',
    ' * world with content-main.js and none of its dependencies.',
    ' */',
    "'use strict';",
    '',
  ].join('\n');

  const parts = SOURCES.map((name) => {
    const source = fs.readFileSync(path.join(root, 'src', name), 'utf8');
    return `/* ---- src/${name} ${'-'.repeat(Math.max(0, 60 - name.length))} */\n${source}`;
  });

  return banner + '\n' + parts.join('\n') + '\n';
}

module.exports = { build, SOURCES, OUTPUT };

if (require.main === module) {
  fs.writeFileSync(OUTPUT, build());
  console.log('wrote src/page-world.js from ' + SOURCES.join(', '));
}
