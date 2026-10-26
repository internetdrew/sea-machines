import { destination, headingToWaypoint, ROUTE_DISTANCE_NM } from './navigation.ts';
import type { Coordinate } from './navigation.ts';

export type VesselFrame = Readonly<{
  position: Coordinate;
  heading: number;
  distance: number;
  remaining: number;
  arrived: boolean;
  playing: boolean;
  speed: number;
  multiplier: number;
  // Sampled voyage history. The renderer supplies the live segment to the boat.
  track: readonly Coordinate[];
}>;

export type FrameClock = {
  now: () => number;
  request: (callback: (now: number) => void) => number;
  cancel: (id: number) => void;
};

const browserClock: FrameClock = {
  now: () => performance.now(),
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
};

// One clock and one authoritative frame for every position-dependent visual.
// React reads a separate cached snapshot, published at most every 250ms.
export function createVesselSimulation(clock: FrameClock = browserClock) {
  let distance = 0;
  let playing = false;
  let speed = 12;
  let multiplier = 10;
  let visible = false;
  let pending: number | null = null;
  let lastTime = 0;
  let lastPublished = 0;
  let lastTrackDistance = 0;
  let track: readonly Coordinate[] = [destination(0)];
  const frameListeners = new Set<(frame: VesselFrame) => void>();
  const snapshotListeners = new Set<() => void>();

  function makeFrame(): VesselFrame {
    const position = destination(distance);
    return {
      position, heading: headingToWaypoint(position), distance,
      remaining: Math.max(0, ROUTE_DISTANCE_NM - distance),
      arrived: distance >= ROUTE_DISTANCE_NM,
      playing, speed, multiplier, track,
    };
  }
  let frame = makeFrame();
  let snapshot = frame;

  function publish() {
    snapshot = frame;
    lastPublished = clock.now();
    for (const listener of snapshotListeners) listener();
  }
  function emit() {
    frame = makeFrame();
    for (const listener of frameListeners) listener(frame);
  }
  function stopLoop() {
    if (pending !== null) clock.cancel(pending);
    pending = null;
  }
  function startLoop() {
    if (!visible || !playing || pending !== null) return;
    lastTime = clock.now();
    pending = clock.request(tick);
  }
  function tick(now: number) {
    pending = null;
    const elapsed = Math.max(0, Math.min((now - lastTime) / 1000, 0.25));
    lastTime = now;
    distance = Math.min(ROUTE_DISTANCE_NM, distance + speed * multiplier * elapsed / 3600);
    const arrived = distance >= ROUTE_DISTANCE_NM;
    if (distance - lastTrackDistance >= 0.01 || (arrived && distance > lastTrackDistance)) {
      track = [...track, destination(distance)];
      lastTrackDistance = distance;
    }
    if (arrived) playing = false;
    emit();
    if (now - lastPublished >= 250 || arrived) publish();
    if (playing && visible) pending = clock.request(tick);
  }
  function command() { emit(); publish(); }

  return {
    getFrame: () => frame,
    getSnapshot: () => snapshot,
    subscribeFrames(listener: (frame: VesselFrame) => void) {
      frameListeners.add(listener);
      return () => { frameListeners.delete(listener); };
    },
    subscribe(listener: () => void) {
      snapshotListeners.add(listener);
      return () => { snapshotListeners.delete(listener); };
    },
    setPlaying(value: boolean) {
      playing = value && distance < ROUTE_DISTANCE_NM;
      if (playing) startLoop(); else stopLoop();
      command();
    },
    setSpeed(value: number) {
      if (!Number.isFinite(value) || value <= 0) return;
      speed = value;
      command();
    },
    setMultiplier(value: number) {
      if (!Number.isFinite(value) || value <= 0) return;
      multiplier = value;
      command();
    },
    setVisible(value: boolean) {
      visible = value;
      if (visible) startLoop(); else stopLoop();
      command();
    },
    reset() {
      stopLoop();
      playing = false;
      distance = lastTrackDistance = 0;
      track = [destination(0)];
      command();
    },
  };
}

export type VesselSimulation = ReturnType<typeof createVesselSimulation>;
