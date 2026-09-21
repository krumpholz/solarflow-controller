# Disclaimer

**English** | [Deutsch](DISCLAIMER_DE.md)

This is an unofficial community project for automated battery and grid-power control.

It is not affiliated with, sponsored by, certified by, or endorsed by Zendure. Product names and trademarks belong to their respective owners.

Controller software can send charging, discharging, power-limit, and operating-mode commands to an energy-storage system. Users are responsible for verifying that configured limits and modes are appropriate for their own hardware, installation, electrical system, local rules, and vendor requirements.

The controller does not replace manufacturer protection functions, the battery management system, or certified grid protection. A grid-power target does not guarantee zero import or export, uninterrupted power, or a particular level of self-consumption.

Incorrect measurements, stale data, communication failures, firmware changes, or conflicting automations may cause unexpected behavior. Verify startup, shutdown, communication loss, and recovery in the actual installation. Stopping the controller does not necessarily clear the last command accepted by the battery.

The repository's initial documentation does not constitute a tested controller release. Compatibility and validation must be assessed for the specific published version and installation.

The software is provided without warranty. See [LICENSE](LICENSE).

