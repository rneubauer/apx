/**
 * Canonical synthetic seed data for the sandbox. All identifiers are fake.
 */
import type { SandboxClient } from './auth.js';
import type { Store } from './store.js';

export const IDS = {
  org: 'a1000000-0000-4000-8000-000000000001',
  place: 'b1000000-0000-4000-8000-000000000001',
  laneEntry: 'b2000000-0000-4000-8000-000000000001',
  laneExit: 'b2000000-0000-4000-8000-000000000002',
  gateEntry: 'c1000000-0000-4000-8000-000000000001',
  gateExit: 'c1000000-0000-4000-8000-000000000002',
  payStation: 'c1000000-0000-4000-8000-000000000003',
  rateTable: 'd1000000-0000-4000-8000-000000000001',
  rightSpec: 'e1000000-0000-4000-8000-000000000001',
  assignedRight: 'e2000000-0000-4000-8000-000000000001',
  session: 'f1000000-0000-4000-8000-000000000001',
  observation: 'f2000000-0000-4000-8000-000000000001',
  pooledRightSpec: 'e1000000-0000-4000-8000-000000000002',
  rightPool: 'e5000000-0000-4000-8000-000000000001',
} as const;

export const ALL_SCOPES = [
  'apx.data:read',
  'apx.data:write',
  'apx.control:read',
  'apx.control:execute',
  'apx.alerts:read',
  'apx.alerts:write',
  'apx.subscriptions:manage',
  'apx.accounts:read',
  'apx.payments:write',
  'apx.lpr:read',
  'apx.reservations:manage',
  'apx.permits:manage',
  'apx.tolling:manage',
];

export const CLIENTS: SandboxClient[] = [
  {
    clientId: 'apx-operator',
    clientSecret: 'operator-secret',
    scopes: ALL_SCOPES,
    org: { id: IDS.org, className: 'Organisation' },
  },
  {
    clientId: 'apds-legacy',
    clientSecret: 'legacy-secret',
    scopes: ['apx.data:read', 'apx.data:write'],
    org: { id: IDS.org, className: 'Organisation' },
  },
  {
    clientId: 'lpr-vendor',
    clientSecret: 'lpr-secret',
    scopes: ['apx.data:read', 'apx.lpr:read'],
    org: { id: IDS.org, className: 'Organisation' },
    places: [IDS.place],
  },
  {
    clientId: 'other-operator',
    clientSecret: 'other-secret',
    scopes: ['apx.control:read', 'apx.control:execute'],
    org: { id: 'a1000000-0000-4000-8000-000000000099', className: 'Organisation' },
    places: ['b9999999-0000-4000-8000-000000000001'], // a different site — no grant here
  },
];

