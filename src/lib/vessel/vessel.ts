import type { VesselFrame, VesselSimulation } from './simulation';

export type FuelTank = {
  name: string;
  remainingLiters: number;
  capacityLiters: number;
};

export type Vessel = {
  id: string;
  name: string;
  simulation: VesselSimulation;
  fuelTanks: readonly FuelTank[];
};

// Demo identity and tank readings; telemetry comes from the simulation store.
export const DEMO_VESSEL = {
  id: 'SR-01',
  name: 'STORMRUNNER',
  fuelTanks: [
    { name: 'Port', remainingLiters: 210, capacityLiters: 250 },
    { name: 'Starboard', remainingLiters: 60, capacityLiters: 250 },
  ],
};

export function getVesselActivity(frame: VesselFrame) {
  return frame.playing
    ? { label: 'Active', colors: 'bg-emerald-100 text-emerald-800' }
    : frame.distance > 0 && !frame.arrived
      ? { label: 'Paused', colors: 'bg-amber-100 text-amber-800' }
      : { label: 'Idle', colors: 'bg-slate-200 text-slate-700' };
}
