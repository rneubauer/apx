# Operational scenario index

150 proposed cases. See [review rules and status](README.md). Each module link opens the full Given/When/Then cases; these are drafts, not executed test results.

## [apx-accounts](apx-accounts.md)

- ACC-OPS-001 — A partial payment does not reset courtesy history
- ACC-OPS-002 — The employer pays a different site account
- ACC-OPS-003 — A parent pays without becoming the permit holder
- ACC-OPS-004 — Paying a refundable deposit does not pay dues
- ACC-OPS-005 — Pay station and phone agent collect the same debt
- ACC-OPS-006 — Refunding dues after the holder has used access
- ACC-OPS-007 — A company remittance covers several drivers
- ACC-OPS-008 — Account credit cannot be silently transferred
- ACC-OPS-009 — Parking and violation charges are paid together
- ACC-OPS-010 — A receipt is for yesterday's visit

## [apx-alerts](apx-alerts.md)

- ALT-OPS-001 — Repeated unpaid courtesy exits reach management
- ALT-OPS-002 — Acknowledging the debt alert does not restore access
- ALT-OPS-003 — Payment arrives while a manager works the alert
- ALT-OPS-004 — A small payment leaves the escalation open
- ALT-OPS-005 — Broken media must not look like repeated debt abuse
- ALT-OPS-006 — The same person calls twice about one denial
- ALT-OPS-007 — A later visit after a resolved alert is a new incident
- ALT-OPS-008 — Site manager receives only the permitted portion
- ALT-OPS-009 — Shift handover preserves who must act
- ALT-OPS-010 — Debt waiver and alert expiry are different outcomes

## [apx-control](apx-control.md)

- CTL-OPS-001 — Two agents spend the last courtesy exit
- CTL-OPS-002 — The customer changes lanes during a negotiated offer
- CTL-OPS-003 — A paid ticket is handed to the car behind
- CTL-OPS-004 — A monthly parker took a transient ticket
- CTL-OPS-005 — A courtesy vend succeeds but the driver stays
- CTL-OPS-006 — Negotiated price followed by merchant validation
- CTL-OPS-007 — Canceling a lane action does not refund its payment
- CTL-OPS-008 — Attendant redirects a car to an entry-only lane
- CTL-OPS-009 — Staff opens a gate for a pedestrian delivery
- CTL-OPS-010 — A borrowed credential identifies the wrong entitlement

## [apx-credentials](apx-credentials.md)

- CRD-OPS-001 — Replacing the card does not create a fresh courtesy allowance
- CRD-OPS-002 — Replacing a suspended card must not cure the debt
- CRD-OPS-003 — Employer terminates one employee while the fleet stays paid
- CRD-OPS-004 — One holder has two valid cards but one-car entitlement
- CRD-OPS-005 — Returned stock card is issued to a new person
- CRD-OPS-006 — Credential valid at two sites loses only one entitlement
- CRD-OPS-007 — Mobile and physical cards remain after a loss report
- CRD-OPS-008 — A replacement is collected by a coworker
- CRD-OPS-009 — Temporary loan card outlives the repair
- CRD-OPS-010 — A usable card is mistaken for a failed reader

## [apx-data](apx-data.md)

- DATA-OPS-001 — Three calls, two courtesies, one unpaid balance
- DATA-OPS-002 — One payment appears on both APX and APDS surfaces
- DATA-OPS-003 — Month-end refund preserves the original sale period
- DATA-OPS-004 — Permit sales are not current vehicle occupancy
- DATA-OPS-005 — Valet staging is not an additional occupied parking visit
- DATA-OPS-006 — A canceled unused permit disappears from current inventory but not sales history
- DATA-OPS-007 — Corrected vehicle association changes attribution without creating revenue
- DATA-OPS-008 — Site changes operator while prior refunds remain possible
- DATA-OPS-009 — Courtesy report distinguishes waived fees from deferred debt
- DATA-OPS-010 — Regional reporting survives the same person having local IDs

## [apx-discovery](apx-discovery.md)

- DSC-OPS-001 — The agent can see debt but cannot take payment
- DSC-OPS-002 — New reservation service lacks the permit service
- DSC-OPS-003 — Merchant can validate but cannot refund the guest
- DSC-OPS-004 — Valet request permission is not management permission
- DSC-OPS-005 — Supervisor works at Lakeside but is ordinary staff at Riverside
- DSC-OPS-006 — Credential replacement is supported only at one site
- DSC-OPS-007 — An enforcement reader is not an appeals reviewer
- DSC-OPS-008 — A toll dispute desk does not automatically control the garage
- DSC-OPS-009 — Analytics needs financial facts without unrestricted customer identity
- DSC-OPS-010 — Outsourced support changes organizations at contract renewal

## [apx-events](apx-events.md)

- EVT-OPS-001 — The same courtesy is observed through SSE and a webhook
- EVT-OPS-002 — An old balance-related denial arrives after payment
- EVT-OPS-003 — Payment and credential activation are independent events
- EVT-OPS-004 — Permit pool changes before the right's create event is processed
- EVT-OPS-005 — Refund update is processed before the original payment event
- EVT-OPS-006 — Merchant receives only its own part of the visit
- EVT-OPS-007 — A delayed retrieval event refers to a canceled request
- EVT-OPS-008 — A link payment and its support summary are not two collections
- EVT-OPS-009 — Former operator's subscriber remains after site cutover
- EVT-OPS-010 — Business state must be recovered after a long pause

## [apx-lpr](apx-lpr.md)

