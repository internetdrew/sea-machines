import type { Vessel } from './vessel';
import type { VesselFrame } from './simulation';

/** Cache snapshots for React while subscribing independently to each vessel. */
export function createFleetStore(vessels: readonly Pick<Vessel, 'id' | 'simulation'>[]) {
  let cached: readonly VesselFrame[] = [];
  return {
    getSnapshot() {
      const next = vessels.map(vessel => vessel.simulation.getSnapshot());
      if (next.length !== cached.length || next.some((frame, index) => frame !== cached[index])) cached = next;
      return cached;
    },
    subscribe(listener: () => void) {
      const cleanups = vessels.map(vessel => vessel.simulation.subscribe(listener));
      return () => cleanups.forEach(cleanup => cleanup());
    },
  };
}
