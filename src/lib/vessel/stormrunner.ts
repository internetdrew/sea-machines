// Published specifications, checked 2026-10-28:
// https://sea-machines.com/stormrunner/
// https://sea-machines.com/wp-content/uploads/2025/11/STORMRUNNER_Email.pdf
// The page states 40 kn maximum; the brochure says 40+ kn. Use 40 as our cap.
export const STORMRUNNER_SPECIFICATIONS = Object.freeze({
  cruiseSpeed: 27, // knots
  maxSpeed: 40, // knots
  lengthMeters: 8,
  beamMeters: 2.35,
  minimumRangeAtCruiseNm: 700, // published as 700+ nm
  payloadKg: 450,
  engineHorsepower: 300, // diesel outboard
});
