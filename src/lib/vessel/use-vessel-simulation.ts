import { useEffect, useState, useSyncExternalStore } from 'react';
import { createVesselSimulation } from './simulation';
import type { PropulsionProfile } from './propulsion';

export function useVesselSimulation(propulsion: PropulsionProfile) {
  const [simulation] = useState(() => createVesselSimulation(undefined, propulsion));
  const snapshot = useSyncExternalStore(simulation.subscribe, simulation.getSnapshot);

  useEffect(() => {
    const syncVisibility = () => simulation.setVisible(!document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      simulation.setVisible(false);
    };
  }, [simulation]);

  return { simulation, snapshot };
}
