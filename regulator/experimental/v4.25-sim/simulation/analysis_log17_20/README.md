# Logs 17–20 / model V15: reproduction

Run from the repository's `regulator/experimental/v4.25-sim/simulation/` directory. Python needs numpy, scipy and matplotlib. Node must support `structuredClone` (checked with Node24). No live HA/BLE access occurs.

Place the private originals in `upload/regler_event_log_N.jsonl` for N = 8,9,11,15,16,17,18,19,20. Logs17–20 alone suffice for the controller replay and audit. Calibration, screening and historical checks also require the named reference logs. Source SHA-256 hashes for the four new files are in the audit and model. Raw logs are not published.

```sh
python analysis_log17_20/analyse.py
node analysis_log17_20/replay.cjs
python analysis_log17_20/calibrate.py
node analysis_log17_20/study.cjs
node analysis_log17_20/robustness.cjs
node analysis_log17_20/validate.cjs
python analysis_log17_20/plot.py
python analysis_log17_20/finalize_model.py
```

Outputs are written to `results_regler_log17_20/`. Model V14 is loaded from the sibling `../Regler_Modell_V14.json` (the working-tree fallback is only for the original analysis environment). Controller source is resolved by the already published `analysis_log15_16/source.cjs` from `../Regler_V4_25_SIM_DIAG1.js`. Existing helpers: `analysis_log6/physics.py`, `analysis_log11/initial.cjs`, `analysis_log9/project/analysis_pv_no_shift/{plant,runtime}.cjs`.

- `replay.cjs`: persistent invocation sequence across all four logs, including 37 known skips and one repeated snapshot. Observed trim clock phases avoid millisecond timer artifacts; recorded outputs are compared, not injected into later state.
- `calibrate.py`: first10min of logs17/19 for fitting; chronological remainder and other logs held out. Compares fixed nominal/local alternatives, an affine fit and a continuous hinge fit. Dynamics stay fixed.
- `study.cjs`: 16 versions including unchanged baseline; 10 plant alternatives; logs15–20 with/without fixed battery residual = 1,920 runs. All patches are simulation candidates only.
- `robustness.cjs`: baseline plus trim3_10, ramp30 and fallCap_05 on seven synthetic disturbances and older logs8/9/11 = 520 further runs.
- `validate.cjs`: patch effectiveness, causal delay, baseline consistency and equality of lower-PV references15–18. Reused-residual baseline agreement is not independent predictive validation.
- `finalize_model.py`: preserve historical model, add scoped daytime calibration, observed transition clocks, decision and result-file hashes.

The simulation reconstructs net disturbance per baseline plant model, then uses simulated outputs to determine subsequent grid/battery inputs. Alternative AC-mode readback follows simulated direction after2s. PackState is diagnostic-only in the actual controller; its observed40s delay is documented separately, not imposed as a physical actuation gate. Known skips issue no commands, while pending plant events continue. Old logs without invocation diagnostics reset at unknown cycle gaps. Sampling times remain the recorded reception times.

Positive power means charging/import. Charging target is +5W below720W PV and −5W above, within the original −5…+15W window. No offset-window shift is introduced. Discharge target is +7.5W in0…+15W. Metrics exclude the first30s in simulations and gaps between invalid points. In the field audit, repeated/jumped measurement cycle intervals are also excluded. These scoring windows differ and should not be mixed.

All model alternatives and counterfactuals are conditional, not probability-weighted. The new affine model is preferred locally for daytime analysis; global historical coefficients remain intact because log11 slightly regresses. No tuning candidate is selected for the installation. Current controller remains V4.25-SIM-DIAG1.
