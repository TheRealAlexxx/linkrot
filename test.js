'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const { stripFences, links, slug, anchors } = require('./md.js');
const { scan, checkLink } = require('./linkrot.js');

test('slug follows GitHub rules', () => {
  assert.strictEqual(slug('Hello, World! (v2)'), 'hello-world-v2');
  assert.strictEqual(slug('C++ & Rust'), 'c-rust');
  assert.strictEqual(slug('  Spaced   out  '), 'spaced-out');
  assert.strictEqual(slug('under_score-kept'), 'under_score-kept');
});

test('fenced code is ignored', () => {
  const t = '[ok](a.md)\n```\n[fake](nope.md)\n```\n[ok2](b.md)';
  assert.deepStrictEqual(links(stripFences(t)).map((l) => l.target), ['a.md', 'b.md']);
});

test('anchors collects headings, links in headings count as text', () => {
  const a = anchors('# Title\n## See [the guide](x.md)\n### `code` head\n');
  assert.ok(a.has('title') && a.has('see-the-guide') && a.has('code-head'));
});

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-'));
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); }
  return dir;
}

test('scan finds missing files and bad anchors, accepts good ones', () => {
  const dir = project({
    'README.md': '[a](docs/a.md) [b](docs/a.md#part-two) [c](missing.md) [d](docs/a.md#nope) [e](#local) [web](https://x.co/y) [mail](mailto:a@b.c)\n# Local\n',
    'docs/a.md': '# Part one\n## Part two\n',
  });
  const bad = scan(dir);
  assert.deepStrictEqual(bad.map((p) => p.target), ['missing.md', 'docs/a.md#nope']);
});

test('directory links want a README, percent-encoded paths work', () => {
  const dir = project({
    'a.md': '[d](docs) [sp](my%20file.md)',
    'docs/README.md': '# hi\n',
    'my file.md': '# x\n',
  });
  assert.deepStrictEqual(scan(dir), []);
  const dir2 = project({ 'a.md': '[d](docs)', 'docs/note.md': '' });
  assert.deepStrictEqual(scan(dir2).map((p) => p.reason), ['directory with no README.md: docs']);
});

test('anchors in non-markdown files are not judged', () => {
  const dir = project({ 'a.md': '[s](main.rs#entry)', 'main.rs': 'fn main() {}' });
  assert.deepStrictEqual(scan(dir), []);
});

test('CLI exit codes and json', () => {
  const bin = path.join(__dirname, 'linkrot.js');
  const ok = project({ 'a.md': '[b](b.md)', 'b.md': '' });
  assert.strictEqual(spawnSync('node', [bin, ok]).status, 0);
  const bad = project({ 'a.md': '[b](b.md)' });
  const r = spawnSync('node', [bin, bad], { encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /a\.md:1/);
  assert.strictEqual(JSON.parse(spawnSync('node', [bin, bad, '--json'], { encoding: 'utf8' }).stdout)[0].target, 'b.md');
  assert.strictEqual(spawnSync('node', [bin, path.join(bad, 'nope')]).status, 2);
});

test('CLI argument handling and single-file input', () => {
  const bin = path.join(__dirname, 'linkrot.js');
  const help = spawnSync('node', [bin, '--help'], { encoding: 'utf8' });
  assert.strictEqual(help.status, 0);
  assert.match(help.stdout, /Usage: linkrot/);
  const ver = spawnSync('node', [bin, '--version'], { encoding: 'utf8' });
  assert.strictEqual(ver.status, 0);
  assert.match(ver.stdout, /^linkrot \d+\.\d+\.\d+/);
  const bogus = spawnSync('node', [bin, '--bogus'], { encoding: 'utf8' });
  assert.strictEqual(bogus.status, 2);
  assert.match(bogus.stderr, /unknown option: --bogus/);
  const notMd = project({ 'data.txt': 'hello' });
  const notMdRun = spawnSync('node', [bin, path.join(notMd, 'data.txt')], { encoding: 'utf8' });
  assert.strictEqual(notMdRun.status, 2);
  assert.match(notMdRun.stderr, /not a markdown file/);
  const proj = project({ 'README.md': '# README\n\nSee [gone](missing.md).\n', 'docs/guide.md': 'Back [home](../README.md#readme).\n' });
  const oneFile = spawnSync('node', [bin, path.join(proj, 'README.md')], { encoding: 'utf8' });
  assert.strictEqual(oneFile.status, 1);
  assert.match(oneFile.stdout, /README\.md:3 {2}\[missing\.md\]/);
  assert.doesNotMatch(oneFile.stdout, /guide\.md/);
  const cleanFile = spawnSync('node', [bin, path.join(proj, 'docs/guide.md')], { encoding: 'utf8' });
  assert.strictEqual(cleanFile.status, 0);
});
test('malformed percent-encoding is reported, not thrown', () => {
  const bin = path.join(__dirname, 'linkrot.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkrot-'));
  fs.writeFileSync(path.join(dir, 'a.md'), '[bad](%zz.md)\n');
  const r = spawnSync(process.execPath, [bin, dir], { encoding: 'utf8' });
  assert.notEqual(r.status, 2);
  assert.match(r.stdout + r.stderr, /malformed percent-encoding/);
});
