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

function scan(dir) {
  const root = path.resolve(dir);
  const problems = [];
  for (const f of mdFiles(root, root)) {
    const text = stripFences(fs.readFileSync(f, 'utf8'));
    for (const l of links(text)) {
      const p = checkLink(f, l.target, root);
      if (p) problems.push({ file: path.relative(root, f), line: l.line, target: l.target, reason: p });
    }
  }
  return problems;
}

function main(argv) {
  const json = argv.includes('--json');
  const dir = argv.find((a) => !a.startsWith('--')) || '.';
  if (!fs.existsSync(dir)) { console.error('no such directory: ' + dir); return 2; }
  const problems = scan(dir);
  if (json) { console.log(JSON.stringify(problems, null, 2)); return problems.length ? 1 : 0; }
  if (!problems.length) { console.log('no broken links'); return 0; }
  for (const p of problems) console.log(p.file + ':' + p.line + '  [' + p.target + ']  ' + p.reason);
  console.log('\n' + problems.length + ' broken link' + (problems.length === 1 ? '' : 's') + '.');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { scan, checkLink };
