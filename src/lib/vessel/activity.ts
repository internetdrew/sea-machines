import type { Coordinate } from './navigation';

export type ActivityKind = 'command' | 'milestone';
export type VesselActivity = Readonly<{
  id: number;
  missionId: number;
  timestamp: number;
  title: string;
  detail: string;
  kind: ActivityKind;
  position: Coordinate;
  speeds?: {
    before: readonly [number, number];
    after: readonly [number, number];
  };
}>;

/** Session-only history. Recording is separate from the throttled telemetry feed. */
export function createActivityStore(limit = 500) {
  let entries: readonly VesselActivity[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => entries,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    record(event: Omit<VesselActivity, 'id' | 'timestamp'>) {
      const entry: VesselActivity = {
        ...event,
        position: [...event.position],
        id: ++sequence,
        timestamp: Date.now(),
      };
      entries = [entry, ...entries].slice(0, limit);
      listeners.forEach(listener => listener());
    },
  };
}
