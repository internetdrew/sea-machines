import type { VesselFrame, VesselSimulation } from './simulation';
import { DEMO_PROPULSION } from './propulsion';
import type { PropulsionProfile } from './propulsion';

export type FuelTank = {
  name: string;
  remainingLiters: number;
  capacityLiters: number;
};

export type Vessel = {
  id: string;
  name: string;
  propulsion: PropulsionProfile;
  simulation: VesselSimulation;
  fuelTanks: readonly FuelTank[];
};

// Demo identity and tank readings; telemetry comes from the simulation store.
// Tank count, capacities and remaining liters are illustrative, not published specs.
export const DEMO_VESSEL = {
  id: 'SR-01',
  name: 'STORMRUNNER',
  propulsion: DEMO_PROPULSION,
  fuelTanks: [
    { name: 'Port', remainingLiters: 210, capacityLiters: 250 },
    { name: 'Starboard', remainingLiters: 60, capacityLiters: 250 },
  ],
};

export function getVesselActivity(frame: VesselFrame) {
  if (frame.phase === 'aborted') return { label: 'Aborted', colors: 'bg-neutral-200 text-neutral-700' };
  if (frame.arrived) return { label: 'Complete', colors: 'bg-emerald-100 text-emerald-800' };
  return frame.playing
    ? { label: 'Active', colors: 'bg-emerald-100 text-emerald-800' }
    : frame.mission && !frame.arrived
      ? { label: 'Paused', colors: 'bg-amber-100 text-amber-800' }
      : { label: 'Idle', colors: 'bg-neutral-200 text-neutral-700' };
}

export function isMissionInProgress(frame: VesselFrame) {
  return frame.mission !== null && frame.phase !== 'complete' && frame.phase !== 'aborted';
}

export function getMissionPhaseLabel(frame: VesselFrame) {
  if (frame.phase === 'aborted') return 'Mission aborted';
  if (frame.phase === 'complete') return 'Mission complete';
  if (!frame.playing) return frame.phase === 'transit' ? 'Transit paused' : 'Mission paused';
  return frame.phase === 'transit' ? null : 'Following mission route';
}
