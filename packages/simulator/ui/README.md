# ui

The browser UI, in plain HTML, CSS and JavaScript with no external assets.
`src/kernel/ui.mjs` serves it at `/ui/`. Part of the [simulator](../README.md).
The views are described in the simulator README.

- `index.html`: the app page.
- `vendor.html`: the mock vendor screen that stands in for a PARCS vendor's own console (Part 25).
- `app.css`: the stylesheet.
- `js/app.js`: the app shell: tabs, world picker, clock, theme switch and the live link.
- `js/core.js`: shared pieces: DOM helpers, the HTTP client, app state, and the scenario runner.
- `js/present.js`: the Present view, which walks an audience through a scenario step by step.
- `js/builder.js`: the Build view, which creates, edits, runs and saves scenarios.
- `js/explore.js`: the Explore view: request console, world events, outbox, stored state, operations and request log.
- `js/fabric.js`: the Fabric view, the Part 8 delivery fabric live.
- `js/vendor.js`: the script behind `vendor.html`.
