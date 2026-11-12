export type VesselDrawerView = 'compact' | 'summary' | 'full';
export type VesselDrawerSizes = Record<VesselDrawerView, number> & {
  actions: number;
};

/** Snap sizes include measured chrome; the full frame remains stable between views. */
export function vesselDrawerSizes(
  content: Record<VesselDrawerView, number>,
  chrome: number,
  actions: number,
  available: number,
): VesselDrawerSizes {
  // Base UI deduplicates snaps within 1px; retain a distinct middle snap when capped.
  const full = Math.max(
    5,
    Math.min(
      Math.ceil(chrome + content.full + actions + 2),
      Math.floor(available),
    ),
  );
  const summary = Math.max(
    3,
    Math.min(Math.ceil(chrome + content.summary + actions + 2), full - 2),
  );
  const compact = Math.max(
    1,
    Math.min(Math.ceil(chrome + content.compact + 2), summary - 2),
  );
  return { compact, summary, full, actions: Math.ceil(actions) };
}
