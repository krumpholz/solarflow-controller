# Scope and warranty

**English** | [Deutsch](DISCLAIMER_DE.md)

SolarFlow Controller is an unofficial community project. It is not affiliated with, sponsored by, certified by, or endorsed by Zendure. Product names and trademarks belong to their respective owners.

The component currently supplied in this repository calculates battery efficiency. It reads measurements and publishes a Home Assistant sensor; it does not issue charging, discharging, power-limit or operating-mode commands.

The result depends on power-measurement accuracy, measurement boundaries, configured battery capacity, SOC estimation, BMS recalibration, source timing and excluded intervals. It is not a certified efficiency measurement and does not guarantee a particular energy saving or self-consumption level. The component README explains its formula and data handling.

Users are responsible for matching inputs, units, capacity, power limits, timezone and persistent storage to their installation. The monitoring flow does not replace manufacturer protection functions, the battery management system or certified grid protection. Any separate automation that uses its output must handle Unknown and unavailable data appropriately.

The software is provided without warranty under the [MIT License](LICENSE).
