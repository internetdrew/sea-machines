type Side = 'left' | 'right' | 'top' | 'bottom';

/** Keep the card beside its marker when possible, retaining its side while it fits. */
export function placeMapTooltip({ x, y, width, height, viewportWidth, viewportHeight, gap, preferredSide, previousSide }: {
  x: number; y: number; width: number; height: number;
  viewportWidth: number; viewportHeight: number; gap: number;
  preferredSide: 'left' | 'right'; previousSide?: Side;
}) {
  const margin = 12;
  const fits = {
    left: x - gap - width >= margin,
    right: x + gap + width <= viewportWidth - margin,
    top: y - gap - height >= margin,
    bottom: y + gap + height <= viewportHeight - margin,
  };
  const candidates: Side[] = [preferredSide, preferredSide === 'left' ? 'right' : 'left', 'top', 'bottom'];
  const side = previousSide && fits[previousSide] ? previousSide
    : candidates.find(candidate => fits[candidate]) ?? (y > viewportHeight / 2 ? 'top' : 'bottom');
  const clamp = (value: number, size: number, viewport: number) =>
    Math.max(margin + size / 2, Math.min(viewport - margin - size / 2, value));
  const centerX = clamp(x + (side === 'left' ? -gap - width / 2 : side === 'right' ? gap + width / 2 : 0), width, viewportWidth);
  const centerY = clamp(y + (side === 'top' ? -gap - height / 2 : side === 'bottom' ? gap + height / 2 : 0), height, viewportHeight);
  return { side, offset: [centerX - x, centerY - y] as [number, number] };
}
