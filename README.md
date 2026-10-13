# CoCA Artist Directory

Public directory of Cult of Crypto Art members.

Live page: https://basileus-eth.github.io/coca-directory/

## Updating

1. Replace `data/people.json`.
2. Run `node scripts/resolve-links.mjs` and review `data/link-report.md`.
3. Run `node scripts/validate-data.mjs`.
4. Run `node scripts/fetch-media.mjs`.
5. Test locally with `python3 -m http.server`.
6. Commit and push.
