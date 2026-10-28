> 28.10.2026: [Live-Validierung Logs28/29](regulator/experimental/v4.33-sim/Analyse_Logs28_29_DE.md): Ruhekompensation bestätigt, Entladeübernahme sofort;1195 ausgeführte Aufrufe exakt reproduziert. CodeV4.33-SIM-IDLE3 und ModellV16 unverändert.

> 28.10.2026: [V4.33-SIM-IDLE3](regulator/experimental/v4.33-sim/README_DE.md): laufende Batterienull-Nachregelung statt Zehn-Minuten-Prüfung. Neuer Zusatzauftrag = bisheriger Auftrag minus gemessene Batterieleistung, nach Einschwingen/Medianfilter. Normale Leistungsanforderungen behalten Vorrang; PackState nur Diagnose. Nur Regler ersetzen.

> 28.10.2026: [V4.32-SIM-IDLE2](regulator/experimental/v4.32-sim/README_DE.md): dynamisch gemessene Ruhekompensation ohne Reserve, erneute0W-Messung alle zehn Minuten. PackState nur Diagnose; klare Anzeige für Prüfung/Kompensation/Ruhe0W. Nur Regler ersetzen.

> 28.10.2026: [V4.31-SIM-ZERO6-TEST](regulator/experimental/v4.31-sim/README_DE.md): PV-/Hausdeltas nur protokollieren. Log25 brach nach zehn Sekunden wegen +53 W Hausdelta ab, ohne regulären Leistungsbedarf. PackState-Test hält darüber hinaus; weiter ohne Timeout/Leistungsnullpunkt-Abbruch. Test beobachten, nur Regler ersetzen.

> 28.10.2026: [V4.30-SIM-ZERO5-TEST](regulator/experimental/v4.30-sim/README_DE.md): gezielter PackState-Test ohne 60-s-Frist und ohne Abbruch am Leistungsnullpunkt. Log24 brach bereits nach sechs Sekunden am Leistungsnullpunkt ab. Kleinen Startauftrag halten, übrige Vorränge beibehalten; Test beobachten. Nur Regler ersetzen.

> 28.10.2026: Aktuelle Testfassung [V4.29-SIM-ZERO4](regulator/experimental/v4.29-sim/README_DE.md): Restentladung + 5 W Reserve beim Start festhalten (−18 W → 23 W), PackState/Leistung als Rückmeldung, bis 60 Sekunden. Nur Regler ersetzen.

> 28.10.2026: Neue Testfassung [V4.28-SIM-ZERO3](regulator/experimental/v4.28-sim/README_DE.md): 5 W, PackState/Leistung als Rückmeldung, bis 60 Sekunden; 10 W separat konfigurierbar. Nur Regler ersetzen.

# SolarFlow Controller

**English** | [Deutsch](README_DE.md)

Node-RED battery efficiency monitoring for SolarFlow installations. **Release v5.1.0** adds a time-weighted rolling 7-day mean of the existing SOC-adjusted 168-hour energy balance. The smoother value is available on output 1, the original balance on output 2 and diagnostics on output 3. This repository supplies the monitoring component and a separate experimental regulator candidate. The snapshot builder remains installation-specific.

## Current controller: V4.27-SIM-ZERO2 (field-test candidate) and simulation model V16

**2026-10-28 — V4.27-SIM-ZERO2:** [Code and installation](regulator/experimental/v4.27-sim/README.md). One6W pulse after charging AC-mode confirmation and persistent negative battery power; at most two valid ticks, earlier stop on PackState transition or measured near-zero power.19 offline test groups pass. Hardware effect awaits field validation; replace controller only.

**2026-10-28 — V4.26-SIM-ZERO1:** [Code and installation](regulator/experimental/v4.26-sim/README.md). Active zero charge/discharge demand requests charging direction. No positive charging pulse. Ten targeted test groups and5,324 historical control invocations checked; zero-mode hardware response still needs field validation. Replace the controller Function only.

