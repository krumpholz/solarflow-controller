# SolarFlow Controller

**English** | [Deutsch](README_DE.md)

Node-RED battery efficiency monitoring for SolarFlow installations. **Release v4.0.0** calculates an SOC-adjusted energy balance over a rolling 168-hour window from measured battery power. This repository supplies the monitoring component; the installation-specific regulator and snapshot builder are not included.

## Get started

1. Read the [installation and calculation guide](rolling-efficiency/README.md).
2. Provide the documented power snapshot and SOC context variables on the same flow tab. Power must be in watts: positive for charging, negative for discharging.
3. Configure battery capacity, power limits and persistent context storage. Import [flow.json](rolling-efficiency/flow.json), select your Home Assistant server and connect the snapshot trigger.
4. Run only one efficiency calculation. Existing users should follow the upgrade instructions before replacing nodes.

The flow requires Node-RED, `node-red-contrib-home-assistant-websocket`, and the Home Assistant Node-RED Companion integration for the output sensor. Importing a flow does not create its input measurements or the external snapshot builder. Daily charge/discharge energy sensors are no longer required. New installations begin calculating once enough valid charge energy is available; they do not wait seven days.

## Included

- Separate charge/discharge energy integration using actual sample times and signed power.
- Rolling minute buffer, SOC correction, power/freshness checks and exclusion of uncertain intervals.
- Persistent history and one-time migration of compatible V3 buffers without modifying the original.
- Diagnostics with the latest ten exclusion episodes and their causes.
- Equivalent [English](rolling-efficiency/flow.json) and [German](rolling-efficiency/flow_DE.json) flows and instructions.

Release v4.0.0 contains calculation revision 4.1 and buffer schema 4. These numbers describe different things. Existing V4 buffers remain compatible.

## Upgrading from v3.3.0

Replace daily-counter requests with the snapshot input path described in the [guide](rolling-efficiency/README.md). Preserve the flow tab, context stores, capacity and existing buffer. Imported daily history is distributed uniformly within each historical day and expires progressively. It cannot reconstruct past two-second measurements.

The old counter-based files are preserved in [v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency); the current tree contains the power-based implementation only.

See [release notes](RELEASE_NOTES.md), [change history](CHANGELOG.md) and [contributing](CONTRIBUTING.md).

## Scope and license

The result is a calculated SOC-adjusted energy balance, not a certified full-cycle efficiency measurement. SOC quantization, BMS recalibration, timing and excluded data affect accuracy. See the detailed [calculation limitations](rolling-efficiency/README.md) and [scope and warranty](DISCLAIMER.md).

Independent community project; no affiliation with or endorsement by Zendure. See [project notice](NOTICE.md). The [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) is maintained separately.

[MIT License](LICENSE) · [German license explanation](LICENSE_DE.md)
