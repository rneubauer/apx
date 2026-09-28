**Suggested title:** Suggestion: align response codes on `/rates`, `/rights/assigned/{id}`, and `/contacts` with their siblings

---

*Type: consistency suggestion — none of these is an error on its own.*

## Summary

A consistency suggestion rather than a bug report. Three native
operations use different response codes from the other operations of
their kind. None is invalid, and each may be deliberate; we mention them
because a client written to the conventions of one route can misread the
next.

## Where

`apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`):

1. `paths./rates.post` (`create-rate`, line 1108): success is **200**,
   and no 400 or 409 is declared. Every other native create answers
   201 and declares 400 and 409.
2. `paths./rights/assigned/{id}.put` (`update-assigned_right`,
   lines 1724–1787): declares **201** ("Created" — an upsert) and no
   **404**. Every other native `PUT` declares 404 and no 201. The 201
   example also carries `code: 200`.
3. `paths./contacts.get` and `paths./contacts/{contactId}.get`: the only
   operations that declare **500**.

## Why it matters

A client that treats "201 on create, 404 on PUT to an unknown id" as
the APDS convention can mishandle `/rates` and `/rights/assigned`, and a
code generator produces a different error surface per route. Each
difference may well be deliberate; if so, a short note documenting it
would be enough.

## Impact

Low, but it lands on the two routes third parties write to most (rate
decks and permits).

## Suggested fix

- `POST /rates`: answer 201 like the other creates (in the next major
  version, since changing a success code is not backward compatible),
  and declare 400 and 409 now.
- `PUT /rights/assigned/{id}`: either document the upsert (and fix the
  example's `code`) or remove the 201; declare 404 either way.
- Either declare 500 everywhere or nowhere.

## APX workaround

The APX data overlay declares 400/409 on `POST /rates` and 404 on
`PUT /rights/assigned/{id}` in the bundled document. APX Part 5 §5.7
records the rest as known APDS 4.1 behaviour so implementers do not
"fix" it in a way that breaks stock clients.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
