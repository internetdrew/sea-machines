import { useEffect, useState, useSyncExternalStore } from 'react';
import { createVesselSimulation } from './simulation';

export function useVesselSimulation() {
  const [simulation] = useState(createVesselSimulation);
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
