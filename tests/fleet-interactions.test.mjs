import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFleetInteractionStore,
  selectActiveVesselId,
  selectLockedVesselId,
  selectPlanningVesselId,
} from '../src/lib/vessel/interactions.ts';

function setup() {
  const store = createFleetInteractionStore();
  const dispatch = store.dispatch;
  return { store, dispatch, state: store.getSnapshot };
}

test('switching actions is exclusive and a stale close cannot clear the newer vessel', () => {
  const { dispatch, state } = setup();
  dispatch({ type: 'open-actions', vesselId: 'SR-01' });
  dispatch({ type: 'open-actions', vesselId: 'PV-02' });
  dispatch({ type: 'close-actions', vesselId: 'SR-01' });
  assert.equal(state().popoverVesselId, 'PV-02');
  assert.equal(selectActiveVesselId(state()), 'PV-02');
});

test('planning locks selection until accepted closure or deployment and ignores stale deployment', () => {
  const { dispatch, state } = setup();
  dispatch({ type: 'open-actions', vesselId: 'SR-01' });
  dispatch({ type: 'open-mission', vesselId: 'SR-01', planning: true });
  assert.equal(state().popoverVesselId, null);
  assert.equal(selectPlanningVesselId(state()), 'SR-01');
  dispatch({ type: 'lock-planning', vesselId: 'SR-01' });
  const locked = state();
  dispatch({ type: 'open-actions', vesselId: 'PV-02' });
  dispatch({ type: 'open-mission', vesselId: 'PV-02', planning: true });
  dispatch({ type: 'mission-deployed', vesselId: 'PV-02' });
  assert.equal(state(), locked);
  assert.equal(selectLockedVesselId(state()), 'SR-01');
  assert.match(state().announcement, /locked/);
  dispatch({ type: 'mission-deployed', vesselId: 'SR-01' });
  assert.equal(selectLockedVesselId(state()), null);
  assert.equal(selectPlanningVesselId(state()), null);
  assert.match(state().announcement, /available again/);
  dispatch({ type: 'plan-new-mission', vesselId: 'SR-01' });
  assert.equal(selectPlanningVesselId(state()), 'SR-01');
  dispatch({ type: 'close-mission' });
  assert.equal(state().missionPanel, null);
  assert.equal(selectActiveVesselId(state()), null);
});

test('activity highlighting falls back to mission selection for all vessels and on close', () => {
  const { dispatch, state } = setup();
  dispatch({ type: 'open-mission', vesselId: 'SR-01', planning: false });
  dispatch({ type: 'open-actions', vesselId: 'PV-02' });
  dispatch({ type: 'open-activity', vesselId: 'PV-02' });
  assert.equal(state().popoverVesselId, null);
  assert.equal(selectActiveVesselId(state()), 'PV-02');
  dispatch({ type: 'filter-activity', filter: 'all' });
  assert.equal(selectActiveVesselId(state()), 'SR-01');
  dispatch({ type: 'close-activity' });
  assert.equal(selectActiveVesselId(state()), 'SR-01');
});

test('stores are per app, no-op actions do not notify, unrelated selector values remain stable', () => {
  const { store, dispatch, state } = setup();
  const other = createFleetInteractionStore();
  let notifications = 0;
  const off = store.subscribe(() => notifications++);
  const mission = state().missionPanel;
  dispatch({ type: 'close-actions', vesselId: 'SR-01' });
  assert.equal(notifications, 0);
  dispatch({ type: 'open-actions', vesselId: 'SR-01' });
  dispatch({ type: 'open-actions', vesselId: 'SR-01' });
  assert.equal(notifications, 1);
  assert.equal(state().missionPanel, mission);
  assert.equal(other.getSnapshot().popoverVesselId, null);
  off();
  dispatch({ type: 'close-actions', vesselId: 'SR-01' });
  assert.equal(notifications, 1);
});

test('opening the planner atomically closes other surfaces before any route is chosen', () => {
  const { store, dispatch, state } = setup();
  dispatch({ type: 'open-activity', vesselId: 'PV-02' });
  dispatch({ type: 'open-map-settings' });
  dispatch({ type: 'open-actions', vesselId: 'SR-01' });
  const snapshots = [];
  store.subscribe(() => snapshots.push(state()));
  dispatch({ type: 'open-mission', vesselId: 'SR-01', planning: true });
  assert.equal(snapshots.length, 1);
  assert.equal(state().activityPanel, null);
  assert.equal(state().mapSettingsOpen, false);
  assert.equal(state().popoverVesselId, null);
  assert.equal(
    state().missionPanel.locked,
    false,
    'exclusive even on the type screen',
  );
  assert.equal(selectActiveVesselId(state()), 'SR-01');
  const exclusive = state();
  for (const action of [
    { type: 'open-actions', vesselId: 'PV-02' },
    { type: 'open-actions', vesselId: 'SR-01' },
    { type: 'open-activity', vesselId: 'PV-02' },
    { type: 'open-map-settings' },
    { type: 'open-mission', vesselId: 'PV-02', planning: false },
    { type: 'filter-activity', filter: 'all' },
    { type: 'close-activity' },
  ])
    assert.equal(dispatch(action), false);
  assert.equal(state(), exclusive);
  assert.equal(snapshots.length, 1, 'rejected and stale events do not notify');
  dispatch({ type: 'close-mission' });
  assert.equal(state().activityPanel, null, 'old panels do not reopen');
  assert.equal(dispatch({ type: 'open-activity', vesselId: 'PV-02' }), true);
});

test('planning from mission control is exclusive, while monitoring can coexist with activity', () => {
  const { dispatch, state } = setup();
  dispatch({ type: 'open-mission', vesselId: 'SR-01', planning: false });
  dispatch({ type: 'open-activity', vesselId: 'PV-02' });
  dispatch({ type: 'open-map-settings' });
  assert.ok(state().activityPanel);
  dispatch({ type: 'plan-new-mission', vesselId: 'SR-01' });
  assert.equal(state().activityPanel, null);
  assert.equal(state().mapSettingsOpen, false);
  assert.equal(selectActiveVesselId(state()), 'SR-01');
  dispatch({ type: 'mission-deployed', vesselId: 'SR-01' });
  assert.equal(dispatch({ type: 'open-activity', vesselId: 'PV-02' }), true);
  assert.equal(dispatch({ type: 'open-map-settings' }), true);
});
