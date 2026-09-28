**Suggested title:** `Identifiers` requires `rateTableId` but declares `rateTableID`

---

*Type: schema error (a small typo).*

## Summary

`Identifiers` (the compound reference in a quote `Option`) declares the
property `rateTableID` and requires `rateTableId`. JSON property names
are case-sensitive, so the required key is undeclared and the declared
key is never required.

## Where

`apds-api-4.1.yaml`, `components.schemas.Identifiers`, lines 7894–7906
(at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`):

```yaml
Identifiers:
  properties:
    rateTableID:            # <-- declared
      $ref: '#/components/schemas/VersionedReference'
    rightSpecificationId:
      $ref: '#/components/schemas/VersionedReference'
  required:
    - rateTableId           # <-- required
    - rightSpecificationId
```

## Why it matters

A publisher following the declared property sends `rateTableID` and
fails `required`; one following `required` sends an untyped key.
Everywhere else in APDS identifiers end in `Id` (`rightSpecificationId`,
`quoteResponseId`, `optionId`), so we assume `rateTableId` is the intended spelling.
(`RateTable.rateTableID`, a MultilingualString label, is a different
member and is not affected.)

## Impact

Low, but every quote option that names the rate table it prices is
affected; implementers who notice drop `identifiers` altogether and lose
the reference.

## Suggested fix

```diff
   properties:
-    rateTableID:
+    rateTableId:
       $ref: '#/components/schemas/VersionedReference'
```

## APX workaround

The APX data overlay declares `rateTableId` (a `VersionedReference`)
beside the vendored `rateTableID` in the bundled schema, so the required
key is typed. Publishers send `rateTableId`.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
