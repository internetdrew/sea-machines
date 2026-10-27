import { bearingBetween, destinationFrom, INITIAL_CENTER, INITIAL_HEADING } from './navigation.ts';
import type { Coordinate } from './navigation.ts';
import { createDeployment, distanceNm } from './mission.ts';
import type { DeployedMission, MissionDraft } from './mission.ts';

export type VesselFrame = Readonly<{
  position: Coordinate;
  heading: number;
  distance: number;
  remaining: number;
  routeRemaining: number;
  nextWaypoint: Coordinate | null;
  targetIndex: number;
  phase: 'idle' | 'transit' | 'mission' | 'complete' | 'aborted';
  mission: DeployedMission | null;
  arrived: boolean;
  playing: boolean;
  speed: number;
  cruiseSpeed: number;
  multiplier: number;
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
const EPSILON = 1e-9;
type Leg = { from: Coordinate; to: Coordinate; length: number; heading: number; entryTurn: number; exitTurn: number };

// One clock drives position, heading, trails, and camera. React snapshots stay at 4 Hz.
export function createVesselSimulation(clock: FrameClock = browserClock) {
  let position: Coordinate = [...INITIAL_CENTER];
  let heading = INITIAL_HEADING;
  let mission: DeployedMission | null = null;
  let legs: Leg[] = [];
  let targetIndex = 0;
  let legDistance = 0;
  let distance = 0;
  let totalDistance = 0;
  let playing = false;
  let aborted = false;
  let cruiseSpeed = 12;
  let turnSpeed = 4;
  let multiplier = 1;
  let visible = false;
  let pending: number | null = null;
  let lastTime = 0;
  let lastPublished = 0;
  let lastTrackDistance = 0;
  let track: readonly Coordinate[] = [[...position]];
  const frameListeners = new Set<(frame: VesselFrame) => void>();
  const snapshotListeners = new Set<() => void>();

  function speedAtLeg() {
    const leg = legs[targetIndex];
    if (!leg) return 0;
    return legDistance < leg.entryTurn - EPSILON || legDistance >= leg.length - leg.exitTurn - EPSILON
      ? turnSpeed : cruiseSpeed;
  }
  function makeFrame(): VesselFrame {
    const leg = legs[targetIndex];
    const arrived = mission !== null && !leg && !aborted;
    return {
      position, heading, distance,
      remaining: leg ? Math.max(0, leg.length - legDistance) : 0,
      routeRemaining: aborted ? 0 : Math.max(0, totalDistance - distance),
      nextWaypoint: leg?.to ?? null,
      targetIndex, mission,
      phase: !mission ? 'idle' : aborted ? 'aborted' : arrived ? 'complete' : targetIndex === 0 ? 'transit' : 'mission',
      arrived, playing, speed: playing ? speedAtLeg() : 0, cruiseSpeed, multiplier, track,
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
  function command() { emit(); publish(); }
  function stopLoop() {
    if (pending !== null) clock.cancel(pending);
    pending = null;
  }
  function startLoop() {
    if (!visible || !playing || pending !== null) return;
    lastTime = clock.now();
    pending = clock.request(tick);
  }
  function sampleTrack() {
    if (distanceNm(track.at(-1)!, position) > EPSILON) track = [...track, [...position]];
    lastTrackDistance = distance;
  }
  function finishLeg() {
    position = [...legs[targetIndex].to];
    sampleTrack(); // Preserve corners so the trail cannot cut across survey passes.
    targetIndex++;
    legDistance = 0;
    while (legs[targetIndex] && legs[targetIndex].length <= EPSILON) targetIndex++;
    if (legs[targetIndex]) heading = legs[targetIndex].heading;
    else { distance = totalDistance; playing = false; }
  }
  function tick(now: number) {
    pending = null;
    let seconds = Math.max(0, Math.min((now - lastTime) / 1000, 0.25)) * multiplier;
    lastTime = now;
    while (playing && seconds > EPSILON) {
      const leg = legs[targetIndex];
      if (!leg) { playing = false; break; }
      if (leg.length - legDistance <= EPSILON) { finishLeg(); continue; }
      // Split time at speed-zone boundaries, retaining elapsed time across short legs.
      const nextBoundary = legDistance < leg.entryTurn - EPSILON ? leg.entryTurn
        : leg.exitTurn > 0 && legDistance < leg.length - leg.exitTurn - EPSILON ? leg.length - leg.exitTurn
          : leg.length;
      const speed = speedAtLeg();
      const available = Math.max(0, nextBoundary - legDistance);
      const traveled = Math.min(available, speed * seconds / 3600);
      seconds -= traveled / speed * 3600;
      legDistance += traveled;
      distance += traveled;
      heading = leg.heading;
      position = destinationFrom(leg.from, heading, legDistance);
      if (leg.length - legDistance <= EPSILON) finishLeg();
      else if (distance - lastTrackDistance >= 0.01) sampleTrack();
    }
    emit();
    if (now - lastPublished >= 250 || !playing) publish();
    if (playing && visible) pending = clock.request(tick);
  }

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
    deploy(draft: MissionDraft) {
      if (mission && !frame.arrived && !aborted) return false;
      const next = createDeployment(draft, position);
      if (!next) return false;
      stopLoop();
      mission = next;
      aborted = false;
      cruiseSpeed = next.speed;
      turnSpeed = next.turnSpeed;
      legs = next.targets.map((to, i) => {
        const from = i ? next.targets[i - 1] : next.origin;
        return { from, to, length: distanceNm(from, to), heading: bearingBetween(from, to), entryTurn: 0, exitTurn: 0 };
      });
      for (let i = 0; i < legs.length - 1; i++) {
        const leg = legs[i], after = legs[i + 1];
        const turn = Math.abs(((after.heading - leg.heading + 540) % 360) - 180);
        if (turn > 5 && leg.length > EPSILON && after.length > EPSILON) {
          const zone = Math.min(10 / 1852, leg.length / 4, after.length / 4);
          leg.exitTurn = zone;
          after.entryTurn = zone;
        }
      }
      totalDistance = legs.reduce((sum, leg) => sum + leg.length, 0);
      targetIndex = 0;
      while (legs[targetIndex]?.length <= EPSILON) targetIndex++;
      legDistance = distance = lastTrackDistance = 0;
      track = [[...position]];
      heading = legs[targetIndex].heading;
      playing = true;
      command();
      startLoop();
      return true;
    },
    setPlaying(value: boolean) {
      playing = value && mission !== null && !aborted && targetIndex < legs.length;
      if (playing) startLoop(); else stopLoop();
      command();
    },
    abort() {
      if (!mission || frame.arrived || aborted) return false;
      stopLoop();
      playing = false;
      aborted = true;
      legs = [];
      sampleTrack();
      command();
      return true;
    },
    clearFinishedMission() {
      if (!mission || (!frame.arrived && !aborted)) return false;
      mission = null;
      legs = [];
      aborted = false;
      targetIndex = 0;
      legDistance = distance = totalDistance = lastTrackDistance = 0;
      command();
      return true;
    },
    setSpeed(value: number) {
      if (!Number.isFinite(value) || value <= 0) return;
      cruiseSpeed = value;
      turnSpeed = Math.min(turnSpeed, value);
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
      aborted = false;
      mission = null;
      legs = [];
      targetIndex = 0;
      legDistance = distance = totalDistance = lastTrackDistance = 0;
      position = [...INITIAL_CENTER];
      heading = INITIAL_HEADING;
      track = [[...position]];
      command();
    },
  };
}

export type VesselSimulation = ReturnType<typeof createVesselSimulation>;
