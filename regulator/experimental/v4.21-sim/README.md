# V4.21-SIM: daytime review and shared charging parameter selection

**English** | [Deutsch](README_DE.md)

The daytime log from 11 October 2026 contains almost 20 minutes of V4.19-SIM,
PV 134 to 846 W and discharge disabled throughout. All 579 outputs,
directions, HOLD states, parameter labels and integrators replay exactly.
Every discharge request is 0 W. After charging stops, the large load impulse
is intentionally supplied from the grid; it must not be treated as a request
to bypass the discharge lock.

Excluding the large impulse, mean grid power is −11.87 W and mean absolute
deviation from the effective charging midpoint is 25.01 W. The section
contains changing PV and is not a stationary night comparison. There are
only four points, eight seconds, above 720 W and no points above 1,050 W.

**V4.21-SIM is the next test candidate. Its own installation test is pending.**
Its basis is V4.20-SIM. The earlier night adjustment remains included and
is not field-validated by this log, whose PV stays above 50 W.

## Changes

Seven charging parameter branches now use one shared selection table;
their numerical P/I settings, status labels and PV windows are preserved.
The three already identical import-I sets use one configuration. Merging
low/normal-PV export values was simulated, did not improve every case and
was not adopted. High/very-high-PV settings remain separate.

There is one new behavior change: when discharge is disabled, reported PV
is above 50 W and charging is already the active direction, keep charging/
standby instead of switching into the prohibited discharge direction.
When house demand exceeds PV, the existing charge controller reduces to
0 W. After load removal, PV charging can be requested at the first available
controller tick. The discharge lock remains in force.

## Files

- [Complete Function source](Regler_V4_21_SIM.js)
- [Identical text copy for pasting](Regler_V4_21_SIM.txt)
- [Detailed daytime analysis, German](Regler_Tagesanalyse_DE.md)
- [Daytime model and limitations](Regler_Tagesmodell_V3.json)
- [Measured/simulated results](Regler_Tag_Ergebnisse.json)
- [Change and verification scope](Regler_Parameter.json)
- [Previous V4.20 night candidate](../v4.20-sim/README.md)

## Model and verification

Charging telemetry has a different offset from the night operation. The
daytime model accounts for that offset, separate grid response and relative
PV measurement phase. House power is a derived balance, not an independent
sensor. Negative relative PV phase is used only for offline reconstruction;
the controller never receives a future PV value. HTTP/ACK/application times
are still missing.

The nominal closed-loop grid trace has 18.97 W RMSE and reproduces window
time much less accurately than the night comparison. Detailed new P/I tuning
is therefore not independently validated. Across ten model cases, the
direction change reduces MAE to the permitted stationary target and export
energy. One case still has slower window recovery, 36 instead of 28 s.
Import energy can increase by up to 0.346 Wh and a positive secondary peak
by up to 20 W. Improvement of every peak is not guaranteed.

Ten test groups pass. The selection-only refactor preserves all four
messages across 1,687 points from the three correct logs. There are also
2,304 PV/window boundary combinations and energy-saving, SOC/OFF, snapshot,
grid-charge and output tests. These checks do not field-validate strong PV.

![Daytime measurements](Regler_Tag_Messdaten.svg)

![Daytime model and next candidate](Regler_Tag_Modell.svg)

## Test in Node-RED

1. Back up the existing Function.
2. Paste the complete `.txt` or `.js`; keep four outputs and existing wiring.
3. With discharge disabled, repeat the approximately 1 kW load impulse.
   All discharge requests must remain 0 W.
4. After load removal, compare charging restart, opposite peaks and import/
   export energy. Grid import while charging is intentionally stopped is
   not a demand for battery discharge.
5. Obtain longer sections above 720 and 1,050 W and actual command/response
   timestamps before further tuning these PV regions.

A private reproduction package contains the three correct logs and analysis
scripts. Raw logs and installation exports are not published. Regulator
revisions are separate from efficiency release v5.1.0.
