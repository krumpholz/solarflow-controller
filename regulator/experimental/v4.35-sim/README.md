# V4.35-SIM-IDLE5-NET60-HOLD60

[German instructions and validation](README_DE.md)

Latch a request targeting actual battery+60W: `clamp(round(previousPreparedChargeRequest + 60 - freshBatteryPower),0,batt_power_max)`. Examples: C0/B−24→84W; C24/B0→84W; old C60/B36→84W. Preserve this amplitude throughout the attempt. Prepared request is not a device ACK; the local additive response and settled start measurement are assumptions to validate.

Wait up to60s for the first valid PackState2→1/0 transition. If observed before the deadline, hold the same request for another60s from observation. Do not restart this timer on further transitions. No transition: return to continuous zero tracking after60s. Thus total duration is up to just under120s on success. Standby also receives the requested hold; its fallback is zeroed for handover after completion.

Every positive normal charging/discharging demand and existing inhibits retain immediate priority. Invalid-input/error calls remain diagnostic-only: expiry is withdrawn on the next valid invocation, not by a hardware watchdog. No automatic repeated attempt in the same idle episode. Preserve and pause ordinary compensation feedback throughout the pulse, settle8s before resuming it. Fresh IDLE4 fallback and actual prepared reference can migrate independently.

Only replace the four-output regulator Function. Existing BLE/direction/logger nodes remain.44 tests pass; kick-disabled Log28/29 replay reproduces1195 executed calls and four diagnostic rejections. Full-feature-disabled replay matches5324 historical executions and66 rejections. Active hardware response pending, modelV16 unchanged.
