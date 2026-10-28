# V4.26-SIM-ZERO1: charging direction at zero demand

2026-10-28. New test version based on V4.25-SIM-DIAG1. When both final charge and discharge demands are zero, the active controller requests **AC-mode 1 (charging)**. Hardware zero-power behaviour still requires a field check.

[German installation and validation details](README_DE.md)

- [Complete Function text](Regler_V4_26_SIM_ZERO1.txt)
- [Identical JavaScript](Regler_V4_26_SIM_ZERO1.js)
- [One four-output Node-RED Function import](NodeRED_Regler_V4_26_SIM_ZERO1_Import.json)
- [Differential replay results](validation/ZeroIdle_Regression.json)
- [Observed behaviour and unresolved hardware question](validation/ZeroIdle_Observation.json)

Replace the controller Function body only. Outputs, top to bottom: 1 direction to the existing AC-mode handler, 2 charge watts, 3 discharge watts, 4 diagnostics/logger. An imported Function belongs on the existing flow tab; reconnect its four outputs and run only one controller. Existing measurement, logger, supplementary diagnostics and direction-handler code need no replacement for this installation path.

Positive discharge demand still requests mode 2. Positive charging still requests mode 1. Both final demands zero requests mode 1 in active regulation/forced-charge mode, including power requests limited to zero by inhibits/SOC limits. OFF retains no direction message and zero powers. Invalid-snapshot/error control suppression remains intact.

This is a hardware-direction override after rounding and final power/SOC failsafes. It does not rewrite internal direction, AntiFlip or integrators. Logical discharge mode and a charging-direction output may therefore coexist at zero demand. Positive discharge resumes the existing discharge path. Oscillation between zero and small discharge demand may create additional hardware direction changes and should be observed in the live test.

No positive charging pulse is implemented. The user reports roughly−24W after discharge demand reaches zero, ending after a small charge request around6W. The screenshot does not isolate whether mode1 at zero alone suffices. Test zero-mode switching first. `pulseEnabled=false`/`pulseW=0` are diagnostic facts, not configuration switches. A bounded5–6W pulse for one or two cycles would be a separate follow-up if confirmed charging direction with both demands zero still leaves the residual power; charge permission and immediate cancellation on new demand would have to be respected.

New status fields: `behaviorVersion=4.26-SIM-ZERO1`, `zeroPowerIdle` (active state, logical mode/direction, requested/reported AC mode, fresh battery measurement, pulse disabled). Direction confirmation is not power-zero confirmation. Existing per-invocation diagnostics and counter context continue, including skips and synchronous errors.

Ten targeted offline test groups pass. Differential replay of5,390 records (5,324 executions and66 known skips) preserves all charge/discharge power messages and internal control memory;95 zero-demand direction requests change from2 to1. This is not a closed-loop hardware forecast. Unknown Log15 gaps reset segments; other state is retained. Model V16 is preserved; no invented zero-mode plant parameters are fitted.

```sh
node --test tests/zero-idle.test.cjs
node tests/regression.cjs ../v4.25-sim/simulation
```

The private logs15–23 must be supplied in that simulation directory's `upload/`. Restore V4.25-SIM-DIAG1 to roll back, or set `zeroPowerPreferCharge=false` to restore the previous direction selection. Next field log should include discharge→zero demand→mode1, actual battery-power response, then renewed discharge demand.
