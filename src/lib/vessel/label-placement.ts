export type LabelRect = { x: number; y: number; width: number; height: number };
export type LabelSide = 'below' | 'above' | 'right' | 'left';
const intersects = (a: LabelRect, b: LabelRect) =>
  a.x < b.x + b.width + 6 &&
  a.x + a.width + 6 > b.x &&
  a.y < b.y + b.height + 6 &&
  a.y + a.height + 6 > b.y;

export function placeVesselLabel(
  hull: LabelRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  obstacles: LabelRect[],
  preferred: LabelSide = 'below',
) {
  const gap = 14,
    edge = 12;
  const positions = {
    below: {
      x: hull.x + (hull.width - size.width) / 2,
      y: hull.y + hull.height + gap,
    },
    above: {
      x: hull.x + (hull.width - size.width) / 2,
      y: hull.y - size.height - gap,
    },
    right: {
      x: hull.x + hull.width + gap,
      y: hull.y + (hull.height - size.height) / 2,
    },
    left: {
      x: hull.x - size.width - gap,
      y: hull.y + (hull.height - size.height) / 2,
    },
  };
  const candidates = [
    ...new Set([preferred, 'below', 'above', 'right', 'left'] as LabelSide[]),
  ].map(side => ({
    side,
    ...size,
    x: Math.max(
      edge,
      Math.min(positions[side].x, viewport.width - size.width - edge),
    ),
    y: Math.max(
      edge,
      Math.min(positions[side].y, viewport.height - size.height - edge),
    ),
  }));
  const clear = candidates.find(
    candidate => !obstacles.some(obstacle => intersects(candidate, obstacle)),
  );
  // When no adjacent placement fits, search nearby rows without hiding identities.
  if (clear) return clear;
  const base = candidates[0];
  for (let step = 1; step < 20; step++) {
    for (const direction of [1, -1]) {
      const candidate = {
        ...base,
        y: base.y + direction * step * (size.height + 8),
      };
      if (
        candidate.y >= edge &&
        candidate.y + size.height <= viewport.height - edge &&
        !obstacles.some(obstacle => intersects(candidate, obstacle))
      )
        return candidate;
    }
  }
  return base;
}

/** Convert viewport CSS bounds to the overlay's local layout coordinates. */
export function relativeLabelRect(
  bounds: LabelRect,
  overlay: LabelRect,
  layout: { width: number; height: number },
): LabelRect {
  const scaleX = layout.width / overlay.width;
  const scaleY = layout.height / overlay.height;
  return {
    x: (bounds.x - overlay.x) * scaleX,
    y: (bounds.y - overlay.y) * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY,
  };
}
