# SolarFlow – Dynamic Battery and Grid Power Controller

**English** | [Deutsch](README_DE.md)

Node-RED controller project for SolarFlow battery systems, integrating Home Assistant measurements and battery controls to manage charging, discharging, and grid power.

> Independent, unofficial community project. Not affiliated with, sponsored by, certified by, or endorsed by Zendure.

## Project status

The repository includes a [seven-day SOC-adjusted battery efficiency monitoring flow](round-trip-efficiency/README.md), its English and German setup documentation, and automated regression tests. This monitoring utility does not issue battery control commands and has not yet been validated in a live installation.

The main Node-RED charge/discharge controller has not yet been published here.

## Purpose

The controller is intended to increase PV self-consumption and keep measured grid power close to a configurable target around zero. Its design focuses on stable operation during changing household demand and solar production.

The intended control scope includes:

- Charging from available PV surplus.
- Discharging to cover household demand within configured power and state-of-charge limits.
- A configurable grid-power window with a stable hold state.
- Controlled power ramps and confirmed direction changes to reduce oscillation.
- Response to sudden load increases and falling PV production.
- Measurement freshness checks and monitoring of requested versus reported battery mode.

These points describe the project scope. Release-specific behavior, defaults, supported hardware, and validation results will be documented alongside the published flow. Near-zero grid power is a control objective, not a guarantee of zero import or export.

## System overview

| Component | Role |
| --- | --- |
| Grid meter and PV measurements | Provide feedback for the control loop. |
| Home Assistant | Exposes measurements and battery control entities. |
| Node-RED | Runs the control logic and calculates power and mode requests. |
| Battery communication integration | Delivers requests to the battery system and reports device state. |
| SolarFlow battery system | Executes supported commands within its device limits. |

The related [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) provides a local BLE communication interface. This repository is for the higher-level energy control logic. The BLE firmware is maintained in its own repository.

## Intended environment

- Node-RED and Home Assistant.
- Grid-power, PV-power, and battery-power measurements with known units and sign conventions.
- Battery state-of-charge and operating-state feedback.
- A compatible interface for charge/discharge limits and operating modes.

Exact dependencies, entity mappings, supported versions, and import instructions will accompany the first flow release. Existing installations need their own entity mapping and parameter review.

## Power conventions

The intended normalized convention for the controller is:

| Measurement | Positive | Negative |
| --- | --- | --- |
| Grid power | Import from the grid | Export to the grid |
| Battery power | Charging | Discharging |

PV generation is represented as non-negative power in watts. Source integrations may use different conventions; verify and normalize their values before enabling control.

## Operating notes

Review [DISCLAIMER.md](DISCLAIMER.md) before using controller code when it becomes available.

- Keep manufacturer protection functions and hardware limits in effect.
- Check measurement direction, units, timestamps, power limits, and SOC limits for the actual installation.
- Avoid conflicting control commands from multiple automations or applications.
- Validate startup, communication loss, stale measurements, and recovery behavior before unattended use.
- Disabling an automation or losing communication must not be assumed to reset the battery's last accepted command.

This project does not provide certified grid protection or replace the battery management system.

## Repository files

| File | Purpose |
| --- | --- |
| [round-trip-efficiency](round-trip-efficiency/README.md) | SOC-adjusted efficiency monitoring flow and tests |
| [LICENSE](LICENSE) | MIT license |
| [NOTICE.md](NOTICE.md) | Independent-project and trademark notice |
| [DISCLAIMER.md](DISCLAIMER.md) | Scope, operating responsibility, and warranty disclaimer |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution and issue guidance |
| [CHANGELOG.md](CHANGELOG.md) | Published repository changes |
| [.gitignore](.gitignore) | Excludes common local secrets and generated files |

## Contributing

Bug reports, documentation improvements, and contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Remove credentials and personal installation data from all shared flows and logs.

## License and independence

Released under the [MIT License](LICENSE).

Zendure, SolarFlow, and other product names belong to their respective owners and are used only to describe compatibility and interoperability. No affiliation or endorsement is implied. See [NOTICE.md](NOTICE.md).


