# Controller V4.25-SIM and simulation model V14

**English** | [Deutsch](README_DE.md)

**Update 2026-10-13 — model V14 / Logs15–16:** [Field analysis and simulation](validation/log15-16/Log15_16_Analysis_EN.md), [current model V14](Regler_Modell_V14.json). Log15: +7.47 W against +7.5 W target, 99.32% inside window. Log16: complete DIAG1 output including five skips; delayed charging transition and dawn export explained. Six changes evaluated in 1,001 conditional runs; none adopted. **Controller unchanged; no node replacement.** V13 details below remain the preserved historical baseline.

Working baseline for further tuning, 2026-10-12. V4.25 has been recorded on the installation: complete controller replays match all 685 records in log12 and all 110 records in log13. This verifies controller execution for those inputs, not universal plant prediction. A physical optimum has not been established.

**Update 2026-10-13 — DIAG1:** Diagnostics only. Skipped snapshot cycles also emit output 4; the three control outputs and protection thresholds retain their behaviour. Ten test groups and 1,395 records compared against V4.25; Log16 now confirms live output including skipped cycles. [Details](DIAG1.md).

## Downloads and installation

- [Current V4.25-SIM-DIAG1 Function text](Regler_V4_25_SIM_DIAG1.txt), [identical JavaScript](Regler_V4_25_SIM_DIAG1.js)
- [Node-RED import: one four-output Function](NodeRED_Regler_V4_25_SIM_DIAG1_Import.json)
- [Installation, rejection conditions and diagnostic fields](DIAG1.md)
- [Original V4.25 source for existing simulations](Regler_V4_25_SIM.txt)
- [Current V14 model](Regler_Modell_V14.json)
- [Changes and tuning baseline](CHANGELOG.md)
- [Simulation sources and reproduction](simulation/README.md)

For an existing V4.23/V4.25 installation, replace the controller Function only. Output order: **1 direction, 2 charge watts, 3 discharge watts, 4 status/diagnostics**. Reconnect the imported node to the existing paths and run only one controller. Measurements, permissions, shared flow context and BLE command paths must already exist; this is not a complete installation flow. Keep the existing BLE diagnostic paths; V4.25 requires no additional diagnostic nodes.

DIAG1 SHA256: `f1a9b4527bbb07250a492d077de893794770202ec73d65c78742bfa061fa25da`. Original controller: `70935e53246a01031ad4d93a2959d8b7580b6b267873f43bbcbf62100aed22f0`.

## Progress since V4.23

**V4.24: high PV without shifting the window.** High/very-high charge-window offsets are zero. The original charge window remains −5…+15 W. Normal PV targets +5 W; high/very-high PV targets the original export edge, −5 W. Fine control permits −7…−5 W as a small export reserve. Positive import takes priority over HOLD/side hysteresis. Bounded causal PV-trend advance handles small measured PV drops without future inputs. Quiet night and normal-PV settings are retained.

**V4.25: narrowly scoped fast discharge correction.** Existing fast export reduction is also enabled outside the night regime when a valid large load drop leaves surplus even without battery discharge. Partial load drops that still require discharge do not enable this extension. Normal PV discharge P=0.8, the 900 W/tick load-step ramp and direction confirmation remain unchanged.

**Model V13** distinguishes normal actuator response, soft charge-acceptance taper near full SOC, hard charge blocking by `batt_max`, and delayed discharge startup from full standby. Local normal/high-PV calibrations and prior uncertainty cases remain documented. Model V13 is not controller revision V4.13 and adds no timer to Node-RED.

## Evidence and limits

| Check | Result | Limit |
|---|---|---|
| Log8: V4.23 vs V4.24 | All 1,186 non-high-PV outputs/targets unchanged | Does not validate high-PV field performance |
| Log11 normal PV | 28 candidates explored; finalists failed independent disturbance scenarios | No replacement charge tuning adopted |
| Log12 V4.25 | 685 exact replay records; new fast branch activated | V4.24 would also command zero for this particular drop; no incremental energy saving demonstrated |
| Log12 acceptance taper | Later, unfitted segment: 9.55 W envelope RMSE | One taper episode, not a universal SOC curve |
| Log13 full standby → discharge | 110 exact replay records; immediate 900 W request, delayed measured power | One startup; device/BLE/measurement timing cannot be separated |
| Log13 after startup | Mean +7.87 W vs +7.5 W target; 86.88% within 0…+15 W | About 198 seconds only |

Detailed German reports: [log10](validation/Log10_Analyse_V4_25.md), [log11](validation/Log11_Analyse_Entscheidung.md), [log12](validation/Log12_Analyse_V25_Ladebegrenzung.md), [log13](validation/Log13_Analyse_Umschaltung.md).

## Next tuning priorities

1. Correct small high-PV import while the battery can accept charge. Measured-power control base, request/actual offset and a nonnegative charge integrator can retain a small import bias. Evaluate targeted fine reductions or base compensation against noise and PV drops; neither is implemented here.
2. Evaluate rising and falling PV separately. The conservative 20 W high-PV upward ramp may cause export on rising PV. Faster variants must still suppress import on falling PV.
3. Investigate startup and BLE command ordering. Three direction requests were observed; their effect on startup remains unknown. Do not interpret the model as a universal eight-second controller timer.
4. Validate failure diagnostics live. Logger V2 already installed at the site separates charge/discharge inhibits and discards mismatched auxiliary snapshots; log14 verifies normal records. DIAG1 adds skipped controller invocations and runtime errors. Log16 now confirms skip reasons in operation; active inhibition transitions still need a separate field check. Logger V2 is a prerequisite for this installation path and is not installed by the DIAG1 controller import.
5. Independently validate acceptance limits, release and recovery after discharge. A fixed recorded battery residual is not a valid future forecast when discharge history changes.

Import with discharge disabled in energy-saving mode and house load above PV is not controller failure. Export under limited charge acceptance cannot be eliminated solely by stronger control gains. HA completion is not a correlated BLE device acknowledgement. Energy metrics exclude gaps.

Efficiency component v5.1.0 has its own version sequence; this publication concerns the experimental controller and simulation.
