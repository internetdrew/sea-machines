import { createContext, useContext, useSyncExternalStore } from 'react';
import type {
  FleetInteractionState,
  createFleetInteractionStore,
} from './interactions';

export const FleetInteractions = createContext<ReturnType<
  typeof createFleetInteractionStore
> | null>(null);

export function useFleetInteractions() {
  const store = useContext(FleetInteractions);
  if (!store)
    throw new Error('Fleet interactions require FleetInteractionProvider');
  return store;
}

/** Select primitives or stable state references; never allocate objects in a selector. */
export function useFleetInteraction<T>(
  selector: (state: FleetInteractionState) => T,
): T {
  const store = useFleetInteractions();
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getSnapshot()),
  );
}
