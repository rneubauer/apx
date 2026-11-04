# docs/site

The source of the landing page of the GitHub Pages site.

- `index.html` is the landing page template.

`tools/build-site.mjs` reads it and writes `site/index.html`. The same script
copies the bundles and the registries into `site/`, and builds an index of the
registries from the files themselves. It also builds the module index shown on
the landing page, using `tools/site-icons.mjs`. The `site/` folder is
generated and is not committed.

The reference pages (`reference.html`, `parcs.html`) and the combined standard
(`apx-standard.md`) are made by other steps of `npm run docs:build` and then
placed in `site/`.
