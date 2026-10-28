# V4.31-SIM-ZERO6-TEST: observe PV/load deltas without aborting

[German instructions](README_DE.md) · [Log25 analysis](Analyse_Log25_DE.md)

Log25: a correct 23 W request moved measured battery power from −18 W to +4…+5 W. The test ended after10s due to a +53 W derived-house delta exceeding the retained25W heuristic; regular calculated demand remained0/0. PackState stayed discharging and −18 W returned.

This test-only version records raw PV/house deviations without using them as stop conditions. Keep dynamic initial residual+5W (100W cap), PackState completion, normal power demand/inhibit/freshness/AC-confirmation priorities, and anti-feedback state separation. No timeout or battery-zero early stop. Observe the test: without completion or another priority, the request can persist. OFF emits zero; invalid-input/runtime-error calls remain diagnostic-only and can leave the previous request held.

Only replace the four-output regulator Function. Added signal-change diagnostics. New context permits a fresh attempt after ZERO5. 23 tests pass; original Log25 replay exactly reproduces32/32 power requests. Candidate holds across the old abort point under frozen recorded inputs; this is not a physical response forecast. With the attempt disabled,5,324 historical executions match ZERO1 and66 rejected invocations remain diagnostic-only. Plant model V16 unchanged; longer hardware test still required.
