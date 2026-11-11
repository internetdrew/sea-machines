import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Marker } from 'maplibre-gl';
import { useMap } from '@/components/ui/map';
import { createVesselRenderer } from './renderer';
import type { VesselDisplayOptions } from './renderer';
import { ActiveMissionLayer } from './ActiveMissionLayer';
import { VesselMarker } from './VesselMarker';
import type { VesselActionsProps } from './VesselActionsPopover';
import { useFleetInteraction } from '@/lib/vessel/use-interactions';
import { selectPlanningVesselId } from '@/lib/vessel/interactions';
import type { Vessel } from '@/lib/vessel/vessel';

type Props = VesselDisplayOptions & Pick<VesselActionsProps, 'vessel' | 'missionDrawer' | 'activityDrawer'> & { onPan: () => void };

function LiveMissionLayer({ vessel }: { vessel: Vessel }) {
  const frame = useSyncExternalStore(vessel.simulation.subscribe, vessel.simulation.getSnapshot);
  return <ActiveMissionLayer vesselId={vessel.id} frame={frame} />;
}

export function VesselLayer({ vessel, missionDrawer, activityDrawer, follow, showRangeRings, onPan }: Props) {
  const { map, mapLib, isLoaded } = useMap();
  const { simulation } = vessel;
  const marker = useRef<Marker | null>(null);
  const missionMarker = useRef<Marker | null>(null);
  const renderer = useRef<ReturnType<typeof createVesselRenderer> | null>(null);
  const planningActive = useFleetInteraction(state => selectPlanningVesselId(state) !== null);
  useEffect(() => {
    if (
      !map ||
      !mapLib ||
      !isLoaded ||
      !marker.current ||
      !missionMarker.current
    )
      return;
    const instance = createVesselRenderer(
      map,
      mapLib,
      simulation,
      {
        marker: marker.current,
        missionMarker: missionMarker.current,
      },
      { follow: false, showRangeRings: false },
      onPan,
    );
    renderer.current = instance;
    return () => {
      instance.destroy();
      renderer.current = null;
    };
  }, [map, mapLib, isLoaded, simulation, onPan]);

  useEffect(() => {
    renderer.current?.setOptions({ follow, showRangeRings: showRangeRings && !planningActive });
  }, [map, mapLib, isLoaded, follow, showRangeRings, planningActive]);

  return <>
    <LiveMissionLayer vessel={vessel} />
    <VesselMarker vessel={vessel} missionDrawer={missionDrawer} activityDrawer={activityDrawer} marker={marker} missionMarker={missionMarker} />
  </>;
}
