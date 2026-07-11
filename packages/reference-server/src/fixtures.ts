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
