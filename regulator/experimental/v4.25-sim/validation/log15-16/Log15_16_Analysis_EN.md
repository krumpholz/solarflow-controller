# Logs 15/16 — dawn transition and model V14

2026-10-13. **Keep controller V4.25-SIM-DIAG1. Publish model V14.** Six controller modifications were evaluated against the unchanged baseline in 1,001 conditional closed-loop runs. None is adopted: better average tracking did not consistently preserve import peaks and quiet direction changes. A physical optimum is not established.

The [detailed German report](Log15_16_Analyse_DE.md) contains the measurements, derivation, validation boundaries and next field experiment. Machine-readable audit, calibration, replay and simulation results accompany this report.

## Field observations

Positive grid power means import. Discharging uses 0…15 W with target 7.5 W; charging below 720 W PV uses −5…15 W with target 5 W. Metrics are time-weighted only across adjacent valid measurement cycles.

| Segment | Mean grid | Target MAE | Time inside window |
|---|---:|---:|---:|
| Log15, PV 8–22 W | +7.47 W | 2.17 W | 99.32% |
| Log16, discharge at PV ≤50 W | +7.18 W | 2.39 W | 98.11% |
| Log16, PV >50 W and nonzero discharge command | +3.74 W | 6.02 W | 74.47% |
| Log16, charging at PV <280 W | −16.27 W | 21.27 W | 4.00% |
| Log16, charging at PV 280–367 W | −5.16 W | 10.35 W | 67.66% |
| Log16, final 120 s | −2.03 W | 7.31 W | 85.59% |

The existing ≤50 W PV discharge midpoint control works well. Dawn tracking and the transition retain room for improvement. Neither log covers high/very-high PV; those thresholds start at 720/1,050 W.

Discharge command first reaches zero at 08:27:13.930 CEST. Charging starts 52.144 s later at 08:28:06.074, with −67 W grid, 180 W PV and a 60 W charge command. The direction guard blocks 18 valid invocations. Battery telemetry remains approximately −19 W while discharge command is zero. Since inferred house power equals PV + grid − battery, the 40 W surplus requirement effectively requires grid <−59 W here, stricter than the separate −35 W export threshold. This explains the delay. The telemetry alone does not prove real idle AC export.

## Diagnostics and replay

Log15 has 594 records and five missing invocation numbers under the old diagnostics. Log16 contains all 599 consecutive invocations: 594 control executions and five snapshot skips. All five preserve empty control outputs 1–3 and emit diagnostics on output 4. Three builder rejections have latencies 694/546/512 ms against a 450 ms limit, despite reception spreads of only 16/1/1 ms. Two accepted same-cycle snapshots reach the controller at ages 1,871/1,843 ms against 1,800 ms, following delayed controller invocations. Limits remain unchanged: rejected builder values are unavailable for a reliable admission counterfactual.

Both charge and discharge block fields exist, but neither inhibition is active in these logs; inhibited-state transitions remain unvalidated here. HA requests/completions match 135/135 and 192/192; HA completion is not a correlated BLE-device acknowledgment.

The complete controller replay reproduces all 1,188 executed decisions exactly. Log15 resets at unknown gaps; Log16 preserves controller state through its five known skips. Replay uses recorded trim phase times to avoid millisecond boundary artifacts; the simulation uses a virtual clock.

## Model and conditional simulation

V14 retains prior charge-acceptance and full-standby models. It adds local dawn calibration, separate idle telemetry/physical hypotheses, known-skip semantics and a signed delayed PT1 transition simulator. Charge delay references controller time; discharge references HA request time, avoiding duplicated request latency. Grid and battery are sampled at separate reception times. The ordinary discharge-to-charge transition does not receive the unrelated full-standby 8 s startup gate.

Only offsets were fitted; existing gains/dynamics stay fixed. Discharge is fitted on Log15's first ten minutes and tested on its remainder plus Log16. Charge is fitted on its first 120 s and tested on the remainder. Active offsets remain unchanged because the fitted alternatives do not improve both RMSE and MAE across their held-out checks. Idle telemetry calibration is local, not independently validated. Observed charge commands span 60–285 W.

Each of seven controller versions runs 52 log-based and 91 synthetic cases. Model alternatives include latency factors 0.8/1/1.25, existing/local offsets, physical idle −19/0 W, delayed AC-mode feedback, and no charging acceptance below a 60 W command. Logs are simulated with and without retained battery residual; synthetic scenarios cover rising PV, brief clouds, load steps, boundary oscillation and a cloud immediately after an earlier possible charging transition.

| Candidate | Finding | Decision |
|---|---|---|
| Extend stable discharge midpoint trim to PV <280 W | Modest window improvement; up to ~9.1 W additional import peak in log sensitivity | Reject |
| Locally reduce surplus margin 40→25 W only at zero discharge command | Nominal transition ~10 s earlier, ~0.16 Wh less export | Reject: early-cloud case adds up to 30.38 W import peak and two direction changes |
| Increase low-PV charging trim 3→5/6 W | Little effect during measured rise; some synthetic improvement | Reject: individual tracking regressions and up to 6.08/9.12 W higher import peaks |
| Combinations | Better means in some cases | Reject: inherit the above weaknesses |

Reconstructed net disturbance and retained residual can exactly reproduce the baseline by construction; this is a consistency check, not independent predictive validation. Seven additional simulator checks cover causality, sign, idle separation, candidate patch effectiveness and baseline recovery. Full results remain conditional on uncertain low-command acceptance and idle physics. No raw household logs are published.

Continue the existing controller; no Function-node replacement is needed for V14. The most useful next measurement is another natural discharge→charge→discharge transition at roughly 100–300 W PV with an available battery and small load/PV changes. Independent house/AC measurement would separate idle telemetry from physical power. Low charging commands below 60 W require their own observed response before an earlier transition is promoted.
