# Security Policy

APX is a specification, not an implementation. There is no APX service to
attack. Security issues here fall into two kinds, and they are reported
differently.

## A defect in the specification

A flaw in what the standard *requires* is the serious kind: a weak or
missing control that every conforming implementation would inherit. Examples
are an endpoint whose grant rule can be bypassed, a scope that exposes more
personal data than its purpose needs, an auditable action with no audit, or
a normative default that fails open.

**Report these privately** to <rneubauer@umojo.com> with the Part and
section, what an attacker gains, and a concrete call sequence if you have
one. Please do not open a public issue first: unlike an application bug,
every implementer has to change their code once the flaw is known, so
coordination matters.

We will acknowledge within five working days and agree a disclosure timeline
with you. Fixes land as a normal specification change with the defect
described in the changelog, and you are credited unless you ask otherwise.

## A vulnerability in this repository

Tooling, workflows, or dependencies: open a normal public issue. These
affect only people who build the spec, not the standard itself.

## Out of scope

Vulnerabilities in a *product* that implements APX belong to that vendor.
Vulnerabilities in APDS 4.1 belong to the Alliance for Parking Data
Standards; the vendored copy here is byte-identical to the published
release and is checksum-guarded, so it is not ours to patch.

## Where the security requirements live

Part 9 of the written standard is the security profile: transport, OAuth
scopes, the fail-closed place-grant model, webhook signing and replay
windows, and the privacy clause covering plate data, imagery, retention,
and minimization. Annex A numbers the testable requirements. If you think a
requirement there is wrong, that is a specification defect, above.
