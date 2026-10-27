import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMissionDraft, addMissionWaypoint, missionDistance, distanceNm, canReviewMission, buildGridPlan, missionCoordinates, missionSpeedError, routeDirection } from '../src/lib/vessel/mission.ts';

test('distances use nautical miles and the short path across the antimeridian', () => {
  const degree = distanceNm([0, 0], [1, 0]);
  assert.ok(Math.abs(degree - 60.0405) < 0.001);
  assert.ok(Math.abs(distanceNm([179.5, 0], [-179.5, 0]) - degree) < 1e-8);
  assert.equal(distanceNm([0, 0], [0, 0]), 0);
});

test('route arrows follow leg order and take the short path across the dateline', () => {
  for (const [to, heading] of [[[0, 1], 0], [[1, 0], 90], [[0, -1], 180], [[-1, 0], 270]]) {
    assert.equal(routeDirection([0, 0], to).heading, heading);
  }
  const dateline = routeDirection([179, 0], [-179, 0]);
  assert.deepEqual(dateline.coordinate, [-180, 0]);
  assert.equal(dateline.heading, 90);
  const grid = { origin: [0.01, 0.01], center: [0, 0], width: 100, height: 200, spacing: 10, heading: 0 };
  const plan = buildGridPlan(grid);
  assert.ok(distanceNm(grid.origin, plan.route[0]) <= distanceNm(grid.origin, plan.route.at(-1)));
  for (let i = 0; i < plan.route.length - 2; i += 2) {
    const heading = routeDirection(plan.route[i], plan.route[i + 1]).heading;
    const next = routeDirection(plan.route[i + 2], plan.route[i + 3]).heading;
    assert.equal(Math.abs(next - heading), 180);
  }
});

test('drafts pin their origin and copy coordinates so moving telemetry cannot move a planned route', () => {
  const position = [0, 0], point = [1, 0];
  const empty = createMissionDraft(12);
  const first = addMissionWaypoint(empty, position, point);
  position[0] = 20;
  point[0] = 30;
  assert.deepEqual(first.origin, [0, 0]);
  assert.deepEqual(first.waypoints, [[1, 0]]);
  assert.deepEqual(empty.waypoints, []);
  const second = addMissionWaypoint(first, position, [1, 1]);
  assert.deepEqual(second.origin, [0, 0]);
  assert.ok(Math.abs(missionDistance(second) - 120.081) < 0.002);
});

test('empty routes, duplicate points, invalid coordinates and invalid speeds cannot produce reviewable missions', () => {
  const draft = createMissionDraft(12);
  assert.equal(canReviewMission(draft), false);
  for (const point of [[0, 0], [NaN, 1], [0, 91]]) {
    assert.equal(addMissionWaypoint(draft, [0, 0], point), draft);
  }
  const valid = addMissionWaypoint(draft, [0, 0], [1, 0]);
  assert.equal(canReviewMission(valid), true);
  assert.equal(addMissionWaypoint(valid, [0, 0], [1, 0]), valid);
  for (const speed of [0, -1, NaN, Infinity]) {
    assert.equal(canReviewMission({ ...valid, speed }), false);
  }
});


