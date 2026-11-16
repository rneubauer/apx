# web

The build of the simulator that runs in a browser page, for the static site.
It uses the same kernel and domain modules as `apx-sim serve`. Part of the
[simulator](../README.md).

- `build.mjs`: bundles the kernel and domains for the browser, packs the files they read into a virtual filesystem, and puts the UI beside them. Run with `node packages/simulator/web/build.mjs [outDir]` (default `site/simulator`) or `npm run sim:web`.
- `browser.mjs`: answers the UI's requests inside the page. Requests to root-relative paths such as `/sim/` and `/v1/` never leave the page.
- `shims/`: small stand-ins for the Node built-ins the simulator uses.
  - `buffer.mjs`: the parts of `Buffer` the simulator uses.
  - `crypto.mjs`: SHA-256, HMAC, random ids and bytes.
  - `fs.mjs`: a read-mostly virtual filesystem; writes last until the page reloads.
  - `http.mjs`: no server; creating one throws.
  - `path.mjs`: POSIX paths.
  - `url.mjs`: file URLs inside the virtual filesystem.
