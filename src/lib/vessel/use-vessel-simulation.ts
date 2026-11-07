import { useEffect, useState, useSyncExternalStore } from 'react';
import { createVesselSimulation } from './simulation';
import { INITIAL_CENTER, INITIAL_HEADING } from './navigation';
import type { Coordinate } from './navigation';
import type { PropulsionProfile } from './propulsion';

export function useVesselSimulation(
  propulsion: PropulsionProfile,
  initialPosition: Coordinate = INITIAL_CENTER,
  initialHeading = INITIAL_HEADING,
) {
  const [simulation] = useState(() =>
    createVesselSimulation(
      undefined,
      propulsion,
      initialPosition,
      initialHeading,
    ),
  );
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );

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