test('grid dimensions, spacing, and alternating passes rotate together around their center', () => {
  const grid = { origin: null, center: [-70, 42], width: 100, height: 200, spacing: 10, heading: 0 };
  const north = buildGridPlan(grid);
  assert.equal(north.error, null);
  assert.equal(north.passCount, 10);
  assert.equal(north.route.length, north.passCount * 2);
  assert.equal(north.boundary.length, 5);
  assert.ok(Math.abs(distanceNm(north.boundary[0], north.boundary[1]) * 1852 - grid.width) < 0.01);
  assert.ok(Math.abs(distanceNm(north.boundary[1], north.boundary[2]) * 1852 - grid.height) < 0.01);
  assert.ok(Math.abs(distanceNm(north.route[1], north.route[2]) * 1852 - grid.spacing) < 0.01);
  for (let i = 2; i < north.route.length; i += 2) {
    const previousDirection = Math.sign(north.route[i - 1][1] - north.route[i - 2][1]);
    const direction = Math.sign(north.route[i + 1][1] - north.route[i][1]);
    assert.equal(direction, -previousDirection);
  }
  const metersPerDegree = Math.PI / 180 * 6371008.8;
  for (const heading of [0, 45, 90, 359]) {
    const rotated = buildGridPlan({ ...grid, heading });
    assert.equal(rotated.error, null);
    assert.equal(rotated.passCount, north.passCount);
    if (heading) {
      assert.notDeepEqual(rotated.route, north.route);
      assert.notDeepEqual(rotated.boundary, north.boundary);
    }
    const angle = heading * Math.PI / 180;
    for (const [lon, lat] of [...rotated.route, ...rotated.boundary]) {
      const east = (lon - grid.center[0]) * metersPerDegree * Math.cos(grid.center[1] * Math.PI / 180);
      const northing = (lat - grid.center[1]) * metersPerDegree;
      const x = east * Math.cos(angle) - northing * Math.sin(angle);
      const y = east * Math.sin(angle) + northing * Math.cos(angle);
      assert.ok(Math.abs(x) <= grid.width / 2 + 1e-6);
      assert.ok(Math.abs(y) <= grid.height / 2 + 1e-6);
    }
  }
  assert.equal(buildGridPlan({ ...grid, spacing: 20 }).passCount, 5);
  assert.equal(buildGridPlan({ ...grid, spacing: 200 }).passCount, 1);
  assert.equal(buildGridPlan({ ...grid, width: 200 }).passCount, 20);
  assert.ok(Math.abs(distanceNm(...buildGridPlan({ ...grid, height: 400 }).route.slice(0, 2)) * 1852 - 400) < 0.01);
});

test('invalid or excessive grid generation is rejected before review', () => {
  const draft = createMissionDraft(12);
  const grid = { origin: [0, 0], center: [0.01, 0.01], width: 100, height: 100, spacing: 10, heading: 0 };
  for (const change of [{ spacing: null }, { spacing: 0 }, { width: 1000, spacing: 1 }, { heading: 360 }, { heading: null }, { width: 1 }, { height: null }, { width: Infinity }, { height: 20001 }, { center: [NaN, 0] }, { center: [0, 86] }]) {
    const invalidGrid = { ...grid, ...change };
    assert.ok(buildGridPlan(invalidGrid).error);
    assert.equal(canReviewMission({ ...draft, type: 'grid', grid: invalidGrid }), false);
  }
  assert.deepEqual(buildGridPlan({ ...grid, center: null }).route, []);
  assert.equal(canReviewMission({ ...draft, type: 'grid', grid: { ...grid, center: null } }), false);
  assert.equal(canReviewMission({ ...draft, type: 'grid', grid }), true);
  const dateline = buildGridPlan({ ...grid, center: [179.9999, 0] });
  assert.equal(dateline.error, null);
  assert.ok(dateline.boundary.every(([lon]) => lon >= -180 && lon < 180));
});

test('turn-speed validation applies to both mission types and switching retains each geometry', () => {
  const waypoint = addMissionWaypoint(createMissionDraft(12), [0, 0], [0.01, 0]);
  const grid = { origin: [0, 0], center: [0.01, 0.01], width: 100, height: 100, spacing: 10, heading: 90 };
  const combined = { ...waypoint, grid };
  assert.deepEqual(missionCoordinates(combined), [[0, 0], [0.01, 0]]);
  const activeGrid = { ...combined, type: 'grid' };
  assert.ok(missionCoordinates(activeGrid).length > 3);
  assert.deepEqual(missionCoordinates({ ...activeGrid, type: 'waypoint' }), missionCoordinates(waypoint));
  for (const type of ['waypoint', 'grid']) {
    for (const turnSpeed of [null, 0, -1, 13, Infinity]) {
      const invalid = { ...combined, type, turnSpeed };
      assert.ok(missionSpeedError(invalid));
      assert.equal(canReviewMission(invalid), false);
    }
    assert.equal(canReviewMission({ ...combined, type, turnSpeed: 12 }), true);
  }
});
