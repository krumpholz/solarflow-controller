# V4.30-SIM-ZERO5-TEST: PackState-only completion, no timeout

[German instructions](README_DE.md) · [Log24 findings](Analyse_Log24_DE.md)

Log24 shows ZERO4 ending its 23 W attempt after six seconds because measured battery power reached +5 W. PackState stayed discharging and −18 W returned. The 60s limit was never reached.

For this explicitly requested test, remove both the timeout and battery-power early completion. Hold the initial measured residual+5 W request, capped at 100 W, until a valid PackState discharge→charge/standby transition, or an existing inhibit/normal-demand/AC-confirmation/freshness/PV-load abort. Record first measured zero crossing and elapsed time without using zero crossing to stop. OFF emits zero; absent a stop condition, the attempt can persist. Observe this test; it is not a production default.

Only replace the four-output regulator Function. Invalid snapshot/runtime-error calls remain diagnostic-only and can leave the previous device request held. No autonomous timeout. Fresh version context permits a new attempt after ZERO4.

20 offline tests pass, including holding beyond60s/10min and late PackState completion. Disabled-attempt replay: 5,324 historical executions unchanged from ZERO1, 66 diagnostic-only calls unchanged. Hardware outcome and PackState timing remain unvalidated. Plant model V16 unchanged.
