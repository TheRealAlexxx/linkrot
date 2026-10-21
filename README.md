# linkrot

Find broken relative links and anchors in your Markdown files. Fully offline,
zero dependencies.

```
$ npx github:TheRealAlexxx/linkrot .
docs/guide.md:14  [api.md#options]  no heading matches #options
README.md:3       [CONTRIBUTING.md]  no such file: CONTRIBUTING.md

2 broken links.
```

Exit code 1 when something is broken (CI-friendly), 0 when clean, 2 on a bad
directory. `--json` for machine output.

## What it checks

- Every `[text](target)` inline link in `.md` and `.mdx` files, skipping
  `node_modules`, `.git`, `dist`, `build`, `vendor` and similar.
- Relative file targets must exist (`%20` is decoded). A directory target is
  fine when it has a `README.md` or `index.md`.
- `#anchors` must match a heading in the target file, using GitHub's slug
  rules (lowercase, punctuation dropped, spaces to `-`), including anchors
  that point at the same file.
- Links inside fenced code blocks are ignored. `http(s)`, `mailto:`, `tel:`
  and `data:` links are skipped: linkrot never touches the network.

## Limits

Reference-style links (`[text][ref]`) are not followed. Anchors in
non-Markdown files are not judged. It checks that links resolve, not that
they are the links you meant.

## Tests

```
node --test
```

## License

MIT
