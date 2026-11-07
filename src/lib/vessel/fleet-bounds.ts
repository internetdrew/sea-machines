import { destinationFrom } from './navigation.ts';
import type { Coordinate } from './navigation.ts';

// Find the smallest longitude span, including fleets crossing the date line.
export function getFleetBounds(
  positions: readonly Coordinate[],
  radiusNm = 2,
): [Coordinate, Coordinate] | undefined {
  const points = positions
    .filter(point => point.every(Number.isFinite))
    .flatMap(position => [
      position,
      ...[0, 90, 180, 270].map(heading =>
        destinationFrom(position, heading, radiusNm),
      ),
    ]);
  if (!points.length) return undefined;
  const longitudes = points
    .map(([longitude]) => ((longitude % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let largestGap = -1;
  let start = 0;
  for (let index = 0; index < longitudes.length; index++) {
    const next = (index + 1) % longitudes.length;
    const gap = longitudes[next] + (next === 0 ? 360 : 0) - longitudes[index];
    if (gap > largestGap) {
      largestGap = gap;
      start = next;
    }
  }
  let west = longitudes[start];
  if (west > 180) west -= 360;
  let south = Infinity,
    north = -Infinity;
  for (const [, latitude] of points) {
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  return [
    [west, south],
    [west + 360 - largestGap, north],
  ];
}
