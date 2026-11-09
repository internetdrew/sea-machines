import type { VesselFrame, VesselSimulation } from './simulation';
import type { PropulsionProfile } from './propulsion';
import type { Coordinate } from './navigation';

export type FuelTank = {
  name: string;
  remainingLiters: number;
  capacityLiters: number;
};

export type VesselSeries = {
  id: 'stormrunner' | 'selkie';
  label: string;
  silhouette: 'stormrunner' | 'selkie';
  propulsion: PropulsionProfile;
  publishedRange: { nauticalMiles: number; qualifier: 'at-least' | 'nominal' };
};

export type VesselDefinition = {
  /** Operator-assigned fleet ID; never inferred from series or radio identity. */
  id: string;
  radioCallSign?: string;
  name?: string;
  series: VesselSeries;
  initialPosition: Coordinate;
  initialHeading: number;
  // Illustrative initial readings, not manufacturer tank specifications.
  initialFuelTanks: readonly FuelTank[];
};

export type Vessel = VesselDefinition & {
  propulsion: PropulsionProfile;
  simulation: VesselSimulation;
  fuelTanks: readonly FuelTank[];
};

export function getVesselDisplayName(vessel: Pick<VesselDefinition, 'name' | 'series'>) {
  return vessel.name?.trim() || vessel.series.label;
}

export function getVesselIdentity(vessel: Pick<VesselDefinition, 'id' | 'name' | 'series'>) {
  return `${vessel.id} · ${getVesselDisplayName(vessel)}`;
}

export function getVesselActivity(frame: VesselFrame) {
  if (!isMissionInProgress(frame))
    return { label: 'Idle', colors: 'bg-neutral-200 text-neutral-700' };
  return frame.playing
    ? { label: 'Active', colors: 'bg-emerald-100 text-emerald-800' }
    : frame.mission && !frame.arrived
      ? { label: 'Paused', colors: 'bg-amber-100 text-amber-800' }
      : { label: 'Idle', colors: 'bg-neutral-200 text-neutral-700' };
}

export function isMissionInProgress(frame: VesselFrame) {
  return (
    frame.mission !== null &&
    frame.phase !== 'complete' &&
    frame.phase !== 'aborted'
  );
}

export function getMissionPhaseLabel(frame: VesselFrame) {
  if (frame.phase === 'aborted') return 'Mission aborted';
  if (frame.phase === 'complete') return 'Mission complete';
  if (!frame.playing)
    return frame.phase === 'transit' ? 'Transit paused' : 'Mission paused';
  return frame.phase === 'transit' ? null : 'Following mission route';
}