export function seed(store: Store): void {
  store.for('Contact').create({
    id: IDS.org,
    name: 'Lakeside Parking Operator (synthetic)',
    contactType: 'operator',
  });

  store.for('Place').create({
    id: IDS.place,
    name: { values: [{ language: 'en', value: 'Lakeside Garage (synthetic)' }] },
    layer: 0,
    childElements: [
      { id: IDS.laneEntry, className: 'VehicularAccess', flow: 'entry' },
      { id: IDS.laneExit, className: 'VehicularAccess', flow: 'exit' },
    ],
    characteristics: { accessControlled: true },
    // Operator policy (APX decoration): the fee charged when a ticket is lost.
    extensions: {
      'apds-ext:apx:lostticketpolicy@1.0': { fee: { type: 'USD', value: 25 } },
    },
  });

  store.for('SupplementalEquipment').create({
    id: IDS.gateEntry,
    equipmentType: 'doorWithAccessCredential',
    laneRef: { id: IDS.laneEntry, className: 'VehicularAccess' },
    placeRef: { id: IDS.place, className: 'Place' },
  });
  store.for('SupplementalEquipment').create({
    id: IDS.gateExit,
    equipmentType: 'doorWithAccessCredential',
    laneRef: { id: IDS.laneExit, className: 'VehicularAccess' },
    placeRef: { id: IDS.place, className: 'Place' },
  });
  store.for('SupplementalEquipment').create({
    id: IDS.payStation,
    equipmentType: 'parkingPaymentMachine',
    placeRef: { id: IDS.place, className: 'Place' },
  });

  store.for('RateTable').create({
    id: IDS.rateTable,
    rateTableName: 'Standard hourly (synthetic)',
    rateLineCollections: [
      {
        applicableCurrency: 'USD',
        rateLines: [{ rateLineType: 'incrementingRate', value: 3.0, incrementPeriod: 'PT1H' }],
      },
    ],
  });

  store.for('RightSpecification').create({
    id: IDS.rightSpec,
    name: 'Transient parking (synthetic)',
    placeRef: { id: IDS.place, className: 'Place' },
    rateTables: [{ id: IDS.rateTable, version: 1, className: 'RateTable' }],
  });

  // Pooled RightSpecification for permits (capacity 2 for testability).
  store.for('RightSpecification').create({
    id: IDS.pooledRightSpec,
    name: 'Monthly permit — pooled (synthetic)',
    placeRef: { id: IDS.place, className: 'Place' },
  });
  store.for('RightPool').create({
    id: IDS.rightPool,
    rightSpecification: { id: IDS.pooledRightSpec, version: 1, className: 'RightSpecification' },
    capacity: 2,
  });

  store.for('AssignedRight').create({
    id: IDS.assignedRight,
    rightSpecification: { id: IDS.rightSpec, version: 1, className: 'RightSpecification' },
    issuer: { id: IDS.org, className: 'Organisation' },
  });

  store.for('Session').create({
    id: IDS.session,
    placeRef: { id: IDS.place, className: 'Place' },
    segments: [
      {
        assignedRight: { id: IDS.assignedRight, version: 1, className: 'AssignedRight' },
        actualStart: '2026-07-11T08:00:00Z',
      },
    ],
  });

  // Reservation history for the sample customer (RightHolder e4…11) so the
  // LPR/reservation lookups have a past to show.
  const RESERVATION_EXT_KEY = 'apds-ext:apx:reservation@1.0';
  store.for('AssignedRight').create({
    id: 'e2000000-0000-4000-8000-000000000011',
    rightSpecification: { id: IDS.rightSpec, version: 1, className: 'RightSpecification' },
    issuer: { id: IDS.org, className: 'Organisation' },
    assignedRightHolder: { id: 'e4000000-0000-4000-8000-000000000011', className: 'RightHolder' },
    extensions: {
      [RESERVATION_EXT_KEY]: {
        reservationState: 'checkedIn',
        plannedStart: '2026-07-01T09:00:00Z',
        plannedEnd: '2026-07-01T17:00:00Z',
      },
    },
  });
  store.for('AssignedRight').create({
    id: 'e2000000-0000-4000-8000-000000000012',
    rightSpecification: { id: IDS.rightSpec, version: 1, className: 'RightSpecification' },
    issuer: { id: IDS.org, className: 'Organisation' },
    assignedRightHolder: { id: 'e4000000-0000-4000-8000-000000000011', className: 'RightHolder' },
    extensions: {
      [RESERVATION_EXT_KEY]: {
        reservationState: 'noShow',
        plannedStart: '2026-06-15T09:00:00Z',
        plannedEnd: '2026-06-15T17:00:00Z',
      },
    },
  });

  // A monthly-parker account (2018 requirements ⑥–⑨).
  store.for('Account').create({
    id: 'e4000000-0000-4000-8000-000000000001',
    holder: { id: 'e4000000-0000-4000-8000-000000000011', className: 'RightHolder' },
    name: 'Jordan Sample (synthetic)',
    phone: '+13125550100',
    cardNumber: 'MC-0777',
    plates: ['SYN-1234'],
    balance: { type: 'USD', value: 45 },
    accountStatus: 'enabled',
  });

  // Validation providers at the garage (2018 requirement ⑤).
  store.for('ValidationProvider').create({
    id: 'a2000000-0000-4000-8000-000000000001',
    provider: { id: 'a2000000-0000-4000-8000-000000000011', className: 'Organisation' },
    name: 'Lakeside Cinema (synthetic)',
    validationType: 'twoHoursComped',
    benefit: { description: 'First two hours comped', duration: 'PT2H' },
    placeRef: { id: IDS.place, className: 'Place' },
  });
  store.for('ValidationProvider').create({
    id: 'a2000000-0000-4000-8000-000000000002',
    provider: { id: 'a2000000-0000-4000-8000-000000000012', className: 'Organisation' },
    name: 'Harbor Restaurant (synthetic)',
    validationType: 'flatDiscount',
    benefit: { description: '$3.00 off', amount: { type: 'USD', value: 3 } },
    placeRef: { id: IDS.place, className: 'Place' },
  });

  // Live lane context for the screen-pop inquiry (2018 requirement ①).
  store.for('LaneState').create({
    id: IDS.laneExit,
    lane: { id: IDS.laneExit, className: 'VehicularAccess' },
    currentTicket: {
      ticketNumber: 'T-1001',
      session: { id: IDS.session, className: 'Session' },
      issuedTime: '2026-07-11T08:00:00Z',
      amountDue: { type: 'USD', value: 9.0 },
      paidInFull: false,
      validations: [],
      lpr: {
        plate: 'SYN-1234',
        confidence: 0.97,
        observation: { id: IDS.observation, className: 'Observation' },
        imageLink: 'https://sandbox.invalid/lpr/f2000000.jpg',
      },
    },
    monthlyCredential: {
      credential: { id: 'e3000000-0000-4000-8000-000000000001', className: 'Credential' },
      cardNumber: 'MC-0777',
      accessGranted: false,
      denialReason: 'account past due (synthetic)',
      lastActivity: '2026-07-10T18:22:00Z',
      recentEvents: Array.from({ length: 10 }, (_, i) => ({
        time: `2026-07-${String(10 - (i % 3)).padStart(2, '0')}T0${i % 10}:15:00Z`,
        event: i % 2 === 0 ? 'entry' : 'exit',
        lane: { id: i % 2 === 0 ? IDS.laneEntry : IDS.laneExit, className: 'VehicularAccess' },
      })),
    },
  });

  store.for('Observation').create({
    id: IDS.observation,
    observationDateTime: '2026-07-11T08:00:02Z',
    observationType: 'anpr',
    credentialObservation: {
      credentialType: 'licensePlate',
      credentialIdentification: 'SYN-1234',
      confidence: { value: 0.97 },
    },
    placeRef: { id: IDS.place, className: 'Place' },
  });
}
