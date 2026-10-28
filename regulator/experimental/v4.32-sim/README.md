# V4.32-SIM-IDLE2: measured idle compensation, recheck every ten minutes

[German instructions](README_DE.md) · [Log26 findings](Analyse_Log26_DE.md)

Replace the PackState-switch attempt with dynamic offset measurement. At ordinary0/0W demand, confirmedAC1 and fresh battery input, command0W, wait8s and take four distinct fresh cycle measurements. Use their median to derive a rounded, nonnegative charging compensation, capped100W, with no reserve/deadband. Hold the result without chasing its own feedback. After600s start another zero-request probe; if the unassisted battery now measures0W, remove compensation. Typical zero-request probe duration is14s at2s intervals. Measurement gaps restart settling; normal demand takes precedence immediately, including small positive charging requests.

No fixed18W constant. No PackState completion. Preserve normal inhibit/forced-charge/discharge priorities and diagnostic-only invalid-input/error behaviour. No autonomous timer when valid calls stop: periodic probing occurs on the next valid invocation. Ordinary controller memory stays separate from compensation.

Status now distinguishes idle probing, compensation and zero-power idle; retain original logical mode separately. Only replace the four-output regulator Function; no logger/direction-node replacement needed.

23 offline tests pass, including a synthetic delayed-offset closed-loop scenario and periodic removal/re-estimation. With compensation disabled,5,324 historical executed calls match ZERO1;66 rejected calls remain diagnostic-only. Hardware calibration/probe timing remain to be validated; existing plant modelV16 unchanged.
