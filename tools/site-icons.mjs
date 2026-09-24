/**
 * Icons for the module index on the landing page, keyed by OpenAPI tag name.
 *
 * Hand-drawn 24x24 line glyphs, stroked in currentColor so they take the
 * page's accent colour in both themes. Kept out of the spec on purpose: the
 * bundle is a normative artifact and a picture is not part of the contract.
 *
 * A tag with no entry here renders FALLBACK and build-site.mjs prints a
 * warning, so adding a module never breaks the build, only nudges you to
 * draw its icon.
 */

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  // Start here
  Discovery: svg(
    '<circle cx="12" cy="12" r="9"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>'
  ),

  // Platform
  Data: svg(
    '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'
  ),
  Subscription: svg(
    '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1" fill="currentColor"/>'
  ),
  Control: svg(
    '<path d="M3 7h9M16 7h5M3 12h3M10 12h11M3 17h12M19 17h2"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>'
  ),
  Alerts: svg(
    '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'
  ),

  // Commerce
  Accounts: svg(
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'
  ),
  Reservations: svg(
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15.5 2 2 4-4"/>'
  ),
  Permits: svg(
    '<path d="M3 9V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4Z"/><path d="M9 7v10" stroke-dasharray="2 2"/>'
  ),
  Validations: svg(
    '<path d="m12 3 7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="m9 12 2 2 4-4"/>'
  ),
  Tolling: svg('<path d="M4 20 8 4M20 20 16 4M12 5v3M12 11v3M12 17v3"/>'),

  // Vehicles and access
  LPR: svg(
    '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'
  ),
  Credentials: svg(
    '<circle cx="8" cy="15" r="4.5"/><path d="m11.5 11.5 9-9M17.5 5.5 20 8M14.5 8.5l2.5 2.5"/>'
  ),
  Valet: svg(
    '<path d="M5 17v-4.5L7.5 7h9l2.5 5.5V17"/><path d="M3 17h18"/><circle cx="7.5" cy="17" r="1.75"/><circle cx="16.5" cy="17" r="1.75"/>'
  ),

  // Enforcement and service
  Violations: svg(
    '<rect x="11.5" y="6.5" width="8" height="4" rx="1" transform="rotate(45 15.5 8.5)"/><path d="m12.7 11.3-8.2 8.2"/><path d="M3 21h9"/>'
  ),
  Resolution: svg(
    '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19v1a2 2 0 0 1-2 2h-4"/>'
  ),
  Support: svg(
    '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/>'
  ),
};

/** A plain module glyph for tags that have no icon yet. */
export const FALLBACK = svg(
  '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6M12 9v6"/>'
);