**2026-10-14 — Logs 21–23 / model V16:** [Analysis and tuning study](regulator/experimental/v4.25-sim/validation/log21-23/Log21_23_Analysis_EN.md). 1,775 exact control replays and 16 modifications evaluated in 3,048 closed-loop runs. V16 adds a locally validated telemetry-offset hypothesis. Pending-response observers and quiet-import trims are not promoted. **Controller remains V4.25-SIM-DIAG1; no code replacement needed.**

**Daytime logs17–20, model V15:** [Analysis and tuning](regulator/experimental/v4.25-sim/validation/log17-20/Log17_20_Analysis_EN.md). High/very-high PV and the large load step are now checked. 2,361 exact control replay decisions; 15 modifications evaluated in 2,440 conditional runs. New local daytime model and separate transition clocks; **controller stays V4.25-SIM-DIAG1, no code replacement required**.

**Field validation, 2026-10-13 — Logs15/16:** [Analysis and simulation](regulator/experimental/v4.25-sim/validation/log15-16/Log15_16_Analysis_EN.md). Log16 validates skip diagnostics in operation. Model V14 adds low-power dawn and discharge-to-charge modeling. 1,188 exact controller replay decisions; 1,001 conditional simulations; no parameter change adopted. Controller remains V4.25-SIM-DIAG1; no Function replacement needed.

**Diagnostics update, 2026-10-13:** [V4.25-SIM-DIAG1](regulator/experimental/v4.25-sim/DIAG1.md) reports every received two-second controller invocation, including snapshot skips and synchronous exceptions. Control outputs and protection thresholds retain their behaviour. Ten test groups, 1,395 unchanged offline control decisions and supplementary-data/Logger-V2 integration checked. Replace only the controller Function body.

The [current working baseline](regulator/experimental/v4.25-sim/README.md) includes high-PV control without window shifts, targeted fast discharge correction after load drops, and model V13 with charge-acceptance limits and full-standby startup. Logs12/13 provide 795 exact V4.25 controller replay records. [Changes since V4.23 and remaining tuning priorities](regulator/experimental/v4.25-sim/CHANGELOG.md) distinguish field evidence, local calibration and limitations. A physical optimum is not established. Efficiency component v5.1.0 remains separate.

## V4.21 field validation and simulation model V4

The [new field validation](regulator/experimental/v4.21-sim/validation-logs-3-4/README.md) checks 1,188 V4.21 records with PV 288–2,036 W and discharge disabled: no direction flip and immediate charging requests after all three load drops. The [complete code](regulator/experimental/v4.21-sim/Regler_V4_21_SIM.js) and [identical text copy](regulator/experimental/v4.21-sim/Regler_V4_21_SIM.txt) remain unchanged. [Simulation model V4](regulator/experimental/v4.21-sim/validation-logs-3-4/Regler_Modell_V4.json) adds matching receive times, a separate standby telemetry level and PV timing uncertainty; faster ramp trials were not adopted. Night behavior, allowed discharge and sustained high-PV charging remain outside this field validation. The [original daytime analysis](regulator/experimental/v4.21-sim/Regler_Tagesanalyse_DE.md) and [previous night analysis](regulator/experimental/v4.20-sim/README.md) remain available. Regulator revisions are separate from efficiency release v5.1.0.

## Support this project

If this project helps you, you can support its maintenance and further development:

