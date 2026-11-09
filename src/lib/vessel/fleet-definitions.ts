import { DEMO_PROPULSION } from './propulsion.ts';
import {
  INITIAL_CENTER,
  INITIAL_HEADING,
  destinationFrom,
} from './navigation.ts';
import type { VesselDefinition, VesselSeries } from './vessel';

// Speed and range from the manufacturer specification screenshots supplied by
// the user. Range is descriptive, not an estimate of remaining endurance.
// Both series use illustrative acceleration, drag and braking parameters.
export const VESSEL_SERIES = {
  stormrunner: {
    id: 'stormrunner',
    label: 'Stormrunner',
    silhouette: 'stormrunner',
    propulsion: DEMO_PROPULSION,
    publishedRange: { nauticalMiles: 700, qualifier: 'at-least' },
  },
  selkie: {
    id: 'selkie',
    label: 'Selkie',
    silhouette: 'selkie',
    propulsion: { ...DEMO_PROPULSION, cruiseSpeed: 22, maxSpeed: 30 },
    publishedRange: { nauticalMiles: 400, qualifier: 'nominal' },
  },
} as const satisfies Record<string, VesselSeries>;

// IDs are operator-facing demo fleet identifiers, not radio call signs. Individual names remain unassigned.
export const FLEET_DEFINITIONS: readonly VesselDefinition[] = [
  {
    id: 'SR-01',
    series: VESSEL_SERIES.stormrunner,
    initialPosition: [...INITIAL_CENTER],
    initialHeading: INITIAL_HEADING,
    initialFuelTanks: [
      { name: 'Port', remainingLiters: 210, capacityLiters: 250 },
      { name: 'Starboard', remainingLiters: 60, capacityLiters: 250 },
    ],
  },
  {
    id: 'PV-02',
    series: VESSEL_SERIES.selkie,
    initialPosition: destinationFrom(
      destinationFrom(INITIAL_CENTER, 90, 5),
      0,
      1,
    ),
    initialHeading: 270,
    initialFuelTanks: [
      { name: 'Port', remainingLiters: 210, capacityLiters: 250 },
      { name: 'Starboard', remainingLiters: 220, capacityLiters: 250 },
    ],
  },
];
