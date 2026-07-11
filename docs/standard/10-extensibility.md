# APX Part 10 — Extensibility

APX is built to be extended the same way it extends APDS.

## 10.1 The three sanctioned mechanisms

1. **Extensions container** (Part 4 §4.3) — arbitrary structured additions to
   any APX resource or APDS entity, namespaced and versioned
   (`apds-ext:<ns>:<class>@<M.m>`).
2. **UserDefinedCodeLists** (Part 11) — open vocabularies. Where an APX field
   is typed `CodeListValue`, implementers MAY add values by publishing their
   own list; they MUST NOT overload APX-registered values with different
   semantics.
3. **New domains** — a new spec module + conformance class + scope family +
   topic prefix, added without touching existing files (this is how
   reservations, permits, and tolling were added to APX itself).

## 10.2 What extension MUST NOT do

- Change the semantics of an existing field, path, topic, or code-list entry.
- Add required fields to existing schemas.
- Introduce parallel constructs for things APDS or APX already models
  (identity, timestamps, money, references, place hierarchy…).
- Squat the `apx` namespace or `apx.` topic prefix (reserved; see Part 3
  §3.3 for the full vendor rules and the adoption path into `apx`).

## 10.3 Level B / Level C posture (informative)

Relative to the DATEX II extension taxonomy the APDS Information Model uses:
APX in-payload decorations via the extensions container are **Level B**
(backward compatible — plain APDS consumers ignore them). The APX companion
API layer (commands, alerts, subscriptions-superset, discovery…) is honestly
**Level C-adjacent**: new interaction roots that APDS consumers never see,
referencing APDS entities by Reference. APX declares
`extensionName: apx` and `extensionVersion` in the OpenAPI `info` block per
the Information Model's extension declaration rule.
