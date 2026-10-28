# V4.28-SIM-ZERO3: feedback-led idle release

See [the German installation and test instructions](README_DE.md).

Changes from ZERO2: start with 5 W, wait for a valid PackState discharge→charge/standby transition or earlier fresh battery power ≥−3 W. Use a 60-second wall-clock deadline instead of a two-tick/four-second limit. Test 10 W separately by changing `zeroIdlePulseW`; no automatic escalation or repeated attempt in the same idle episode. Existing AC confirmation, six-second residual confirmation, inhibit/normal-demand priorities and anti-feedback settling remain. Fresh feedback loss and PV/load changes can stop the attempt early.

Only replace the four-output regulator Function. No live device actions were performed. Invalid input/error calls still emit diagnosis only: expiry is withdrawn on the next valid invocation, not by an independent hardware timer. Hardware effectiveness remains to be validated.

22 targeted offline tests pass. With the pulse disabled, replay of 5,324 historical executed invocations matches ZERO1; 66 rejected invocations remain diagnostic-only. Plant model V16 is unchanged.
