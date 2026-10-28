import { STORMRUNNER_SPECIFICATIONS } from './stormrunner.ts';

export type PropulsionProfile = Readonly<{
  cruiseSpeed: number; // default mission speed, knots
  maxSpeed: number; // knots
  thrustAtRest: number; // knots/second at full throttle, effective mass included
  thrustFalloff: number; // fractional reduction at maximum speed
  coastDragAtMaxSpeed: number; // knots/second
  throttleResponseSeconds: number;
  braking: number; // guaranteed net active deceleration, knots/second
}>;

// Maximum speed is published; thrust, drag, throttle lag and braking remain
// illustrative. Neither source publishes acceleration or stopping trial data.
export const DEMO_PROPULSION: PropulsionProfile = Object.freeze({
  cruiseSpeed: STORMRUNNER_SPECIFICATIONS.cruiseSpeed,
  maxSpeed: STORMRUNNER_SPECIFICATIONS.maxSpeed,
  thrustAtRest: 2.4,
  thrustFalloff: 0.55,
  coastDragAtMaxSpeed: 1,
  throttleResponseSeconds: 0.8,
  braking: 0.8,
});

export function propulsionForces(speed: number, profile: PropulsionProfile) {
  const ratio = Math.max(0, Math.min(1, speed / profile.maxSpeed));
  return {
    thrust: profile.thrustAtRest * (1 - profile.thrustFalloff * ratio),
    drag: profile.coastDragAtMaxSpeed * (0.08 * ratio + 0.92 * ratio ** 2),
  };
}
