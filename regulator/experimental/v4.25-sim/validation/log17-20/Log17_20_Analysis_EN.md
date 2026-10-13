# Daytime logs 17–20: model V15 and controller tuning

2026-10-13. **Publish model V15; retain V4.25-SIM-DIAG1 unchanged.** Fifteen modifications were screened against the baseline in 1,920 closed-loop runs, followed by 520 historical/synthetic checks of three finalists and the baseline. None is promoted under the priority of reliable high-PV import avoidance. This does not establish a physical optimum.

See the [detailed German report](Log17_20_Analyse_DE.md), machine-readable audit, calibration, screening and robustness results.

## Measured performance

The charging window remains −5…+15 W, with +5 W target below 720 W PV and −5 W export-edge target in high/very-high PV. Discharge uses 0…+15 W with +7.5 W target. Metrics are time-weighted between adjacent valid measurement cycles; missing/duplicate cycles are excluded from independent measurement intervals.

| Segment | PV | Mean grid | Target MAE | Inside window |
|---|---:|---:|---:|---:|
| Log17 charging | 581–686 W | +3.06 W | 4.05 W | 95.71% |
| Log18 charging | 284–717 W | +2.68 W | 8.56 W | 70.40% |
| Log19 high PV | 720–1,049 W | −37.52 W | 53.05 W | 11.98% |
| Log19 very-high PV | 1,050–1,789 W | −155.46 W | 170.33 W | 12.83% |
| Log20 high-PV charging | 720–893 W | −14.65 W | 11.16 W | 18.44% |

Log19 reaches −624 W export and +165 W import. At its export maximum, charge demand rises only 1,001→1,021 W despite 1,770 W PV. The 20 W/tick limit is a major cause of export. Log20's quieter excessive export instead relates to the 1 W/10 s fine correction. In its 442 high-PV charging samples, 21 have positive import, none exceeds +15 W; maximum is +10 W. No active charge/discharge inhibit occurs. SOC ranges are 73–75%, 75–76%, 82–85%, 88–90%; no hard full-battery stop is observed.

## Load step, diagnostics and timing

At 14:02:55.225 CEST, Log20's first load-step invocation immediately requests zero charging and 900 W discharging; next request is 1,730 W discharging. Peak grid import is 2,168 W while battery telemetry still reports +627 W charging. This event has no discharge inhibition.

AC-mode reversal is logged after 2.001 s; the first negative battery sample is received after 5.211 s and logged after 6.003 s. PackState changes in HA after 37.508 s and appears in the controller log after 40.026 s. These are different observations, not a common startup delay. No new 40 s or generic 8 s physical gate is added. Three AC-mode requests belong to the existing burst; the second already reports direction confirmation. Their physical effect is not independently identified.

All 2,398 invocation sequence numbers are present: 2,361 executed control calls and 37 snapshot skips (10/1/4/22). Complete replay reproduces all executed outputs, targets and integrators exactly, preserving state through skips. Log20 uses the same accepted snapshot twice 349 ms apart after a delayed flow-cycle fallback. Both calls request 640 W charging. This is a repeated controller execution, not a duplicated logger record. It is retained in replay without resetting controller state.

Regular HA polling of PackState does not prove fresh BLE packets. A device receive timestamp/counter would help distinguish device and HA reporting delays. No protection thresholds change, and no logger rewiring is performed.

## Model V15

A local daytime affine response is fitted on the first ten minutes of logs17/19, holding the remainder and logs16/18/20 out:

`active battery charging power ≈ 1.01892025 × command − 21.258614 W`.

Dynamics remain unchanged. Held-out RMSE improves from 10.22→9.01 W (log17), 7.72→7.18 W (log18), 13.33→10.76 W (log19), 6.48→5.19 W (log20), and 2.15→1.66 W (log16). Older log8 improves 7.80→7.37 W; older log11 slightly worsens 6.56→6.75 W. Therefore the new local daytime response supplements the historical nominal model rather than globally replacing it. A more complex continuous hinge model is not selected.

The model records independent transition clocks and repeated/invalid snapshot semantics. Closed-loop sensitivity spans coupled power response and the earlier faster grid observation path, with nominal/local battery models and latency variants. Derived house power is not an independent reference measurement.

## Tuning decision

A 30 W/tick high-PV ramp removes roughly 5.12 Wh of export in the mean residual-enabled high-PV Log19 scenario, but adds roughly 0.62 Wh import; peak import increases by up to 87.63 W across the screening cases. Faster/adaptive ramps also worsen import peaks. A 3 W/10 s fine trim modestly improves quiet tracking, but held-out cases include up to 3.06 W higher import peaks and individual tracking regressions. PV-decline charge ceilings sometimes reduce import energy while increasing export or subsequent peaks. No candidate is adopted.

These are conditional counterfactuals, not field measurements or probability estimates. Reconstructed net disturbance and fixed residual can reproduce the baseline by construction; this is a consistency check. Tests without residual and with independent synthetic disturbances reduce, but do not eliminate, model uncertainty. Lower-PV reference traces from logs15–18 remain unchanged by all high-PV candidates.

No Node-RED code replacement is required. Further improvement should investigate outstanding actuator response and signal timing rather than uniformly increasing gain or ramp speed. Raw household logs are not published.
