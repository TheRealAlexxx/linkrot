#!/usr/bin/env node
'use strict';
// linkrot: find broken relative links and anchors in Markdown files.
// Fully offline; http(s) links are skipped, not fetched.
const fs = require('fs');
const path = require('path');
const { stripFences, links, anchors } = require('./md.js');

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor', '.next']);

function mdFiles(dir, root) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name)); continue; }
      if (/\.mdx?$/i.test(e.name)) out.push(path.join(d, e.name));
    }
  })(dir);
  return out.sort();
}

// Check one link. Returns a problem string or null.
function checkLink(fromFile, target, root) {
  if (/^(https?:)?\/\//i.test(target) || /^(mailto:|tel:|data:|javascript:)/i.test(target)) return null;
  const [rawPath, rawAnchor] = target.split('#');
  let anchor, rel;
  try {
    anchor = rawAnchor === undefined ? null : decodeURIComponent(rawAnchor);
    rel = decodeURIComponent(rawPath);
  } catch (e) {
    return 'malformed percent-encoding in link: ' + target;
  }
  let file = fromFile;
  if (rel) {
    file = path.resolve(path.dirname(fromFile), rel);
    if (!fs.existsSync(file)) return 'no such file: ' + rel;
    if (fs.statSync(file).isDirectory()) {
      const readme = ['README.md', 'readme.md', 'index.md'].map((f) => path.join(file, f)).find((f) => fs.existsSync(f));
      if (anchor === null) return readme ? null : 'directory with no README.md: ' + rel;
      if (!readme) return 'directory with no README.md: ' + rel;
      file = readme;
    }
  }
  if (anchor !== null && anchor !== '') {
    if (!/\.mdx?$/i.test(file)) return null;   // anchors in non-markdown are not ours to judge
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return 'unreadable: ' + rel; }
    if (!anchors(text).has(anchor.toLowerCase())) return 'no heading matches #' + anchor;
  }
  return null;
}

function scan(target) {
  const abs = path.resolve(target);
  const isDir = fs.statSync(abs).isDirectory();
  const root = isDir ? abs : path.dirname(abs);
  const files = isDir ? mdFiles(root, root) : [abs];
  const problems = [];
  for (const f of files) {
    const text = stripFences(fs.readFileSync(f, 'utf8'));
    for (const l of links(text)) {
      const p = checkLink(f, l.target, root);
      if (p) problems.push({ file: path.relative(root, f), line: l.line, target: l.target, reason: p });
    }
  }
  return problems;
}

const VERSION = require('./package.json').version;

const USAGE = `Usage: linkrot [path] [--json]

Find broken relative links and anchors in Markdown files. Fully offline.

Arguments:
  path             directory to scan, or one .md/.mdx file (default: current directory)

Options:
  --json           machine-readable output
  -h, --help       show this help
  --version        show the version

Exit codes: 0 = no broken links, 1 = broken links found, 2 = usage error.`;

function main(argv) {
  let json = false;
  let target = null;
  for (const a of argv) {
    if (a === '-h' || a === '--help') { console.log(USAGE); return 0; }
    if (a === '--version') { console.log('linkrot ' + VERSION); return 0; }
    if (a === '--json') { json = true; continue; }
    if (a.startsWith('-')) { console.error('unknown option: ' + a + ' (try --help)'); return 2; }
    if (target !== null) { console.error('unexpected extra argument: ' + a); return 2; }
    target = a;
  }
  target = target || '.';
  if (!fs.existsSync(target)) { console.error('no such file or directory: ' + target); return 2; }
  if (!fs.statSync(target).isDirectory() && !/\.mdx?$/i.test(target)) {
    console.error('not a markdown file: ' + target);
    return 2;
  }
  const problems = scan(target);
  if (json) { console.log(JSON.stringify(problems, null, 2)); return problems.length ? 1 : 0; }
  if (!problems.length) { console.log('no broken links'); return 0; }
  for (const p of problems) console.log(p.file + ':' + p.line + '  [' + p.target + ']  ' + p.reason);
  console.log('\n' + problems.length + ' broken link' + (problems.length === 1 ? '' : 's') + '.');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { scan, checkLink };
