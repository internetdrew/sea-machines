import { useState } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { Popover } from '@base-ui/react/popover';
import type { VesselDrawerSizes, VesselDrawerView } from '@/lib/vessel/drawer-layout';
import { DrawerStateContext } from '@/lib/vessel/drawer-context';


type Props = { mobile: boolean; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; };

export function VesselActionsRoot({ mobile, ...props }: Props) {
  return mobile ? <MobileRoot {...props} /> : <Popover.Root {...props} />;
}

function MobileRoot(props: Omit<Props, 'mobile'>) {
  const [view, setView] = useState<VesselDrawerView>('summary');
  const [sizes, setSizes] = useState<VesselDrawerSizes | null>(null);
  const snapPoints = sizes ? [sizes.compact, sizes.summary, 1] : [0.25, 0.5, 1];
  const snapPoint = view === 'full' ? 1 : sizes?.[view] ?? (view === 'compact' ? 0.25 : 0.5);
  return (
    <DrawerStateContext.Provider value={{ view, sizes, setView, setSizes }}>
      <Drawer.Root {...props} modal={false} disablePointerDismissal snapToSequentialPoints
        snapPoints={snapPoints} snapPoint={snapPoint}
        onSnapPointChange={point => {
          if (point === 1) setView('full');
          else if (point === snapPoints[0]) setView('compact');
          else if (point === snapPoints[1]) setView('summary');
        }}
        onOpenChangeComplete={open => {
          if (!open) { setView('summary'); setSizes(null); }
        }}
      />
    </DrawerStateContext.Provider>
  );
}
