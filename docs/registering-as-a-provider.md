# Registering as an APX provider

Every organisation that implements APX is listed in the APX provider
registry, `spec/providers/apx-providers.json`. This guide says why, what
an entry holds, and how to add yours. The normative rules are in the
written standard: Part 3 §3.1a (registration is required), Part 4 §4.1b
(provider identity and global keying), and Part 11 §11.3 rule 5 and §11.4
(the registry and how registrations are approved).

The published copy is at <https://rneubauer.github.io/apx/providers/>.

## Why registration exists

1. **Knowing who uses APX.** The main goal today is to know who is
   interested in APX and who is building on it, so the standard can be
   steered by the people implementing it. That is why an entry can be as
   small as a name, a namespace, and a contact.
2. **Global keying.** Ids in APX are local to the implementation that
   issued them (Part 4 §4.1a). Two providers can both have a place with
   the same id, and both are right. A system that brings data from
   several providers together, such as an aggregator, a call center, or
   an analytics platform, keys every record by (`providerId`,
   `installationId`, local id), never by the local id alone (Part 4
   §4.1b). The registry is where a `providerId` comes from, and the one
   place it is guaranteed unique. The `installationId` is not registered:
   each deployment generates its own (see "Your installation id" below).

## Who must register

Every APX implementation, whatever its role:

- a **server** that answers APX or APDS-native routes;
- a **data provider** whose records reach an APX implementation;
- a **client that pushes data** into an APX implementation (sessions,
  reads, payments, events).

A client that only reads is not an implementation in this sense, but it
may register too, and we would like to hear from you.

Your organisation registers once, with a **company entry**. It covers
every product and deployment you run. Register the organisation, not
each server.

If you want receivers to tell your products apart by `providerId`, you
MAY also add a **product entry** for each product (see "Registering a
product" below). Product entries are optional.

## What an entry holds

| Member | Required | What to put |
|---|---|---|
| `providerId` | yes | A UUID v4 you generate, in lowercase (step 1). |
| `parent` | product entries only | Leave it out on your company entry. On a product entry, your company entry's `providerId`. |
| `name` | yes | Your organisation's name, as it trades (on a product entry, the product's name). |
| `namespace` | yes | Your vendor namespace (step 2). |
| `url` | no | Your public web site, `https://…`. |
| `roles` | yes | One or more of `parcs`, `lpr`, `enforcement`, `payments`, `reservations`, `permits`, `callCenter`, `analytics`, `charging`, `valet`, `platform`, `other`. |
| `contact` | yes | An organisational email address (`apx@acme.example`) or a URL (`https://acme.example/contact`). Never a named person: people change jobs, and the registry is public. |
| `status` | yes | `active`. |
| `registeredDate` | yes | Today's date, `YYYY-MM-DD`. A maintainer corrects it to the merge date if it differs. |

The first entry, Umojo's, is an example:

```json
{
  "providerId": "8ddabe04-3d59-415d-a8ce-620d01b1a240",
  "name": "Umojo, Inc.",
  "namespace": "umojo",
  "url": "https://umojo.com",
  "roles": ["platform", "callCenter", "analytics"],
  "contact": "https://umojo.com",
  "status": "active",
  "registeredDate": "2026-11-08"
}
```

## The steps

1. **Generate a UUID v4.** Any standard tool works:
   - Node: `node -e "console.log(crypto.randomUUID())"`
   - PowerShell: `[guid]::NewGuid().ToString()`
   - macOS or Linux: `uuidgen | tr A-Z a-z`

   Use it only for this entry. Do not reuse an id you use elsewhere, and
   do not pick one by hand.
2. **Choose your namespace.** It is the same namespace your extensions
   use (see the [partner extension guide](partner-extension-guide.md)):
   extension keys `apds-ext:<namespace>:…`, endpoints
   `/apx/x/<namespace>/…`, topics `<namespace>.…`, and vendor classes
   `<namespace>-<class>`. Registering it claims it, so nobody else can
   use it. Rules: lowercase letters, digits and hyphens, starting and
   ending with a letter or digit, at most 32 characters; not `apx` or
   `apds`; not already used by another company entry; and not a name
   that suggests another organisation. Your company name, shortened, is
   usually right.
3. **Add your entry by pull request.** Fork the repository, append your
   entry at the end of `providers` in `spec/providers/apx-providers.json`,
   and increment the top-level `version` by one. Do not change any other
   entry. Run `npm run providers:check`, then open the pull request and
   fill in the "Provider registration" section of the template.
