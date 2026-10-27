import type { Coordinate } from './navigation';

export type MissionType = 'waypoint' | 'grid';
export type GridDraft = {
  origin: Coordinate | null;
  center: Coordinate | null;
  width: number | null;
  height: number | null;
  spacing: number | null;
  heading: number | null;
};

export type MissionDraft = {
  type: MissionType;
  origin: Coordinate | null;
  waypoints: Coordinate[];
  speed: number | null;
  turnSpeed: number | null;
  grid: GridDraft;
  saved: boolean;
};

export function createMissionDraft(speed: number): MissionDraft {
  return {
    type: 'waypoint', origin: null, waypoints: [], speed,
    turnSpeed: Math.min(4, speed),
    grid: { origin: null, center: null, width: 100, height: 100, spacing: 10, heading: 0 },
    saved: false,
  };
}

export function distanceNm(from: Coordinate, to: Coordinate) {
  const rad = Math.PI / 180;
  const a = Math.sin((to[1] - from[1]) * rad / 2) ** 2 +
    Math.cos(from[1] * rad) * Math.cos(to[1] * rad) *
    Math.sin((to[0] - from[0]) * rad / 2) ** 2;
  return 6371008.8 / 1852 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

/** A direction cue at the midpoint of a route leg, with a north-based bearing. */
export function routeDirection(from: Coordinate, to: Coordinate) {
  const rad = Math.PI / 180;
  const deltaLongitude = ((to[0] - from[0] + 540) % 360) - 180;
  const latitude = from[1] * rad, targetLatitude = to[1] * rad;
  const heading = (Math.atan2(
    Math.sin(deltaLongitude * rad) * Math.cos(targetLatitude),
    Math.cos(latitude) * Math.sin(targetLatitude) - Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(deltaLongitude * rad),
  ) / rad + 360) % 360;
  const coordinate: Coordinate = [
    ((from[0] + deltaLongitude / 2 + 540) % 360) - 180,
    (from[1] + to[1]) / 2,
  ];
  return { coordinate, heading };
}

export function addMissionWaypoint(draft: MissionDraft, position: Coordinate, point: Coordinate): MissionDraft {
  if (!point.every(Number.isFinite) || Math.abs(point[1]) > 90) return draft;
  const last = draft.waypoints.at(-1) ?? draft.origin ?? position;
  if (distanceNm(last, point) < 0.001) return draft;
  return {
    ...draft,
    origin: draft.origin ?? [...position],
    waypoints: [...draft.waypoints, [...point]],
    saved: false,
  };
}

export type GridPlan = {
  boundary: Coordinate[];
  route: Coordinate[];
  passCount: number;
  error: string | null;
};

/** Rotate the footprint and alternating survey passes together in a local tangent plane. */
export function buildGridPlan(grid: GridDraft): GridPlan {
  const empty: GridPlan = { boundary: [], route: [], passCount: 0, error: null };
  if (!grid.center) return empty;
  const fail = (error: string): GridPlan => ({ ...empty, error });
  const [longitude, latitude] = grid.center;
  if (![longitude, latitude].every(Number.isFinite) || Math.abs(latitude) > 85) return fail('Place the grid between 85° S and 85° N.');
  if (grid.width === null || !Number.isFinite(grid.width) || grid.width < 10 || grid.width > 20000) return fail('Enter a grid width between 10 m and 20 km.');
  if (grid.height === null || !Number.isFinite(grid.height) || grid.height < 10 || grid.height > 20000) return fail('Enter a grid height between 10 m and 20 km.');
  if (grid.heading === null || !Number.isFinite(grid.heading) || grid.heading < 0 || grid.heading >= 360) return fail('Enter a grid rotation from 0° to 359°.');
  const metersPerDegree = Math.PI / 180 * 6371008.8;
  const longitudeScale = metersPerDegree * Math.cos(latitude * Math.PI / 180);
  const angle = grid.heading * Math.PI / 180;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  const toCoordinate = (x: number, y: number): Coordinate => [
    ((longitude + (x * cos + y * sin) / longitudeScale + 540) % 360) - 180,
    latitude + (-x * sin + y * cos) / metersPerDegree,
  ];
  const halfWidth = grid.width / 2, halfHeight = grid.height / 2;
  const rectangle = [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]];
  const boundary = rectangle.map(([x, y]) => toCoordinate(x, y));
  boundary.push([...boundary[0]]);
  const failWithBoundary = (error: string): GridPlan => ({ ...empty, boundary, error });
  if (boundary.some(point => Math.abs(point[1]) > 85)) return fail('Keep the entire grid between 85° S and 85° N.');
  if (grid.spacing === null || !Number.isFinite(grid.spacing) || grid.spacing < 1) return failWithBoundary('Enter a pass spacing of at least 1 m.');
  const passCount = Math.ceil(grid.width / grid.spacing);
  if (passCount > 200) return failWithBoundary('Increase pass spacing to keep the grid at 200 passes or fewer.');
  const route: Coordinate[] = [];
  for (let i = 0; i < passCount; i++) {
    const offset = (i - (passCount - 1) / 2) * grid.spacing;
    const first = toCoordinate(offset, -halfHeight);
    const last = toCoordinate(offset, halfHeight);
    route.push(...(i % 2 ? [last, first] : [first, last]));
  }
  if (grid.origin && distanceNm(grid.origin, route.at(-1)!) < distanceNm(grid.origin, route[0])) route.reverse();
  return { boundary, route, passCount, error: null };
}

export function missionCoordinates(draft: MissionDraft): Coordinate[] {
  if (draft.type === 'waypoint') return draft.origin ? [draft.origin, ...draft.waypoints] : [];
  const plan = buildGridPlan(draft.grid);
  return !plan.error && draft.grid.origin && plan.route.length ? [draft.grid.origin, ...plan.route] : [];
}

export function missionDistance(draft: MissionDraft) {
  const coordinates = missionCoordinates(draft);
  let distance = 0;
  for (let i = 1; i < coordinates.length; i++) distance += distanceNm(coordinates[i - 1], coordinates[i]);
  return distance;
}

export function missionSpeedError(draft: MissionDraft): string | null {
  if (draft.speed === null || !Number.isFinite(draft.speed) || draft.speed <= 0) return 'Enter a straight-line speed greater than 0 kn.';
  if (draft.turnSpeed === null || !Number.isFinite(draft.turnSpeed) || draft.turnSpeed <= 0) return 'Enter a turn speed greater than 0 kn.';
  if (draft.turnSpeed > draft.speed) return 'Turn speed must not exceed straight-line speed.';
  return null;
}

export function canReviewMission(draft: MissionDraft) {
  return !missionSpeedError(draft) && missionCoordinates(draft).length > 1 && missionDistance(draft) > 0;
}
