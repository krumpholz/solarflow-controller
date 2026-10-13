# Logs 15/16: reproduction

Run from the `simulation/` directory of the repository. Python requires numpy, scipy and matplotlib; Node.js must support `structuredClone` (the checked environment used Node 24). No live controller, HA or BLE connection is made.

Supply the private original logs as `upload/regler_event_log_15.jsonl` and `upload/regler_event_log_16.jsonl`. They are intentionally not published. Their SHA-256 values are recorded in `Log15_16_Audit.json` and model V14.

```sh
python analysis_log15_16/analyse.py
python analysis_log15_16/calibrate.py
node analysis_log15_16/replay.cjs
node analysis_log15_16/study.cjs
node analysis_log15_16/validate.cjs
python analysis_log15_16/plot.py
python analysis_log15_16/finalize_model.py
```

Outputs go to `results_regler_log15_16/`. `source.cjs` resolves the unchanged sibling `../Regler_V4_25_SIM_DIAG1.js`. Existing shared helpers are `analysis_log6/physics.py`, `analysis_log11/initial.cjs`, `analysis_log9/project/analysis_pv_no_shift/{runtime,plant}.cjs`. Calibration reads the preserved V13 model in `results_regler_log13/Regler_Modell_V13_Voll_Entladen.json`.

`study.cjs` defines all six patches, the unchanged reference, 13 explicit model variants, per-case outcomes and summary differences. There is no auto-selection of a production controller. Model alternatives are sensitivity hypotheses, not probability distributions. `minCharge=60` is deliberately an unmeasured low-command acceptance hypothesis. The early-cloud scenario probes the benefit/risk of earlier direction switching; it is not an observed cloud.

Replay uses the recorded internal trim clock phases, with no recorded command injection into subsequent controller state. The closed loop uses virtual time and delayed endogenous AC-mode feedback. Known skipped measurement cycles issue no commands; queues continue evolving. Unknown Log15 gaps reset the segment. Interval metrics exclude skipped/missing observations.

The simulator reconstructs each log's net disturbance from the baseline open-loop model; optional battery residual is held fixed between candidate runs. Exact residual-enabled baseline recovery verifies wiring and signs, not model generalization. Calibration has separate chronological holdouts. Synthetic cases avoid replayed residuals and provide complementary counterexamples, not field validation.

Published controller remains V4.25-SIM-DIAG1; no candidates are promoted. The machine-readable model embeds the final decision and the simulation-result hash. Historical global active models stay intact; the low-power extension is explicitly scoped.