4. **Review.** The APX maintainers review and merge registration pull
   requests against published criteria (Part 11 §11.3 rule 5):
   - the registrant is a real organisation;
   - the `namespace` is unique;
   - the `contact` is organisational;
   - the entry impersonates no one.

   A registration that meets them is merged. One that does not is
   answered on the pull request, naming the criterion it misses. There is
   no fee and no membership, and a registration never waits for an
   edition of the standard.
5. **Use your `providerId`.** Once merged, put it in your
   implementation's data (see the next section).

## Registering a product

A product entry is optional. Add one when you want data from one of your
products to carry its own `providerId`, so a receiver can tell it from
your other products without looking further. It is an ordinary entry
with three differences:

- `parent` is your company entry's `providerId`. The parent must be a
  company entry, not another product: products do not nest.
- `namespace` is your company's namespace, exactly. A product does not
  get a namespace of its own; your extensions stay under the company's.
- `name` is the product's name.

For example, a product entry under Umojo's company entry would look like
this (the `providerId` is illustrative):

```json
{
  "providerId": "<a new UUID v4>",
  "parent": "8ddabe04-3d59-415d-a8ce-620d01b1a240",
  "name": "Umojo NexPark",
  "namespace": "umojo",
  "roles": ["parcs", "lpr"],
  "contact": "https://umojo.com",
  "status": "active",
  "registeredDate": "2026-11-13"
}
```

Add it by pull request like any other entry: append it, increment
`version`, and run `npm run providers:check`, which checks that the
parent exists, that it is a company entry, and that the namespaces
match. Only the organisation that owns the company entry adds products
under it. Implementations of that product then put the product's
`providerId` in their data instead of the company's.

## Your installation id

Ids in APX are local to the installation that issues them, and a vendor
that runs its product at many sites usually issues ids per site. Two of
your own sites can therefore hold the same id. So that receivers can
still tell them apart, each installation (one site's server, one tenant
of a hosted service, one edge box) has an `installationId`:

- The installation generates it, as a UUID v4. It is **not** registered.
- It never changes for the life of the installation, across restarts and
  upgrades alike. Store it with the installation's data, so a restore
  keeps it. A new installation generates a new one.
- Publish it in `/.well-known/apx-configuration` as `installationId`,
  and SHOULD set it on records (`RecordInfo.installation`) and event
  envelopes (`installation`) beside `provider` (Part 4 §4.1b, Part 16
  §16.1).

A receiver keys your records by (`providerId`, `installationId`, local
id). It may key them by the pair (`providerId`, local id) only if you
guarantee that your ids are unique across your whole estate, every
installation included. If you give that guarantee, say so in your
documentation; most vendors cannot, and should publish the
`installationId`.

## Changing or retiring an entry

The registry is add-only, like the code-list registries:

- An entry is never deleted, reordered, or renumbered. Its `providerId`,
  `parent`, `namespace`, and `registeredDate` never change, so a company
  entry never becomes a product entry or the reverse.
- `name`, `url`, `roles`, and `contact` may be updated by pull request
  from the organisation. Increment `version`.
- **Retiring.** When an organisation stops implementing APX, or is
  merged into another, its entry is retired: set `status` to `retired`
  and increment `version`. The entry stays in the file, so records that
  carry its `providerId` can still be traced. A retired `providerId` or
  `namespace` is never reused, and a retired entry is never made active
  again. An organisation that comes back, or a renamed one that wants a
  new namespace, registers a new entry. When a company entry is retired,
  its product entries are retired with it; a product can be retired on
  its own.

`npm run providers:check` enforces these rules against the base branch.

## What is required today, and what is expected later

**Required today:**

- registration, for every implementation (Part 3 §3.1a; Annex A
  APX-CORE-21);
- the keying rule: any system holding records from more than one
  provider or installation keys them by (`providerId`, `installationId`,
  local id), or by (`providerId`, local id) only for a provider that
  guarantees its ids are unique across its whole estate, and an
  aggregator that re-publishes a record keeps the original provider and
  installation (Part 4 §4.1b, Part 18 §18.2; Annex A APX-CORE-22).

**Optional today, and SHOULD be done:**

- `providerId` and `installationId` in your
  `/.well-known/apx-configuration` document (Part 16 §16.1);
- `RecordInfo.provider` and `RecordInfo.installation` on the records you
  create (Part 4 §4.2);
- `provider` and `installation` on the webhook and SSE event envelopes
  you publish (Part 8 §8.2).

Receivers SHOULD also bind your `providerId` to the credentials they issue
you, so a `providerId` you assert in data can be checked against the
credential it arrived with (Part 11 §11.4 rule 5).

**Expected later:** a later edition of the standard is expected to make
the data members above REQUIRED. No version has been set. Adding
them now costs nothing and means that edition will need no change from
you.
