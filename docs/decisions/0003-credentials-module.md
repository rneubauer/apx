# ADR-0003: Credentials module and the APDS materialization rule

## Status

Accepted

## Date

2026-09-20

## Context

Sites issue keycards, fobs, RFID tags, transponders, hangtags, mobile
credentials, and use plates as credentials. APDS models a credential only as
`CredentialAssigned` on an `AssignedRight`. It has no status, replacement,
physical media or access history.

## Decision

- Add the optional class `apx-credentials` with the resource
  `CredentialRecord`. It is not called `Credential` because APDS owns that
  name.
- `credentialType` is the APDS `CredentialTypeEnum` (the read technology).
  `media.form` is the physical form: `physicalCard`, `fob`, `transponder`,
  `hangtag`, `mobile`, `plate`, `ticket` or `virtual`.
- Track physical media: serial number, batch and deposit.
- Include access events: `GET /v1/credentials/{id}/access-events` and the
  topic `apx.credentials.access.v1`.
- APDS materialization is a MUST. An active record MUST appear as
  `CredentialAssigned` on the holder's AssignedRights, and MUST be removed on
  suspend, lost, revoke or expire.

## Consequences

- A lane that speaks only APDS denies a lost or revoked card without needing
  a second list.
- APDS has no enum value for magstripe or NFC. Implementations map to the
  nearest value and carry the exact technology in `extensions`.
- The existing Part 17 `GET /v1/credentials/{id}/passback` route was left
  unchanged.
- Left out on purpose: credential encoding and provisioning protocols, mobile
  wallet issuance flows, and bulk import.

## References

- Part 21 §21.1 (lifecycle), §21.2 (APDS materialization), §21.4 (access
  events)
- CHANGELOG 0.7.0 (2026-09-20)
