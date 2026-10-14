# Logs21–23 / modelV16: reproduction

Run from `regulator/experimental/v4.25-sim/simulation/`. Python needs numpy, scipy, matplotlib; Node must support structuredClone (checked with Node24). This workflow has no live HA/BLE access.

Private inputs: `upload/regler_event_log_N.jsonl` for N=8,9,11,15,16,17,18,19,20,21,22,23. Audit/replay/plots need only21–23; calibration and closed-loop studies also use references. Original household logs are not published.

```sh
python analysis_log21_23/analyse.py
node analysis_log21_23/replay.cjs
python analysis_log21_23/calibrate.py
python analysis_log21_23/telemetry.py
node analysis_log21_23/study.cjs
node analysis_log21_23/robustness.cjs
node analysis_log21_23/validate.cjs
python analysis_log21_23/plot.py
python analysis_log21_23/finalize_model.py
```

Outputs: `results_regler_log21_23/`. Base model resolves sibling `../Regler_Modell_V15.json`; source resolves through existing `analysis_log15_16/source.cjs` to unchanged `../Regler_V4_25_SIM_DIAG1.js`. Shared helpers: `analysis_log6/physics.py`, `analysis_log11/initial.cjs`, `analysis_log9/project/analysis_pv_no_shift/{runtime,plant}.cjs`.

Calibration training remains the older first10min of logs17/19; new logs21–23 independently check that frozen affine fit. `telemetry.py` fits a separate offset on Log23's first10min and evaluates the remainder and other new logs. The extra offset is a telemetry hypothesis, not a physical AC or universal SOC calibration.

Screening:17 versions including baseline ×5 logs ×12 plant alternatives ×2 residual options =2,040. Robustness:4 versions ×12 alternatives ×(7 synthetic cases+7 historical logs×2 residual options)=1,008. The strict8s finalQuiet1 variant is rejected during screening and is not one of the four robustness finalists. No candidate is promoted.

`predictor.cjs` produces an experimental observer patch for pending command response. All generated variants remain simulation-only; this directory is not a Node-RED controller import. `study.cjs` uses delayed endogenous AC-mode feedback and separate reception clocks. Battery-only extra offset does not change the physical grid model. Net load is reconstructed per baseline model; retained residual is fixed between candidates. Baseline recovery is not predictive proof.

Replay preserves state using invocationSequence and observed trim clock phases. Audit uses numeric suffix from full cycleId, not the display-only last6characters. Known skips retain previous actuator commands and are excluded as measurements. Unknown gaps in older logs reset those segments. Simulation scoring excludes first30s; field audit does not. Current controller remains V4.25-SIM-DIAG1.
