import { destinationFrom } from './navigation.ts';
import type { VesselDefinition } from './vessel';
import type { InitialActivity } from './activity';

/** Five historical demo events per vessel. These do not execute or resume a mission. */
export function createDemoActivity(
  vessel: VesselDefinition,
  now = Date.now(),
): InitialActivity[] {
  const position = vessel.initialPosition;
  const origin = destinationFrom(position, 225, 0.6);
  const midpoint = destinationFrom(position, 225, 0.3);
  const event = (
    minutesAgo: number,
    data: Omit<InitialActivity, 'timestamp' | 'missionId'>,
  ): InitialActivity => ({
    ...data,
    missionId: 1,
    timestamp: now - minutesAgo * 60_000,
  });
  if (vessel.series.id === 'stormrunner')
    return [
      event(48, {
        kind: 'command',
        title: 'Grid mission deployed',
        detail: 'Demo coastal survey · 3 passes · straight 12 kn · turns 4 kn',
        position: origin,
      }),
      event(43, {
        kind: 'milestone',
        title: 'Grid pass 1 completed',
        detail: 'First of 3 survey passes completed',
        position: origin,
      }),
      event(38, {
        kind: 'milestone',
        title: 'Grid pass 2 completed',
        detail: 'Second of 3 survey passes completed',
        position: midpoint,
      }),
      event(33, {
        kind: 'milestone',
        title: 'Grid pass 3 completed',
        detail: 'Final survey pass completed',
        position,
      }),
      event(32, {
        kind: 'milestone',
        title: 'Mission completed',
        detail: 'Demo coastal survey completed · 2.4 nm travelled',
        position,
      }),
    ];
  return [
    event(29, {
      kind: 'command',
      title: 'Waypoint mission deployed',
      detail: 'Demo patrol route · 2 waypoints · straight 10 kn · turns 3 kn',
      position: origin,
    }),
    event(25, {
      kind: 'command',
      title: 'Speeds changed',
      detail: 'Straight 10 → 12 kn · turns 3 → 4 kn',
      position: origin,
      speeds: { before: [10, 3], after: [12, 4] },
    }),
    event(22, {
      kind: 'milestone',
      title: 'Waypoint 1 reached',
      detail: 'Continuing to Waypoint 2',
      position: midpoint,
    }),
    event(18, {
      kind: 'milestone',
      title: 'Waypoint 2 reached',
      detail: 'Final waypoint reached',
      position,
    }),
    event(18, {
      kind: 'milestone',
      title: 'Mission completed',
      detail: 'Demo patrol route completed · 0.6 nm travelled',
      position,
    }),
  ];
}
