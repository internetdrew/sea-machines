import { createContext, useContext } from 'react';
import type { VesselDrawerSizes, VesselDrawerView } from './drawer-layout';

type DrawerState = {
  view: VesselDrawerView;
  sizes: VesselDrawerSizes | null;
  setView: (view: VesselDrawerView) => void;
  setSizes: (sizes: VesselDrawerSizes | null) => void;
};
export const DrawerStateContext = createContext<DrawerState | null>(null);
export const useVesselDrawerState = () => useContext(DrawerStateContext);

