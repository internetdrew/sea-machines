# Sea Machine

A React/Vite prototype for a simulated STORMRUNNER vessel off Long Branch, New Jersey. Includes vessel details, playback controls, camera following, range rings, a waypoint, and a recorded voyage trail.

## Development

Use Node.js 24 for the TypeScript-based tests.

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

## Movement

- `src/lib/vessel/navigation.ts` defines the starting position, heading, waypoint distance, and range-ring distances.
- `src/lib/vessel/simulation.ts` owns one animation clock, voyage history, and playback commands. It suspends scheduling while paused, hidden, or at the waypoint.
- `src/lib/vessel/use-vessel-simulation.ts` connects page visibility and throttled React snapshots to the simulation.
- `src/components/vessel/vessel-layer.tsx` owns the mapcn boat marker, tooltip, and popup.
- `src/components/vessel/renderer.ts` moves the marker, rings, camera, and native MapLibre route/trail layers from the same frame. History updates only when a track sample is added.

Playback starts paused at 12 knots and 10× simulated time. The voyage ends at the waypoint. Range rings fade together when toggled.

## Map components

`src/components/ui/map.tsx` is the installed mapcn component library. Local additions expose marker and tooltip refs for imperative animation; mapcn retains ownership of their content and lifecycle.

The map uses CARTO basemap tiles and the MapLibre worker configured by mapcn, so those resources require network access.

Tests cover simulation timing, synchronization, visibility, cleanup, and native line styles using a mocked map. They do not replace browser verification of WebGL rendering, popup interactions, or the ring fade.
