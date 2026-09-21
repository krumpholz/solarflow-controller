# SolarFlow Controller

**English** | [Deutsch](README_DE.md)

Node-RED tools for SolarFlow battery systems and Home Assistant.

> Independent, unofficial community project. Not affiliated with, sponsored by, certified by, or endorsed by Zendure.

## Available component

The repository provides a **seven-day SOC-adjusted battery efficiency flow**, in English and German. It calculates an energy balance from daily charging/discharging counters and battery state of charge, retains its measurement state across restarts, and publishes a percentage to Home Assistant.

**Start here:** [Installation and calculation guide](round-trip-efficiency/README.md) · [English flow](round-trip-efficiency/flow.json) · [German flow](round-trip-efficiency/flow_DE.json)

The supplied flow monitors efficiency; it sends no battery control commands. A charge/discharge and grid-power regulator is not included in this repository.

## Requirements

- Home Assistant and Node-RED with the Home Assistant websocket nodes.
- Separate daily charge and discharge energy counters in kWh.
- Battery SOC in percent, supplied on the same Node-RED flow tab.
- Configured battery capacity, power limits, timezone and persistent context stores.
- The Home Assistant Node-RED companion integration for the result sensor.

The [component guide](round-trip-efficiency/README.md) lists every external input and explains how to create the energy sensors, supply SOC and configure the output. Input sensors are not created by importing the flow. New installations start from their first valid measurement pair and do not require a full seven-day buffer before displaying a result.

## Related BLE project

The [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) provides a separate local communication interface. Its firmware and installation instructions are maintained in that repository. This efficiency flow can use measurements from it or another suitable source with matching units and measurement boundaries.

## Scope and interpretation

The result uses measured energy counters and a capacity-based SOC correction. SOC resolution, BMS recalibration, source timing and missing intervals affect accuracy. It is not a certified AC-to-AC round-trip measurement. See the calculation guide and [scope and warranty notes](DISCLAIMER.md).

## Repository guide

| Location | Contents |
| --- | --- |
| [round-trip-efficiency](round-trip-efficiency/README.md) | Flow, Function sources, setup and calculation documentation |
| [Energy sensor example](round-trip-efficiency/examples/home-assistant-energy.yaml) | Optional HA configuration from signed battery power to daily kWh counters |
| [CHANGELOG.md](CHANGELOG.md) | Revision history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Issues, contributions and developer instructions |
| [NOTICE.md](NOTICE.md) | Independent-project and trademark notice |
| [DISCLAIMER.md](DISCLAIMER.md) | Scope, measurement limitations and warranty |
| [LICENSE](LICENSE) | MIT license |

## License

Released under the [MIT License](LICENSE). Product names belong to their respective owners and describe compatibility only. See [NOTICE.md](NOTICE.md).
