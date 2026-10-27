export type Coordinate = [number, number];
// Demo start in Massachusetts Bay, outside Boston Harbor.
export const INITIAL_POSITION = { longitude: -70.85, latitude: 42.31 };
// Heading in degrees clockwise from north: 0=N, 90=E, 180=S, 270=W.
export const INITIAL_HEADING = 135;
export const ROUTE_DISTANCE_NM = 2;

export function bearingBetween(from: Coordinate, to: Coordinate) {
  const rad = Math.PI / 180;
  const delta = (to[0] - from[0]) * rad;
  const latitude = from[1] * rad, targetLatitude = to[1] * rad;
  return (Math.atan2(
    Math.sin(delta) * Math.cos(targetLatitude),
    Math.cos(latitude) * Math.sin(targetLatitude) - Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(delta),
  ) / rad + 360) % 360;
}

export function destinationFrom(from: Coordinate, heading: number, nauticalMiles: number): Coordinate {
  if (!nauticalMiles) return [...from];
  const rad = Math.PI / 180;
  const latitude = from[1] * rad, longitude = from[0] * rad;
  const angle = nauticalMiles * 1852 / 6371008.8, bearing = heading * rad;
  const endLatitude = Math.asin(Math.sin(latitude) * Math.cos(angle) + Math.cos(latitude) * Math.sin(angle) * Math.cos(bearing));
  const endLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(latitude), Math.cos(angle) - Math.sin(latitude) * Math.sin(endLatitude));
  return [((endLongitude / rad + 540) % 360) - 180, endLatitude / rad];
}

// Project a distance and bearing from the vessel on a spherical Earth.
export function destination(distanceNm: number): Coordinate {
  if (distanceNm === 0) return [INITIAL_POSITION.longitude, INITIAL_POSITION.latitude];
  const radians = Math.PI / 180;
  const latitude = INITIAL_POSITION.latitude * radians;
  const longitude = INITIAL_POSITION.longitude * radians;
  const bearing = INITIAL_HEADING * radians;
  const distance = (distanceNm * 1852) / 6371008.8;
  const endLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(distance) +
      Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing),
  );
  const endLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
      Math.cos(distance) - Math.sin(latitude) * Math.sin(endLatitude),
    );
  return [endLongitude / radians, endLatitude / radians];
}

export const WAYPOINT = destination(ROUTE_DISTANCE_NM);
export const INITIAL_CENTER: [number, number] = [
  INITIAL_POSITION.longitude,
  INITIAL_POSITION.latitude,
];
export const RANGE_DISTANCES = [0.5, 1, 2];

export function headingToWaypoint(position: [number, number]) {
  if (
    Math.abs(position[0] - WAYPOINT[0]) + Math.abs(position[1] - WAYPOINT[1]) <
    1e-10
  )
    return INITIAL_HEADING;
  const rad = Math.PI / 180;
  const delta = (WAYPOINT[0] - position[0]) * rad;
  const latitude = position[1] * rad;
  const targetLatitude = WAYPOINT[1] * rad;
  return (
    (Math.atan2(
      Math.sin(delta) * Math.cos(targetLatitude),
      Math.cos(latitude) * Math.sin(targetLatitude) -
        Math.sin(latitude) * Math.cos(targetLatitude) * Math.cos(delta),
    ) /
      rad +
      360) %
    360
  );
}