[![Support on Ko-fi](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/krumpholzopensource)

Your support helps maintain, test and document this project and keep it freely available.

## Get started

1. Read the [installation and calculation guide](rolling-efficiency/README.md).
2. Provide the documented power snapshot and SOC context variables on the same flow tab. Power must be in watts: positive for charging, negative for discharging.
3. Configure battery capacity, power limits and persistent context storage. Import [flow.json](rolling-efficiency/flow.json), select your Home Assistant server and connect the existing timer after SOC capture.
4. Run only one efficiency calculation. Existing users should follow the upgrade instructions before replacing nodes.

The flow requires Node-RED, `node-red-contrib-home-assistant-websocket` and a working Home Assistant server connection. Both ha-sensor nodes receive numeric calculation payloads directly; no sensor-preparation Function is used. They require the [hass-node-red Companion integration](https://github.com/zachowj/hass-node-red), version 1.1.0 or newer, in Home Assistant. Importing a flow does not create its input measurements or the external snapshot builder. Daily charge/discharge energy sensors are no longer required. New installations begin calculating once enough valid charge energy is available; they do not wait seven days.

## Sensor wiring update, version unchanged

The current `main` branch uses the supplied simple sensor configuration: State = `msg.payload`, `%`, empty attributes/output properties and separate entity configurations. For an existing installation, import only [sensor-mean.json](rolling-efficiency/sensor-mean.json) and connect calculation output **1** directly to it. Keep the existing sensor on output **2**. See the [direct wiring](rolling-efficiency/WIRING.md).

Release version **5.1.0** and calculation revision **5.1** remain unchanged. The published `v5.1.0` tag and release downloads retain their original API-based snapshot; use the files on `main` linked here for the updated sensor wiring.

## Included

- Separate charge/discharge energy integration using actual sample times and signed power.
- Time-weighted 7-day mean of unrounded valid efficiency values, with persistent history and disclosed coverage.
- Rolling minute buffer, SOC correction, power/freshness checks and exclusion of uncertain intervals.
- Persistent history and one-time migration of compatible V3 buffers without modifying the original.
- Diagnostics with the latest ten exclusion episodes and their causes.
- Equivalent [English](rolling-efficiency/flow.json) and [German](rolling-efficiency/flow_DE.json) flows and instructions.

Release v5.1.0 contains calculation revision 5.1 and energy buffer schema 4, with an additive mean-history schema 1. Existing V4 energy and V5 mean buffers remain compatible. Mean history starts only if no prior mean buffer exists. The output order introduced by V5 requires rewiring when upgrading from V4.

## Upgrading from v5.0.0

Release v5.1.0 (calculation 5.1) keeps output 1 available from valid retained mean history during brief SOC/source failures. New collection pauses and old data still expires against the clock; failures contribute no zero or held samples. Replace the calculation, capture/watchdog and sensor paths together. Existing energy and mean histories remain. The default now requires the original SOC timestamp; a one-second-old observation is supported. Use the existing common timer, without adding another periodic timer. See the [wiring diagram](rolling-efficiency/WIRING.md).

## Upgrading from v4.0.0

Set the calculation Function to **three outputs**. Connect output 1 to the new mean sensor or an automation, move the existing efficiency sensor from output 1 to **output 2**, and move diagnostics from output 2 to **output 3**. Keep the flow tab, context stores and configured capacity. Update the capture/watchdog Function as described in the [guide](rolling-efficiency/README.md), so the watchdog warns diagnostics and clears only the original efficiency key. Retain the existing sensor and its Entity config, and add the new mean sensor on output 1. Both read State = msg.payload directly without preparation. Do not reset the energy buffer.

The mean becomes available after the first consecutive pair of valid efficiency samples. It initially covers less than seven days. `mean_window_complete` reports a fully covered 168-hour mean window; gaps reduce coverage. Smoothing does not remove systematic SOC errors or make the result a certified round-trip measurement.

## Upgrading from v3.3.0

Replace daily-counter requests with the snapshot input path described in the [guide](rolling-efficiency/README.md). Preserve the flow tab, context stores, capacity and existing buffer. Imported daily history is distributed uniformly within each historical day and expires progressively. It cannot reconstruct past two-second measurements.

The old counter-based files are preserved in [v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency); the current efficiency tree contains the power-based implementation only.

See [release notes](RELEASE_NOTES.md), [change history](CHANGELOG.md) and [contributing](CONTRIBUTING.md).

## Scope and license

The result is a calculated SOC-adjusted energy balance, not a certified full-cycle efficiency measurement. SOC quantization, BMS recalibration, timing and excluded data affect accuracy. See the detailed [calculation limitations](rolling-efficiency/README.md) and [scope and warranty](DISCLAIMER.md).

Independent community project; no affiliation with or endorsement by Zendure. See [project notice](NOTICE.md). The [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) is maintained separately.

[MIT License](LICENSE) · [German license explanation](LICENSE_DE.md)




