'use strict';
// Markdown helpers for linkrot: strip fenced code, find inline links, and
// make GitHub-style anchor slugs from headings.

// Remove fenced code blocks (``` or ~~~) so links inside them are ignored.
function stripFences(text) {
  return text.split(/\r?\n/).reduce((acc, line) => {
    if (/^\s*(```|~~~)/.test(line)) acc.open = !acc.open;
    else if (!acc.open) acc.lines.push(line);
    return acc;
  }, { open: false, lines: [] }).lines.join('\n');
}

// Inline links [text](target "title"). Reference-style links are not handled.
function links(text) {
  const out = [];
  const re = /\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let m, line = 1, last = 0;
  while ((m = re.exec(text))) {
    line += (text.slice(last, m.index).match(/\n/g) || []).length;
    last = m.index;
    out.push({ text: m[1], target: m[2], line });
  }
  return out;
}

// GitHub's heading anchor rule: lowercase, drop punctuation, spaces to '-'.
function slug(heading) {
  return heading.trim().toLowerCase()
    .replace(/[`*~]/g, '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, '-');
}

function anchors(text) {
  const set = new Set();
  for (const line of stripFences(text).split(/\r?\n/)) {
    const m = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) set.add(slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')));
  }
  return set;
}

module.exports = { stripFences, links, slug, anchors };