- LPR-OPS-001 — The family car belongs to two different monthly customers
- LPR-OPS-002 — Rental plate changes hands between visits
- LPR-OPS-003 — A sold vehicle still matches the seller's permit
- LPR-OPS-004 — Trailer and towing vehicle have different plates
- LPR-OPS-005 — A delivery driver turns around without parking
- LPR-OPS-006 — Changing a plate must not rewrite the camera's evidence
- LPR-OPS-007 — Driver swaps tickets with a similar-looking car
- LPR-OPS-008 — Same plate text from two jurisdictions
- LPR-OPS-009 — A valet runner takes the car through a public exit
- LPR-OPS-010 — A customer returns with a newly fitted permanent plate

## [apx-permits](apx-permits.md)

- PRM-OPS-001 — Two cars arrive under a one-car permit
- PRM-OPS-002 — Permit canceled while its car is still inside
- PRM-OPS-003 — Renewal should not occupy two current slots
- PRM-OPS-004 — A temporary rental replaces a parked vehicle
- PRM-OPS-005 — Employer reallocates a permit between staff
- PRM-OPS-006 — Night-shift permit crosses midnight
- PRM-OPS-007 — One corporate bill is overdue but a personal supplement is paid
- PRM-OPS-008 — Permit is valid but its reserved bay is occupied
- PRM-OPS-009 — A suspended credential does not release a sold permit
- PRM-OPS-010 — A paid upgrade moves a holder to another product

## [apx-reservations](apx-reservations.md)

- RSV-OPS-001 — A monthly permit and prepaid booking cover the same visit
- RSV-OPS-002 — A guest drives the booker's different car
- RSV-OPS-003 — Hotel moves the guest to another garage
- RSV-OPS-004 — One booking is shared between two arriving cars
- RSV-OPS-005 — The driver leaves briefly and returns
- RSV-OPS-006 — Consecutive reservations form one physical stay
- RSV-OPS-007 — Arrival before the booking buys only the early interval
- RSV-OPS-008 — Customer cancels while the lane checks in
- RSV-OPS-009 — A parking reservation is mistaken for valet service
- RSV-OPS-010 — A no-show was actually parked under a transient ticket

## [apx-resolution](apx-resolution.md)

- RES-OPS-001 — The third visit after two unpaid courtesy exits
- RES-OPS-002 — A broken card and a balance hold coexist
- RES-OPS-003 — Paid up but never activated
- RES-OPS-004 — Family phone does not identify the driver
- RES-OPS-005 — A chat continues as an intercom call
- RES-OPS-006 — Supervisor approval is for this car
- RES-OPS-007 — A promised exception is not an approved exception
- RES-OPS-008 — A disputed debt is only part of the balance
- RES-OPS-009 — Guest at the lane, employer owns the account
- RES-OPS-010 — An old exception survives context expiry

## [apx-tolling](apx-tolling.md)

- TOL-OPS-001 — Monthly parking includes the access-road toll
- TOL-OPS-002 — Parking cancellation does not erase a used crossing
- TOL-OPS-003 — Sold car produces a not-liable dispute
- TOL-OPS-004 — Fleet tag moves to a different vehicle class
- TOL-OPS-005 — Trailer changes price for just one journey
- TOL-OPS-006 — One fleet remittance pays a batch of crossings
- TOL-OPS-007 — Dispute opened before the scheduled account collection
- TOL-OPS-008 — Adjusted toll has already been paid
- TOL-OPS-009 — A prepaid parking receipt is offered for an unpaid toll
- TOL-OPS-010 — A contractor exemption expires during a longer parking stay

## [apx-valet](apx-valet.md)

- VLT-OPS-001 — A spouse requests collection but is not authorized for handback
- VLT-OPS-002 — Hotel pays parking but the guest owes valet service
- VLT-OPS-003 — Guest changes rooms and the old folio closes
- VLT-OPS-004 — Prepaid self-parker upgrades to valet after entering
- VLT-OPS-005 — Guest collects luggage without ending custody
- VLT-OPS-006 — Guest takes the car to dinner and returns overnight
- VLT-OPS-007 — Two cars on one room account are confused
- VLT-OPS-008 — A friend pays the bill but may not take the car
- VLT-OPS-009 — Damage complaint before signing the handback
- VLT-OPS-010 — A guest leaves without settling the account

## [apx-validations](apx-validations.md)

- VAL-OPS-001 — A discount does not clear monthly arrears
- VAL-OPS-002 — Voucher presented after full parking payment
- VAL-OPS-003 — Two stackable discounts have order-dependent results
- VAL-OPS-004 — A zero-price monthly visit receives a billable voucher
- VAL-OPS-005 — Restaurant and cashier validate through different channels
- VAL-OPS-006 — Merchant supplies the wrong guest's ticket
- VAL-OPS-007 — Voucher valid when issued but program later suspended
- VAL-OPS-008 — Reversal must not resurrect a stolen voucher
- VAL-OPS-009 — Hotel nights and restaurant hours overlap
- VAL-OPS-010 — The restaurant changes owner before the credit arrives

## [apx-violations](apx-violations.md)

- VIO-OPS-001 — Permit canceled after the observation but before review
- VIO-OPS-002 — A courtesy exit is not proof that the parking debt was waived
- VIO-OPS-003 — App purchase occurs during an officer's inspection
- VIO-OPS-004 — Rental company names a different responsible driver
- VIO-OPS-005 — A plate correction clears one notice but not another
- VIO-OPS-006 — Permit holder uses a restricted bay
- VIO-OPS-007 — Customer pays the old amount after a penalty increase
- VIO-OPS-008 — One receipt is offered to settle two notices
- VIO-OPS-009 — Employer buys a retroactive permit after the ticket
- VIO-OPS-010 — A vehicle leaves and returns between enforcement rounds

