# V4.27-SIM-ZERO2: bounded charging pulse for residual discharge

2026-10-28. Field-test candidate based on ZERO1. Adds one **6 W charge pulse**, reflecting the user's earlier small-charge observation. [German details](README_DE.md).

- [Complete Function text](Regler_V4_27_SIM_ZERO2.txt)
- [Identical JavaScript](Regler_V4_27_SIM_ZERO2.js)
- [One four-output Function import](NodeRED_Regler_V4_27_SIM_ZERO2_Import.json)
- [Test summary](validation/ZeroPulse_Tests.json)
- [Pulse-disabled differential replay](validation/ZeroPulse_Disabled_Regression.json)

Replace only the controller Function. Outputs remain direction, charge watts, discharge watts, diagnostics. Reconnect an imported Function on the existing flow tab and run only one controller. Existing direction handler/logger stay connected.

With normal demand zero, retain AC-mode1. Pulse eligibility requires reported AC-mode1, fresh battery power ≤−10W and six seconds of valid negative observations. PackState discharge does not itself confirm AC mode. Request6W once for at most two distinct valid ticks / four seconds until the next valid call.

End earlier on a valid PackState transition from2 at pulse start to1(charging) or0(standby), or fresh battery power ≥−3W. Pre-existing PackState1 and missing states are not treated as new transitions. PackState never extends the deadline; it previously lagged about40s in a field log.

Afterward output zero during an8s settling period. Artificial demand is kept separate from regulator memory/history so own6W feedback cannot latch continuous charging. Small calculated charge demands up to21W are treated as possible echo during pulse/settling; this may briefly delay a small genuine surplus charge. Positive discharge or larger genuine charging takes priority. OFF, grid-charge takeover, charge inhibition, loss of confirmation/freshness and changing PV/load stop or prevent the pulse as documented. No automatic repeated pulse series in the same episode.

Invalid snapshots/errors retain the existing no-control-output policy. The deadline is **not an independent device watchdog**: if valid calls cease, a device may retain its last command longer; the first valid recovery call withdraws an expired pulse. Device/transport delay is not bounded by the software deadline.

New diagnostics include pulse phase/reason/stop reason, starting/current PackState, raw-state validity, regular versus actuator/memory powers. Diagnostic-only frames retain prepared context without implying a new command or device acknowledgment. `waiting_ac_mode_1` means the direction handler/readback must be checked before a pulse can run.

19 targeted tests pass. With pulse disabled,5,324 historical executed decisions retain ZERO1 regular state, direction and power;66 known skips remain diagnostic-only. Enabled-pulse hardware effect is not yet field-validated. Next log should capture mode1 confirmation,6W request, PackState/power change and return to0W.

```sh
node --test tests/zero-pulse.test.cjs
node tests/regression-disabled.cjs ../v4.25-sim/simulation
```

The second command requires private logs15–23. Set `zeroIdlePulseEnabled=false` to disable the pulse while retaining ZERO1 parking, or restore ZERO1.
