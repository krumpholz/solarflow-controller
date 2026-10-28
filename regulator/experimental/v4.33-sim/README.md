# V4.33-SIM-IDLE3: continuous measured battery-zero tracking

[German installation and validation details](README_DE.md)

Remove IDLE2's ten-minute forced-zero probe. At regular0/0W demand, with confirmedAC1 and fresh battery feedback, update the supplementary charging request using `clamp(round(previousRequest - medianBatteryPower), 0, 100)`. No reserve/deadband; integer-watt resolution. Hold the last request while settling8s after an actual change and collecting four fresh cycle measurements. At zero feedback keep the request. If the underlying idle drain disappears, positive measured power reduces it naturally to zero. PackState is observation only and may not change.

Every positive ordinary charge/discharge demand, OFF, forced-grid charge and existing inhibits retain immediate priority. Keep supplementary actuation out of normal PI memory. Fresh valid IDLE2 context may migrate once without a zero interruption; otherwise start from0 and measure. A data gap resets sampling/settling while retaining the current supplementary request. Invalid-input/error calls remain diagnostic-only; no autonomous device watchdog.

Only replace the four-output regulator Function. No BLE/direction/logger changes.22 targeted tests pass, including a synthetic delayed plant following offset changes18→15→24→0. Log27 steady-section replay reproduces289 executed power requests and one diagnostic-only rejection; the old forced-zero probe is excluded from the fixed-input comparison. With compensation disabled,5,324 historical executed calls match ZERO1 and66 rejected calls remain diagnostic-only. Hardware drift tracking pending; modelV16 unchanged.
