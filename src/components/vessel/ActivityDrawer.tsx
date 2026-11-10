import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { Select } from '@base-ui/react/select';
import { Collapsible } from '@base-ui/react/collapsible';
import { Check, ChevronDown, X } from 'lucide-react';
import { useMap } from '@/components/ui/map';
import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';
import { DEFAULT_MAP_ZOOM } from '@/lib/vessel/navigation';
import { getVesselIdentity } from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';
import type { VesselActivity } from '@/lib/vessel/activity';

export type ActivityPayload = { vesselId: string; returnFocus: RefObject<HTMLElement | null> };
type Entry = VesselActivity & { vesselId: string };

function Filter({ value, onChange, label, items }: { value: string; onChange: (value: string) => void; label: string; items: { value: string; label: string }[] }) {
  const { map } = useMap();
  return <Select.Root value={value} onValueChange={next => { if (next) onChange(next); }} items={items}>
    <Select.Trigger aria-label={label} className='flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-md border border-white/10 bg-neutral-800 px-3 text-xs text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'>
      <Select.Value /><Select.Icon><ChevronDown className='size-3.5 shrink-0' /></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={map?.getContainer()}><Select.Positioner sideOffset={6} className='z-70'><Select.Popup className='min-w-(--anchor-width) overflow-hidden rounded-md border border-white/10 bg-neutral-800 p-1 text-xs text-neutral-100 shadow-lg'>
      <Select.List>{items.map(item => <Select.Item key={item.value} value={item.value} className='relative flex min-h-9 cursor-default items-center rounded px-3 pr-8 outline-none data-highlighted:bg-white/10'><Select.ItemText>{item.label}</Select.ItemText><Select.ItemIndicator className='absolute right-2'><Check className='size-3.5' /></Select.ItemIndicator></Select.Item>)}</Select.List>
    </Select.Popup></Select.Positioner></Select.Portal>
  </Select.Root>;
}

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
function ActivityEntry({ event, showVessel }: { event: Entry; showVessel: boolean }) {
  const tone = event.title === 'Mission aborted' ? 'text-[#eab3af]' : 'text-neutral-100';
  const [open, setOpen] = useState(false);
  const lat = event.position[1], lon = event.position[0];
  return <Collapsible.Root open={open} onOpenChange={setOpen} className={`mb-2 overflow-hidden rounded-lg ${open ? 'bg-white/5' : ''}`}>
    <Collapsible.Trigger className='flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring' title={`${event.vesselId} · ${event.title}`}>
      {showVessel && <span className='shrink-0 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-neutral-300'>{event.vesselId}</span>}
      <span className={`min-w-0 flex-1 truncate text-xs font-medium ${tone}`}>{event.title}</span>
      <time dateTime={new Date(event.timestamp).toISOString()} className='shrink-0 font-mono text-[10px] text-neutral-400'>{time.format(event.timestamp)}</time>
      <ChevronDown aria-hidden='true' className={`size-3.5 shrink-0 text-neutral-400 ${open ? 'rotate-180' : ''}`} />
    </Collapsible.Trigger>
    <Collapsible.Panel className='activity-event-panel'>
      <div className='border-t border-white/5 bg-neutral-800 p-3 text-[11px] text-neutral-200'>
        {event.speeds ? <div className='mb-3 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 border-b border-white/5 pb-3 tabular-nums'>
          <span className='text-[10px] text-neutral-400'>Setting</span><span className='text-[10px] text-neutral-400'>Previous</span><span className='text-[10px] text-neutral-400'>New</span>
          <span>Straight-line</span><span className='text-neutral-400'>{event.speeds.before[0]} kn</span><span>{event.speeds.after[0]} kn</span>
          <span>Turns</span><span className='text-neutral-400'>{event.speeds.before[1]} kn</span><span>{event.speeds.after[1]} kn</span>
        </div> : <p className='mb-3 leading-relaxed'>{event.detail}</p>}
        <dl className='grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 leading-relaxed'>
          <dt className='text-neutral-400'>Mission</dt><dd>{event.vesselId} / {event.missionId}</dd>
          <dt className='text-neutral-400'>Recorded by</dt><dd>{event.kind === 'command' ? 'Operator action' : 'Simulation'}</dd>
          <dt className='text-neutral-400'>Position</dt><dd className='tabular-nums'>{Math.abs(lat).toFixed(4)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(4)}° {lon >= 0 ? 'E' : 'W'}</dd>
        </dl>
        <p className='mt-3 text-[10px] text-neutral-400'>Event {event.id} · {new Date(event.timestamp).toLocaleString()}</p>
      </div>
    </Collapsible.Panel>
  </Collapsible.Root>;
}

