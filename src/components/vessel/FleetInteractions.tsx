import { useState } from 'react';
import { FleetInteractions, useFleetInteraction } from '@/lib/vessel/use-interactions';
import type { ReactNode } from 'react';
import { createFleetInteractionStore } from '@/lib/vessel/interactions';

export function FleetInteractionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createFleetInteractionStore);
  return <FleetInteractions value={store}>{children}</FleetInteractions>;
}

export function FleetSelectionStatus() {
  const announcement = useFleetInteraction(state => state.announcement);
  return <p id='vessel-selection-status' role='status' aria-live='polite' aria-atomic='true' className='sr-only'>{announcement}</p>;
}
