# Claude Code rules for coca-directory

This repo sits in `~/code`, outside `~/emperor`, so `~/emperor/CLAUDE.md` does not load on its own. Read it first. It covers git, anonymity, secrets, code, review, and prose, and wins where this file differs. Land every change with the `/basileus-pr` skill.

## What this is

The public CoCA Artist Directory. A static site with no build step: `index.html`, `app.js`, and `styles.css` load `data/people.json` and `data/media-manifest.json` and show images from `media/web/`. `README.md` lists the steps to refresh the data.

## Run, check, and test

- Run: `python3 -m http.server` from the repo root, then open http://localhost:8000.
- Check: `node scripts/validate-data.mjs`. There is no `just check`, no test suite, and no git hook in this repo, so run it yourself before each commit. If it already fails on `main`, say so in the PR and leave unrelated data alone.
- Links: `.github/workflows/link-check.yml` runs lychee on `data/people.json` each Monday and opens or updates an issue when links break. It does not run on pull requests.
- Media: `node scripts/fetch-media.mjs` needs `npm install` (for sharp) and downloads from X. Files in `media/originals/` stay byte-for-byte as downloaded.

## Deploy

GitHub Pages serves `main` from the repo root. Merging to `main` publishes the change to everyone, so merge only when the owner says so. There is no deploy step and no deployed copy.

## Public content

Profile text and art belong to each artist (see `NOTICE.md`). Do not rewrite an artist's bio or replace their images beyond what the task asks. No git hook checks identity here, so scrub commits and PR text for the owner's real name and home paths yourself.
