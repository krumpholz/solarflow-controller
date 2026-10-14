# Logs 21–23 — model V16 and tuning decision

2026-10-14. **Add model V16; retain V4.25-SIM-DIAG1.** Full controller replay reproduces all 1,775 executed decisions across 1,799 invocations and 24 snapshot skips. No modified controller is promoted after 3,048 conditional closed-loop runs. A physical optimum is not established.

See the [detailed German report](Log21_23_Analyse_DE.md) and accompanying audit, calibration, screening and robustness results.

Charging window stays−5…+15W; target is+5W below720W PV and−5W for high/very-high PV. Discharge uses0…+15W with+7.5W target. Log21 adds three low-PV direction transitions at PV120–486W. Log22 spans281–1,615W PV and grid−782…+311W; Log23 spans822–1,471W PV and grid−533…+340W. Fast solar changes remain a substantial control weakness.

Frozen V15 daytime battery-model RMSE is7.00/11.81/17.39W in logs 21/22/23, versus7.49/13.17/22.29W for the historical nominal model. Log23 still reports roughly15.83W above the V15 prediction on average. A local extra telemetry offset+16.95W fitted on its first10minutes reduces held-out RMSE17.70→9.72W and MAE15.70→5.57W. Applying this offset to logs21/22 worsens their prediction. V16 therefore adds a scoped telemetry hypothesis and0–20W sensitivity, not a global physical AC or SOC law. SOC ranges are 77%,88–91%,92–96%; no active inhibit or hard full-battery stop is observed.

The cycle counter restarted with five-digit numbers. Display-only short IDs such as`-21231` must not be parsed as signed counters; metrics use the full ID suffix. Invocation/logger sequences are continuous and these logs have no duplicate cycle IDs. Existing rejection thresholds remain unchanged.

The screening contains 17 versions including baseline, 12 plant alternatives and logs19–23 with/without retained battery residual: 2,040 runs. Four finalists/reference versions are tested on seven synthetic disturbances and historical logs8/9/11/15/16/17/18: 1,008 further runs. Cases span separate faster-grid versus coupled response, latency variants, nominal/daytime charge curves and extra telemetry offset.

A command-history observer for pending power changes substantially improves average tracking when paired with a faster ramp, but increases individual import peaks by up to about 260 W in screening. Lower import gains and larger quiet trims are also rejected. A 1 W last-demand-based quiet-import trim has small mixed benefits: global peak import does not increase in its tested cases, but some intervals use more import energy or track less accurately. A stricter 8 s settled variant still increases an individual screening peak by about 11 W. These results do not justify a new installation version under high-PV import-avoidance priority.

All prototypes remain simulation-only. Lower-PV reference traces15–18/21 are checked for equality. Preserved residual can recover the baseline by construction; that is consistency, not independent forecast validation. Derived house power is not an independent reference. Existing full-battery/standby model cases remain intact.

No Function replacement is required. A larger improvement needs better identification of actual AC response versus delayed/biased battery telemetry. Independent inverter AC measurement or device receive timestamps would be more useful than a uniformly faster ramp.
