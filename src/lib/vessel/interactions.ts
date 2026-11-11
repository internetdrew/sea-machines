/** UI coordination only. Drafts, telemetry, DOM refs and camera effects stay in their features. */
export type MissionPanel = Readonly<{
  vesselId: string;
  planning: boolean;
  locked: boolean;
}>;
export type FleetInteractionState = Readonly<{
  popoverVesselId: string | null;
  missionPanel: MissionPanel | null;
  activityPanel: Readonly<{ filter: string }> | null;
  mapSettingsOpen: boolean;
  announcement: string;
}>;
export type FleetInteractionAction =
  | { type: 'open-map-settings' }
  | { type: 'close-map-settings' }
  | { type: 'open-actions'; vesselId: string }
  | { type: 'close-actions'; vesselId: string }
  | { type: 'open-mission'; vesselId: string; planning: boolean }
  | { type: 'close-mission' }
  | { type: 'lock-planning'; vesselId: string }
  | { type: 'mission-deployed'; vesselId: string }
  | { type: 'plan-new-mission'; vesselId: string }
  | { type: 'open-activity'; vesselId: string }
  | { type: 'filter-activity'; filter: string }
  | { type: 'close-activity' };

export const initialFleetInteractionState: FleetInteractionState = {
  popoverVesselId: null,
  missionPanel: null,
  activityPanel: null,
  mapSettingsOpen: false,
  announcement: '',
};

export const selectLockedVesselId = (state: FleetInteractionState) =>
  state.missionPanel?.locked ? state.missionPanel.vesselId : null;
export const selectPlanningVesselId = (state: FleetInteractionState) =>
  state.missionPanel?.planning ? state.missionPanel.vesselId : null;
// Preserve the existing highlight priority. All-vessels activity falls back to the mission/popover.
export const selectActiveVesselId = (state: FleetInteractionState) =>
  (state.activityPanel?.filter !== 'all'
    ? state.activityPanel?.filter
    : null) ??
  state.missionPanel?.vesselId ??
  state.popoverVesselId;

export function reduceFleetInteraction(
  state: FleetInteractionState,
  action: FleetInteractionAction,
): FleetInteractionState {
  // Planning is exclusive from the moment the planner opens, including type selection.
  // Reject competing opens without publishing a new snapshot or notifying subscribers.
  if (
    selectPlanningVesselId(state) &&
    (action.type === 'open-actions' ||
      action.type === 'open-activity' ||
      action.type === 'open-map-settings')
  )
    return state;
  let next = state;
  switch (action.type) {
    case 'open-map-settings':
      if (!state.mapSettingsOpen) next = { ...state, mapSettingsOpen: true };
      break;
    case 'close-map-settings':
      if (state.mapSettingsOpen) next = { ...state, mapSettingsOpen: false };
      break;
    case 'open-actions':
      if (
        !selectLockedVesselId(state) &&
        state.popoverVesselId !== action.vesselId
      )
        next = { ...state, popoverVesselId: action.vesselId };
      break;
    case 'close-actions':
      if (state.popoverVesselId === action.vesselId)
        next = { ...state, popoverVesselId: null };
      break;
    case 'open-mission':
      if (
        selectPlanningVesselId(state) &&
        state.missionPanel?.vesselId !== action.vesselId
      )
        break;
      if (state.missionPanel?.vesselId === action.vesselId) break;
      next = {
        ...state,
        popoverVesselId: null,
        ...(action.planning
          ? { activityPanel: null, mapSettingsOpen: false }
          : {}),
        missionPanel: {
          vesselId: action.vesselId,
          planning: action.planning,
          locked: false,
        },
      };
      break;
    // Dispatch only after the drawer's dismissal guard accepts the close.
    case 'close-mission':
      if (state.missionPanel) next = { ...state, missionPanel: null };
      break;
    case 'lock-planning':
      if (
        state.missionPanel?.vesselId === action.vesselId &&
        state.missionPanel.planning &&
        !state.missionPanel.locked
      )
        next = {
          ...state,
          popoverVesselId: null,
          missionPanel: { ...state.missionPanel, locked: true },
        };
      break;
    case 'mission-deployed':
    case 'plan-new-mission':
      if (state.missionPanel?.vesselId === action.vesselId)
        next = {
          ...state,
          ...(action.type === 'plan-new-mission'
            ? {
                popoverVesselId: null,
                activityPanel: null,
                mapSettingsOpen: false,
              }
            : {}),
          missionPanel: {
            vesselId: action.vesselId,
            planning: action.type === 'plan-new-mission',
            locked: false,
          },
        };
      break;
    case 'open-activity':
      next = {
        ...state,
        popoverVesselId: null,
        activityPanel: { filter: action.vesselId },
      };
      break;
    case 'filter-activity':
      if (state.activityPanel && state.activityPanel.filter !== action.filter)
        next = { ...state, activityPanel: { filter: action.filter } };
      break;
    case 'close-activity':
      if (state.activityPanel) next = { ...state, activityPanel: null };
      break;
  }
  if (
    Boolean(selectPlanningVesselId(next)) !==
    Boolean(selectPlanningVesselId(state))
  ) {
    next = {
      ...next,
      announcement: selectPlanningVesselId(next)
        ? 'Vessel selection is locked while mission planning is open. Close or finish planning to select another vessel.'
        : 'Vessel selection is available again.',
    };
  }
  return next;
}

export function createFleetInteractionStore() {
  let state = initialFleetInteractionState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: FleetInteractionAction) {
      const next = reduceFleetInteraction(state, action);
      if (next === state) return false;
      state = next;
      for (const listener of listeners) listener();
      return true;
    },
  };
}
