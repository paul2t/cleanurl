/*
 * Builds dist/cleanurl-<version>.zip, ready to upload to the Chrome Web Store.
 * Run with: npm run package
 *
 * The file list is derived from manifest.json rather than hardcoded, by
 * following every reference out of it: icons, content scripts, the service
 * worker's importScripts() arguments, and the scripts and images the popup and
 * options pages load. Anything not reachable that way is development-only and
 * is left out - test/, tools/, package.json, and src/content-main.js, which
 * exists only as a source for the generated bundle.
 *
 * The manifest is rewritten on the way in to drop permissions that only do
 * anything for an unpacked extension - see DEV_ONLY_PERMISSIONS. The file on
 * disk keeps them, so loading this folder unpacked still works.
 *
 * The zip is written by hand because Node has no archiver and the extension
 * has no dependencies. Entries use a fixed timestamp, so packaging the same
 * tree twice produces byte-identical output.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');

/*
 * Chrome only fires declarativeNetRequest.onRuleMatchedDebug for an unpacked
 * extension, so in a published build the permission does nothing except invite
 * a reviewer to ask what it is for. src/background.js feature-detects the API,
 * so dropping it just means the popup counter stops counting network-level
 * cleanups and keeps counting in-page and copy ones.
 */
const DEV_ONLY_PERMISSIONS = ['declarativeNetRequestFeedback'];

/** The manifest as it should ship, plus whatever was taken out of it. */
function packagedManifest(manifest) {
  const shipped = JSON.parse(JSON.stringify(manifest));
  const removed = (shipped.permissions || []).filter((p) => DEV_ONLY_PERMISSIONS.includes(p));
  shipped.permissions = (shipped.permissions || []).filter(
    (p) => !DEV_ONLY_PERMISSIONS.includes(p));
  return { manifest: shipped, removed: removed };
}

/* ---- reference walking -------------------------------------------------- */

function readText(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

/** Scripts and images an extension HTML page pulls in, as repo-relative paths. */
function pageReferences(pageRelative) {
  const html = readText(pageRelative);
  const dir = path.posix.dirname(pageRelative.split(path.sep).join('/'));
  const refs = [];
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(https?:|data:|#|mailto:)/.test(value)) continue;
    refs.push(path.posix.normalize(path.posix.join(dir, value)));
  }
  return refs;
}

/** Files the service worker pulls in with importScripts(). */
function workerReferences(workerRelative) {
  const source = readText(workerRelative);
  const dir = path.posix.dirname(workerRelative);
  const refs = [];
  const call = source.match(/importScripts\(([^)]*)\)/);
  if (call) {
    for (const match of call[1].matchAll(/['"]([^'"]+)['"]/g)) {
      refs.push(path.posix.join(dir, match[1]));
    }
  }
  return refs;
}

function collectFiles() {
  const manifest = JSON.parse(readText('manifest.json'));
  const files = new Set(['manifest.json']);
  const add = (list) => { for (const f of list) if (f) files.add(f); };

  add(Object.values(manifest.icons || {}));
  add(Object.values((manifest.action && manifest.action.default_icon) || {}));
  for (const entry of manifest.content_scripts || []) {
    add(entry.js || []);
    add(entry.css || []);
  }

  const worker = manifest.background && manifest.background.service_worker;
  if (worker) {
    add([worker]);
    add(workerReferences(worker));
  }

  for (const page of [manifest.action && manifest.action.default_popup,
                      manifest.options_page]) {
    if (!page) continue;
    add([page]);
    add(pageReferences(page));
  }

  const missing = [...files].filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length) {
    throw new Error('manifest references files that do not exist: ' + missing.join(', '));
  }
  return { manifest, files: [...files].sort() };
}

/* ---- minimal zip writer ------------------------------------------------- */

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 2020-01-01 00:00:00 in DOS format, so builds are reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const deflated = zlib.deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);            // version needed
    header.writeUInt16LE(0, 6);             // flags
    header.writeUInt16LE(8, 8);             // deflate
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);            // extra field length

    parts.push(header, name, deflated);
    central.push({ name, crc, compressed: deflated.length, size: entry.data.length, offset });
    offset += header.length + name.length + deflated.length;
  }

  const directory = [];
  for (const item of central) {
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);            // version made by
    record.writeUInt16LE(20, 6);            // version needed
    record.writeUInt16LE(0, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(DOS_TIME, 12);
    record.writeUInt16LE(DOS_DATE, 14);
    record.writeUInt32LE(item.crc, 16);
    record.writeUInt32LE(item.compressed, 20);
    record.writeUInt32LE(item.size, 24);
    record.writeUInt16LE(item.name.length, 28);
    record.writeUInt16LE(0, 30);            // extra
    record.writeUInt16LE(0, 32);            // comment
    record.writeUInt16LE(0, 34);            // disk number
    record.writeUInt16LE(0, 36);            // internal attributes
    record.writeUInt32LE(0, 38);            // external attributes
    record.writeUInt32LE(item.offset, 42);
    directory.push(record, item.name);
  }

  const directoryBuffer = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(directoryBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, directoryBuffer, end]);
}

/* ---- main --------------------------------------------------------------- */

function main() {
  const { manifest, files } = collectFiles();

  const shipped = packagedManifest(manifest);

  const entries = files.map((name) => ({
    name: name.split(path.sep).join('/'),
    data: name === 'manifest.json'
      ? Buffer.from(JSON.stringify(shipped.manifest, null, 2) + '\n', 'utf8')
      : fs.readFileSync(path.join(root, name)),
  }));

  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const output = path.join(dist, `cleanurl-${manifest.version}.zip`);
  const archive = zip(entries);
  fs.writeFileSync(output, archive);

  const width = Math.max(...entries.map((e) => e.name.length));
  for (const entry of entries) {
    console.log(`  ${entry.name.padEnd(width)}  ${String(entry.data.length).padStart(7)} B`);
  }
  console.log(`\n${entries.length} files -> dist/cleanurl-${manifest.version}.zip ` +
    `(${archive.length} bytes)`);

  const skipped = fs.readdirSync(path.join(root, 'src'))
    .filter((f) => !files.includes('src/' + f));
  if (skipped.length) console.log('left out of src/: ' + skipped.join(', '));
  if (shipped.removed.length) {
    console.log('stripped from the packaged manifest: ' + shipped.removed.join(', ') +
      ' (kept on disk for unpacked use)');
  }
}

module.exports = { collectFiles, zip, packagedManifest, DEV_ONLY_PERMISSIONS };

if (require.main === module) main();
