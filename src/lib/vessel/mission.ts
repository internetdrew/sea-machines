import type { Coordinate } from './navigation';

export type MissionType = 'waypoint' | 'grid';
export type GridDraft = {
  origin: Coordinate | null;
  corners: Coordinate[];
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
    grid: { origin: null, corners: [], spacing: 100, heading: 0 },
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

/** Local tangent-plane rectangle and clipped parallel passes, for demo planning. */
export function buildGridPlan(grid: GridDraft): GridPlan {
  const empty: GridPlan = { boundary: [], route: [], passCount: 0, error: null };
  if (grid.corners.length !== 2) return empty;
  const [a, b] = grid.corners;
  if (![...a, ...b].every(Number.isFinite) || Math.abs(a[1]) > 85 || Math.abs(b[1]) > 85) {
    return { ...empty, error: 'Choose an area between 85° S and 85° N.' };
  }
  const metersPerDegree = Math.PI / 180 * 6371008.8;
  const longitudeScale = metersPerDegree * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
  const deltaLongitude = ((b[0] - a[0] + 540) % 360) - 180;
  const dx = deltaLongitude * longitudeScale;
  const dy = (b[1] - a[1]) * metersPerDegree;
  const xmin = Math.min(0, dx), xmax = Math.max(0, dx);
  const ymin = Math.min(0, dy), ymax = Math.max(0, dy);
  const toCoordinate = (x: number, y: number): Coordinate => [
    ((a[0] + x / longitudeScale + 540) % 360) - 180,
    a[1] + y / metersPerDegree,
  ];
  const rectangle = [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax]];
  const boundary = rectangle.map(([x, y]) => toCoordinate(x, y));
  boundary.push([...boundary[0]]);
  const fail = (error: string): GridPlan => ({ ...empty, boundary, error });
  if (xmax - xmin < 10 || ymax - ymin < 10) return fail('Draw an area at least 10 m wide and 10 m tall.');
  if (xmax - xmin > 20000 || ymax - ymin > 20000) return fail('Keep each side under 20 km for this demo.');
  if (grid.spacing === null || !Number.isFinite(grid.spacing) || grid.spacing < 1) return fail('Enter a pass spacing of at least 1 m.');
  if (grid.heading === null || !Number.isFinite(grid.heading) || grid.heading < 0 || grid.heading >= 360) return fail('Enter a grid heading from 0° to 359°.');
  const angle = grid.heading * Math.PI / 180;
  const ux = Math.sin(angle), uy = Math.cos(angle);
  const vx = Math.cos(angle), vy = -Math.sin(angle);
  const projected = rectangle.map(([x, y]) => x * vx + y * vy);
  const min = Math.min(...projected), max = Math.max(...projected);
  const count = Math.ceil((max - min) / grid.spacing);
  if (count > 200) return fail('Increase pass spacing to keep the grid at 200 passes or fewer.');
  const route: Coordinate[] = [];
  let passCount = 0;
  for (let i = 0; i < count; i++) {
    const offset = min + (i + 0.5) * (max - min) / count;
    const px = vx * offset, py = vy * offset;
    let start = -Infinity, end = Infinity;
    for (const [p, u, lo, hi] of [[px, ux, xmin, xmax], [py, uy, ymin, ymax]]) {
      if (Math.abs(u) < 1e-9) {
        if (p < lo || p > hi) { start = Infinity; break; }
      } else {
        const t1 = (lo - p) / u, t2 = (hi - p) / u;
        start = Math.max(start, Math.min(t1, t2));
        end = Math.min(end, Math.max(t1, t2));
      }
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 1) continue;
    const first = toCoordinate(px + ux * start, py + uy * start);
    const last = toCoordinate(px + ux * end, py + uy * end);
    route.push(...(passCount % 2 ? [last, first] : [first, last]));
    passCount++;
  }
  if (!route.length) return fail('Adjust the area or pass spacing to generate a route.');
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