function ActivityBody({ vessels, initialVesselId, open, onSelection }: { vessels: readonly Vessel[]; initialVesselId: string; open: boolean; onSelection: (id: string | null) => void }) {
  const { map } = useMap();
  const [filter, setFilter] = useState(initialVesselId);
  const [kind, setKind] = useState('all');
  const [held, setHeld] = useState<readonly Entry[] | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const subscribe = useCallback((listener: () => void) => {
    const cleanups = vessels.map(v => v.simulation.activity.subscribe(listener));
    return () => cleanups.forEach(cleanup => cleanup());
  }, [vessels]);
  // Stable string snapshot changes only when the event stores append.
  const revision = useCallback(() => vessels.map(v => v.simulation.activity.getSnapshot()[0]?.id ?? 0).join(','), [vessels]);
  useSyncExternalStore(subscribe, revision);
  const live = vessels.flatMap(v => v.simulation.activity.getSnapshot().map(event => ({ ...event, vesselId: v.id }))).sort((a,b) => b.timestamp - a.timestamp || b.id - a.id);
  useEffect(() => {
    if (!open || !map) return;
    onSelection(filter === 'all' ? null : filter);
    const vessel = vessels.find(v => v.id === filter);
    if (!vessel) return;
    const frame = requestAnimationFrame(() => {
      const container = map.getContainer();
      const left = container.querySelector('.activity-drawer-popup')?.getBoundingClientRect().width ?? 384;
      const right = container.querySelector('.mission-drawer-popup')?.getBoundingClientRect().width ?? 0;
      const offset = container.clientWidth < 640 ? 0 : (left - right) / 2;
      map.easeTo({ center: vessel.simulation.getFrame().position, zoom: Math.max(map.getZoom(), DEFAULT_MAP_ZOOM), offset: [offset,0], duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
    });
    return () => cancelAnimationFrame(frame);
  }, [filter, map, open, vessels, onSelection]);
  const visible = (held ?? live).filter(e => (filter === 'all' || e.vesselId === filter) && (kind === 'all' || e.kind === kind));
  const pending = held ? live.filter(e => !held.some(old => old.vesselId === e.vesselId && old.id === e.id)).length : 0;
  return <>
    <header className='shrink-0 px-5 pt-5 pb-4'>
      <Drawer.Description className='mb-2 pr-8 text-xs tracking-wide text-muted-foreground'>{filter === 'all' ? 'All vessels' : getVesselIdentity(vessels.find(v => v.id === filter)!)}</Drawer.Description>
      <Drawer.Title className='pr-8 text-lg font-medium'>Activity log</Drawer.Title>
      <Drawer.Close aria-label='Close activity log' className={`absolute top-5 right-5 ${CLOSE_BUTTON_CLASS}`}><X className='size-4' /></Drawer.Close>
      <p className='mt-3 text-[11px] text-neutral-300'>{held ? 'Feed held · mission unaffected' : '● Live activity'}</p>
    </header>
    <div className='grid shrink-0 grid-cols-2 gap-2 px-5 pb-3'>
      <Filter value={filter} onChange={setFilter} label='Filter activity by vessel' items={[{ value:'all', label:'All vessels' }, ...vessels.map(v => ({ value:v.id, label:v.id }))]} />
      <Filter value={kind} onChange={setKind} label='Filter event type' items={[{ value:'all',label:'All events' },{ value:'command',label:'Commands' },{ value:'milestone',label:'Milestones' }]} />
    </div>
    <div className='flex shrink-0 items-center justify-between px-5 pb-3 text-[10px] text-neutral-400'><span>Local time · newest first</span><button className='min-h-8 cursor-pointer rounded px-1 text-xs text-neutral-300 focus-visible:outline-2 focus-visible:outline-ring' onClick={() => setHeld(held ? null : live)}>{held ? 'Resume feed' : 'Hold feed'}</button></div>
    {pending > 0 && <button className='mx-5 mb-2 min-h-9 rounded-md border border-white/10 bg-neutral-800 text-xs text-neutral-200' onClick={() => { setHeld(null); scroller.current?.scrollTo({top:0}); }}>{pending} new events · Show latest</button>}
    <div ref={scroller} className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3' onScroll={e => { if (!held && e.currentTarget.scrollTop > 20) setHeld(live); }}>
      {visible.length ? visible.map(event => <ActivityEntry key={`${event.vesselId}:${event.id}`} event={event} showVessel={true} />) : <p className='px-2 py-8 text-xs leading-relaxed text-muted-foreground'>No activity {filter === 'all' ? 'yet' : `for ${filter} yet`}. Deployed missions and accepted changes will appear here.</p>}
    </div>
    <span className='sr-only' role='status' aria-live='polite'>{pending > 0 ? `${pending} new activity events available.` : ''}</span>
  </>;
}

export function ActivityDrawer({ handle, vessels, onSelection, onOpen }: { handle: Drawer.Handle<ActivityPayload>; vessels: readonly Vessel[]; onSelection: (id:string|null) => void; onOpen: () => void }) {
  const { map } = useMap();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return <Drawer.Root handle={handle} open={open} onOpenChange={next => { setOpen(next); if (next) { setSession(n=>n+1); onOpen(); } else onSelection(null); }} swipeDirection='left' modal={false} disablePointerDismissal>
    {({ payload }) => <Drawer.Portal container={map?.getContainer()}><Drawer.Viewport className='pointer-events-none fixed inset-0 z-60 flex items-start p-4 max-sm:p-0'>
      <Drawer.Popup finalFocus={() => payload?.returnFocus.current ?? false} className='activity-drawer-popup dark pointer-events-auto relative flex h-full w-96 max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1d2123] text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none max-sm:max-w-none max-sm:w-full max-sm:rounded-none'>
        <Drawer.Content className='flex min-h-0 flex-1 flex-col'>
          {payload && <ActivityBody key={`${session}:${payload.vesselId}`} vessels={vessels} initialVesselId={payload.vesselId} open={open} onSelection={onSelection} />}
        </Drawer.Content>
      </Drawer.Popup>
    </Drawer.Viewport></Drawer.Portal>}
  </Drawer.Root>;
}
