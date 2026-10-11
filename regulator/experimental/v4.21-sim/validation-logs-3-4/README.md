# V4.21 field validation and simulation model V4

**English** | [Deutsch](README_DE.md)

Two new installation logs from 11 October 2026 contain unchanged V4.21 code:
12:24–12:44 Europe/Berlin with PV 501–2,036 W, and 13:04–13:24 with PV 288–628 W.
Discharge remains disabled throughout. Every discharge request is zero and
charging/standby direction is retained. All three observed load drops resume
a charging request in the first available controller tick. In the quieter log,
three consecutive window samples begin after 18 and 12 seconds.

This validates the direction change under these conditions. It does not
validate the night adjustment, allowed discharge or sustained very-high-PV
charging: most high-PV samples occur during high house load with charging
stopped. The first solar section of the quieter log has mean −4.53 W,
MAE 12.41 W to its +5 W midpoint and 38.02% window time. Intended imports
while discharge is locked are evaluated separately.

## Model improvements

- Matching snapshot receive times and a correctly initialized HOLD/I state;
  the stale additional snapshot in the first row of each new log is isolated.
- A separate −18 W standby telemetry level from 37 training samples excluding
  log 4. Log-4 battery-model MAE falls from 1.62 to 1.22 W; active dynamics
  barely change. Existing nominal actuator responses are retained.
- A newly calibrated relative PV phase and zero-phase/separate-string
  alternatives. Later checking RMSE falls from 87.81 to 62.32 W relative to
  the previous phase, while zero phase gives 59.86 W. Measurement timing
  and real house-load uncertainty therefore remain.
- Asymmetric windows also when PV class changes, and the permitted stationary
  target range while discharge is disabled.

Negative relative PV phase is used only for offline reconstruction. The
controller never receives future PV. House load is a derived balance rather
than an independent sensor; send/ACK/application timestamps remain absent.
Closed replay uses a reconstructed net disturbance fixed across variants,
and is not independent solar/load forecasting.

## Parameters remain unchanged

Larger unconfirmed PV increases improve the fast log but can add up to
105 W to a positive counter-spike in the model. A 90 W charging-up ramp
worsens the earlier and quieter logs. Both remain diagnostic trials and
produce no new controller version. A natural daytime optimization limit
has not been established.

## Files and checks

- [Detailed analysis in German](Regler_V4_21_Feldvalidierung_DE.md)
- [Model V4, limitations and alternative fits](Regler_Modell_V4.json)
- [Aggregate measurement/simulation results](Regler_V4_21_Validierung_Ergebnisse.json)
- [Verification result](verification.json)
- [Unchanged complete V4.21 code](../Regler_V4_21_SIM.js)

Eight additional check groups pass: 1,767 exact code comparison samples,
including 1,188 V4.21 field samples; 30 closed replays and 45 diagnostic trials
retain output bounds and the discharge lock. Python and JavaScript produce
the same 591 unrounded battery responses. A private package contains the
three correct daytime logs and executable reproduction. Raw logs and plant
exports are not published. Efficiency release v5.1.0 and regulator code
remain unchanged.

![Field validation](Regler_V4_21_Feldvalidierung.svg)

![Model checks](Regler_Modell_V4_Pruefung.svg)
