# SolarFlow Controller

**English** | [Deutsch](README_DE.md)

Node-RED battery efficiency monitoring for SolarFlow installations. **Release v5.1.0** adds a time-weighted rolling 7-day mean of the existing SOC-adjusted 168-hour energy balance. The smoother value is available on output 1, the original balance on output 2 and diagnostics on output 3. This repository supplies the monitoring component; the installation-specific regulator and snapshot builder are not included.

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

The old counter-based files are preserved in [v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency); the current tree contains the power-based implementation only.

See [release notes](RELEASE_NOTES.md), [change history](CHANGELOG.md) and [contributing](CONTRIBUTING.md).

## Scope and license

The result is a calculated SOC-adjusted energy balance, not a certified full-cycle efficiency measurement. SOC quantization, BMS recalibration, timing and excluded data affect accuracy. See the detailed [calculation limitations](rolling-efficiency/README.md) and [scope and warranty](DISCLAIMER.md).

Independent community project; no affiliation with or endorsement by Zendure. See [project notice](NOTICE.md). The [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) is maintained separately.

[MIT License](LICENSE) · [German license explanation](LICENSE_DE.md)
