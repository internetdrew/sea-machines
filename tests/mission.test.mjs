import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMissionDraft, addMissionWaypoint, missionDistance, distanceNm, canReviewMission, buildGridPlan, missionCoordinates, missionSpeedError } from '../src/lib/vessel/mission.ts';

test('distances use nautical miles and the short path across the antimeridian', () => {
  const degree = distanceNm([0, 0], [1, 0]);
  assert.ok(Math.abs(degree - 60.0405) < 0.001);
  assert.ok(Math.abs(distanceNm([179.5, 0], [-179.5, 0]) - degree) < 1e-8);
  assert.equal(distanceNm([0, 0], [0, 0]), 0);
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


test('grid passes stay inside the rectangle, alternate direction, and change with heading/spacing', () => {
  const grid = { origin: [-70, 42], corners: [[-70, 42], [-69.99, 42.01]], spacing: 100, heading: 0 };
  const north = buildGridPlan(grid);
  assert.equal(north.error, null);
  assert.ok(north.passCount > 2);
  assert.equal(north.route.length, north.passCount * 2);
  assert.equal(north.boundary.length, 5);
  for (const [lon, lat] of north.route) {
    assert.ok(lon >= -70 - 1e-9 && lon <= -69.99 + 1e-9);
    assert.ok(lat >= 42 - 1e-9 && lat <= 42.01 + 1e-9);
  }
  for (let i = 2; i < north.route.length; i += 2) {
    const previousDirection = Math.sign(north.route[i - 1][1] - north.route[i - 2][1]);
    const direction = Math.sign(north.route[i + 1][1] - north.route[i][1]);
    assert.equal(direction, -previousDirection);
  }
  const rotated = buildGridPlan({ ...grid, heading: 45 });
  assert.equal(rotated.error, null);
  assert.notDeepEqual(rotated.route, north.route);
  assert.ok(buildGridPlan({ ...grid, spacing: 200 }).passCount < north.passCount);
});

test('invalid or excessive grid generation is rejected before review', () => {
  const draft = createMissionDraft(12);
  const grid = { origin: [0, 0], corners: [[0, 0], [0.01, 0.01]], spacing: 100, heading: 0 };
  for (const change of [{ spacing: null }, { spacing: 0 }, { spacing: 1 }, { heading: 360 }, { heading: null }, { corners: [[0, 0], [0.000001, 0.000001]] }]) {
    const invalidGrid = { ...grid, ...change };
    assert.ok(buildGridPlan(invalidGrid).error);
    assert.equal(canReviewMission({ ...draft, type: 'grid', grid: invalidGrid }), false);
  }
  assert.equal(canReviewMission({ ...draft, type: 'grid', grid }), true);
});

test('turn-speed validation applies to both mission types and switching retains each geometry', () => {
  const waypoint = addMissionWaypoint(createMissionDraft(12), [0, 0], [0.01, 0]);
  const grid = { origin: [0, 0], corners: [[0, 0], [0.01, 0.01]], spacing: 100, heading: 90 };
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
