# Regulator V4.19-SIM – field validation pending

**English** | [Deutsch](README_DE.md)

Complete installation-specific Node-RED Function code derived from V4.18 and the night log of 10 October 2026. The candidate has been compared in a simulation model; hardware validation is pending. Regulator revision 4.19-SIM is separate from the efficiency-monitoring release version.

## Files

- [Regler_V4_19_SIM.js](Regler_V4_19_SIM.js): complete Function body.
- [Regler_V4_19_SIM.txt](Regler_V4_19_SIM.txt): identical text copy for opening, saving and copying.
- [Full analysis in German](Regler_Analyse_DE.md), including model limitations.
- [Selected simulation parameters](Regler_Parameter.json).
- [Recorded data](Regler_Messdaten.svg) and [simulation comparison](Regler_Simulation.svg).

## Changes from V4.18

- Fine control adjusts the last issued request toward the midpoint of the configured window. HOLD additionally requires an error within 2 W of that midpoint and fresh, sufficiently tracked battery telemetry. The observed discharge window is 0 to +15 W, with a midpoint of +7.5 W.
- At PV up to 50 W, the normal upward discharge ramp changes from 300 to 1,200 W per control tick, and the normal proportional gain becomes 0.80.
- The controller can keep the previous request for up to 6 s while a large battery response is pending, avoiding repeated compensation for the same pending import response.
- Large export uses gain 1.00 only with tracking or export confirmation. Fine changes are limited to 2 W inside the window and 6 W near its outside, at least 6 s after the previous change.
- The optimization applies only at PV up to 50 W; only 0 W PV was observed. Original charge/discharge paths remain active above that threshold. Window boundaries, SOC guards and direction logic are retained.

In the nominal model, mean absolute midpoint error decreases from 43.60 to 32.88 W, with reduced import and export energy. Time inside the original window falls from 83.24% to 81.56%: conservative fine adjustments can leave small boundary excursions for longer. These are conditional simulation results, not new hardware measurements.

## Use in the existing installation

1. Export the current regulator node or flow so it can be restored.
2. Replace its complete Function body with the JS or TXT contents. Keep the same flow tab, snapshot input and context.
3. Keep four outputs and existing wiring: **1 direction, 2 charge W, 3 discharge W, 4 status**. Do not add another periodic controller.
4. Deploy and initially observe night operation at PV near 0 W. Status should report `4.19-SIM`; the target remains the midpoint of the existing configured window.

This file is not a standalone flow import. It requires the installation-specific measurement snapshots, enable flags, SOC/direction state and existing write path of the V4.18 node.

## Next field test

Repeat the recorded load sequence by switching approximately 1 kW and then 2 kW on and off, allowing regulation to settle between switches. Then capture at least 30 minutes of quiet night operation. Log grid power, battery telemetry, requests, window limits, HOLD and the new `centerTrim` status. Where available in the existing write path, also record HTTP send times, responses and applied setpoints.

Compare settling time and error energy, secondary peaks following the initial load impulse, and quiet-operation mean and dispersion around +7.5 W. Charging and PV transitions need separate logs. Initial peaks after an unknown load step cannot be eliminated completely because of measurement and actuation delays.

All 525 original records were reproduced exactly and 14 check groups passed, including equivalence of the final code and selected candidate in five model variants. This does not constitute field validation. Private raw logs and installation exports are not published.
