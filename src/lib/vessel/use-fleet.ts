import { useEffect, useState } from 'react';
import { createVesselSimulation } from './simulation';
import type { Vessel, VesselDefinition } from './vessel';

export function useFleet(definitions: readonly VesselDefinition[]) {
  const [vessels] = useState<readonly Vessel[]>(() =>
    definitions.map(definition => ({
      ...definition,
      propulsion: definition.series.propulsion,
      fuelTanks: definition.initialFuelTanks.map(tank => ({ ...tank })),
      simulation: createVesselSimulation(
        undefined,
        definition.series.propulsion,
        definition.initialPosition,
        definition.initialHeading,
      ),
    })),
  );
  useEffect(() => {
    const syncVisibility = () =>
      vessels.forEach(vessel => vessel.simulation.setVisible(!document.hidden));
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      vessels.forEach(vessel => vessel.simulation.setVisible(false));
    };
  }, [vessels]);
  return vessels;
}
