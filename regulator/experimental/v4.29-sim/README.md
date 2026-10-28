# V4.29-SIM-ZERO4: measured residual discharge plus 5 W

See [German instructions and validation details](README_DE.md).

Replace the four-output regulator Function only. At attempt start, latch `min(100, ceil(max(0, -batteryW) + 5))` W: −18 W produces a 23 W charging request. Hold this value, rather than continually reducing it as its own feedback changes the measurement. No automatic escalation or repeated attempt in the same idle episode.

Previous gates, normal-demand/inhibit priorities and 60s deadline remain. A valid PackState discharge→charge/standby transition or earlier fresh battery power ≥−3 W ends the request, followed by an 8s zero settling phase. Invalid-input/error calls remain diagnostic-only: expiry is withdrawn on the next valid invocation, with no independent hardware watchdog.

Added start-power, reserve, cap and clamping diagnostics. New version context allows a new test after ZERO3. 27 offline tests pass. With the attempt disabled, 5,324 historical executed calls match ZERO1 and 66 rejected calls remain diagnostic-only. The additive offset response is a test hypothesis, not hardware validation. Check whether residual discharge stays cleared after withdrawal. Plant model V16 is unchanged.
