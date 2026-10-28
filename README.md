# Sea Machine UI

An initial demo UI for planning and monitoring autonomous vessel missions. The goal is to let an operator place a route, understand what the vessel is doing, and control its mission without losing sight of the map or getting trapped in confusing menus.

The demo follows a simulated STORMRUNNER in Massachusetts Bay, outside Boston Harbor.

## What’s implemented

- **Mission planning:** Place waypoints or create a survey grid with adjustable dimensions, pass spacing, and rotation. Preview the route and set straight-line and turn speeds before deployment. Grid rotation determines the starting corner and sweep direction.
- **Mission control:** Deploy, pause, resume, or abort a mission. The drawer shows heading, speed, position, distance to the next waypoint, fuel readings, and smooth route progress.
- **Vessel simulation:** Throttle buildup, stronger acceleration at low speed, tapering acceleration at higher speed, coasting, and braking before turns and the final stop. Pause freezes the simulation and resume preserves momentum.
- **Vessel profiles:** Each vessel supplies its default cruise speed, maximum speed, and propulsion response. Mission inputs, validation, and deployment use that vessel’s limits.
- **Map feedback:** Departure markers, numbered waypoints, survey start/end markers, route directions, travelled trails, and distance rings. Mission brackets brighten on hover or selection; the hover card shows progress, next-waypoint ETA while moving, distance while paused, and low-fuel warnings.
- **Interaction details:** Viewport-aware tooltip placement, subpixel marker tracking, keyboard focus states, and reduced-motion support. The simulation suspends while the page is hidden.

## Vessel data

STORMRUNNER defaults to **27 kn cruise** with a **40 kn maximum**, based on [Sea Machines’ published specifications](https://sea-machines.com/stormrunner/). Specifications and sources live in `src/lib/vessel/stormrunner.ts`.

Acceleration, drag, throttle response, braking, and fuel-tank readings are demo assumptions, not measured vessel performance. This prototype uses simulated telemetry; it is not connected to a real vessel.

## Run locally

Use Node.js 24.

```sh
git clone https://github.com/internetdrew/sea-machines.git
cd sea-machines
npm install
npm run dev
```

```sh
npm test         # Simulation, mission planning, fleet state, and map logic
npm run build    # Type checking and production build
npm run lint     # Static checks
```

Built with React, TypeScript, Vite, MapLibre/mapcn, Tailwind CSS, Base UI, and Motion. Map tiles, OpenSeaMap seamarks, and the MapLibre worker require network access.

## Code layout

- `src/lib/vessel/` — Vessel profiles, route generation, simulation, and fleet state.
- `src/components/vessel/` — Mission planning, monitoring, vessel details, and map rendering.
- `src/components/ui/map.tsx` — Shared mapcn components and tooltip variants.

One simulation clock keeps vessel movement, trails, range rings, and camera tracking synchronized. React receives telemetry snapshots at 4 Hz. Automated tests cover the underlying logic; browser verification is still needed for WebGL rendering and interactions.
