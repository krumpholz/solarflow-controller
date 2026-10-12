# V4.23 → V4.25 / model V13

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
4. Separate charge/discharge block diagnostics. Max SOC blocks charging, not permitted discharge. Attach auxiliary snapshots only when cycle IDs match; log13 has one stale initial attachment. These diagnostic improvements remain open.
5. Independently validate acceptance limits, release and recovery after discharge. A fixed recorded battery residual is not a valid future forecast when discharge history changes.

Import with discharge disabled in energy-saving mode and house load above PV is not controller failure. Export under limited charge acceptance cannot be eliminated solely by stronger control gains. HA completion is not a correlated BLE device acknowledgement. Energy metrics exclude gaps.

Efficiency component v5.1.0 has its own version sequence; this publication concerns the experimental controller and simulation.
