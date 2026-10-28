import { bearingBetween, destinationFrom, INITIAL_CENTER, INITIAL_HEADING } from './navigation.ts';
import type { Coordinate } from './navigation.ts';
import { createDeployment, distanceNm } from './mission.ts';
import type { DeployedMission, MissionDraft } from './mission.ts';
import { DEMO_PROPULSION, propulsionForces } from './propulsion.ts';
import type { PropulsionProfile } from './propulsion.ts';

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
const ARRIVAL_EPSILON = 1e-12; // nautical miles; keep the final speed ramp intact
const INTEGRATION_STEP = 1 / 30;
type Leg = { from: Coordinate; to: Coordinate; length: number; heading: number; entryTurn: number; exitTurn: number };
type SpeedZone = { start: number; end: number; limit: number; exitSpeed: number };

// One clock drives position, heading, trails, and camera. React snapshots stay at 4 Hz.
export function createVesselSimulation(clock: FrameClock = browserClock, propulsion: PropulsionProfile = DEMO_PROPULSION) {
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
  let cruiseSpeed = Math.min(propulsion.cruiseSpeed, propulsion.maxSpeed);
  let turnSpeed = 4;
  let actualSpeed = 0;
  let throttle = 0;
  let speedZones: SpeedZone[] = [];
  let zoneIndex = 0;
  let multiplier = 1;
  let visible = false;
  let pending: number | null = null;
  let lastTime = 0;
  let lastPublished = 0;
  let lastTrackDistance = 0;
  let track: readonly Coordinate[] = [[...position]];
  const frameListeners = new Set<(frame: VesselFrame) => void>();
  const snapshotListeners = new Set<() => void>();

  function rebuildSpeedZones() {
    speedZones = [];
    let start = 0;
    for (const leg of legs) {
      for (const [end, limit] of [
        [start + leg.entryTurn, turnSpeed],
        [start + leg.length - leg.exitTurn, cruiseSpeed],
        [start + leg.length, turnSpeed],
      ]) {
        const zoneStart = speedZones.at(-1)?.end ?? 0;
        if (end > zoneStart + EPSILON) speedZones.push({ start: zoneStart, end, limit, exitSpeed: 0 });
      }
      start += leg.length;
    }
    // Work backwards so even short connectors brake for the next turn or stop.
    for (let i = speedZones.length - 2; i >= 0; i--) {
      const next = speedZones[i + 1];
      speedZones[i].exitSpeed = Math.min(next.limit,
        Math.sqrt(next.exitSpeed ** 2 + 7200 * propulsion.braking * (next.end - next.start)));
    }
    zoneIndex = 0;
    while (speedZones[zoneIndex] && speedZones[zoneIndex].end <= distance + EPSILON) zoneIndex++;
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
      arrived, playing, speed: playing ? actualSpeed : 0, cruiseSpeed, multiplier, track,
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
    else { distance = totalDistance; actualSpeed = throttle = 0; playing = false; }
  }
  function tick(now: number) {
    pending = null;
    let seconds = Math.max(0, Math.min((now - lastTime) / 1000, 0.25)) * multiplier;
    lastTime = now;
    while (playing && seconds > EPSILON) {
      const leg = legs[targetIndex];
      if (!leg) { playing = false; break; }
      if (leg.length - legDistance <= ARRIVAL_EPSILON) { finishLeg(); continue; }
      while (speedZones[zoneIndex]?.end <= distance + ARRIVAL_EPSILON) zoneIndex++;
      const zone = speedZones[zoneIndex];
      if (!zone) { finishLeg(); continue; }
      let dt = Math.min(seconds, INTEGRATION_STEP);
      if (zone.exitSpeed === 0 && actualSpeed > 0 &&
        zone.end - distance <= actualSpeed ** 2 / (7200 * propulsion.braking) + EPSILON) {
        // End the final braking step at zero velocity, not beyond it.
        dt = Math.min(dt, actualSpeed / propulsion.braking);
      }
      const available = Math.min(zone.end - distance, leg.length - legDistance);
      // Solve the braking envelope at the END of this step, including the
      // distance covered while changing speed. This avoids braking too late.
      const brakingTerm = Math.max(0,
        zone.exitSpeed ** 2 + 7200 * propulsion.braking * (zone.end - distance) - propulsion.braking * dt * actualSpeed);
      const safeSpeed = (Math.sqrt((propulsion.braking * dt) ** 2 + 4 * brakingTerm) - propulsion.braking * dt) / 2;
      const { thrust, drag } = propulsionForces(actualSpeed, propulsion);
      const target = Math.min(zone.limit, safeSpeed);
      const stoppingDistance = Math.max(0, (actualSpeed ** 2 - zone.exitSpeed ** 2) / (7200 * propulsion.braking));
      const coasting = stoppingDistance > 0 && zone.end - distance < stoppingDistance * 1.5;
      const slowingToCommand = actualSpeed > zone.limit + EPSILON;
      // Feed-forward balances drag at cruise; speed error requests extra push.
      // Cutting throttle lets the hull coast unless the stopping envelope
      // requires active braking. Engine response builds over simulated time.
      const requestedThrottle = coasting || slowingToCommand ? 0
        : Math.max(0, Math.min(1, (drag + 1.8 * (target - actualSpeed)) / thrust));
      const decay = Math.exp(-dt / propulsion.throttleResponseSeconds);
      const averageThrottle = requestedThrottle + (throttle - requestedThrottle)
        * propulsion.throttleResponseSeconds / dt * (1 - decay);
      const poweredSpeed = slowingToCommand
        ? Math.max(zone.limit, actualSpeed - propulsion.braking * dt)
        : actualSpeed + (averageThrottle * thrust - drag) * dt;
      const nextSpeed = Math.max(0, actualSpeed - propulsion.braking * dt,
        Math.min(poweredSpeed, safeSpeed, actualSpeed <= zone.limit ? zone.limit : propulsion.maxSpeed));
      const acceleration = (nextSpeed - actualSpeed) / dt;
      const proposed = (actualSpeed + nextSpeed) / 2 * dt / 3600;
      const traveled = Math.min(available, proposed);
      // Preserve unused time when a step crosses a waypoint or speed zone.
      const elapsed = proposed > available && proposed > 0
        ? 7200 * available / (actualSpeed + Math.sqrt(Math.max(0, actualSpeed ** 2 + 7200 * acceleration * available)))
        : dt;
      actualSpeed = Math.max(0, actualSpeed + acceleration * elapsed);
      throttle = requestedThrottle + (throttle - requestedThrottle) * Math.exp(-elapsed / propulsion.throttleResponseSeconds);
      seconds -= elapsed;
      legDistance += traveled;
      distance += traveled;
      heading = leg.heading;
      position = destinationFrom(leg.from, heading, legDistance);
      if (leg.length - legDistance <= ARRIVAL_EPSILON) finishLeg();
      else if (distance - lastTrackDistance >= 0.01) sampleTrack();
    }
    emit();
    if (now - lastPublished >= 250 || !playing) publish();
    if (playing && visible) pending = clock.request(tick);
  }

  return {
    maxSpeed: propulsion.maxSpeed,
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
      const next = createDeployment(draft, position, propulsion.maxSpeed);
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
      actualSpeed = throttle = 0;
      rebuildSpeedZones();
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
      actualSpeed = throttle = 0;
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
      cruiseSpeed = Math.min(value, propulsion.maxSpeed);
      turnSpeed = Math.min(turnSpeed, cruiseSpeed);
      rebuildSpeedZones();
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
      actualSpeed = throttle = 0;
      speedZones = [];
      zoneIndex = 0;
      legDistance = distance = totalDistance = lastTrackDistance = 0;
      position = [...INITIAL_CENTER];
      heading = INITIAL_HEADING;
      track = [[...position]];
      command();
    },
  };
}

export type VesselSimulation = ReturnType<typeof createVesselSimulation>;
