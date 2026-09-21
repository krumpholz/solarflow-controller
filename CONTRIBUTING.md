# Contributing

Contributions to SolarFlow Controller are welcome.

## Issues

For a reproducible problem, include:

- The controller commit or release, once available.
- Node-RED, Home Assistant, and relevant integration versions.
- Battery model and firmware version.
- Expected and actual behavior.
- A short, sanitized log covering grid power, PV power, battery power, SOC, and requested/reported operating modes when relevant.

Include units, sign conventions, and sampling intervals. Do not publish passwords, access tokens, private keys, device identifiers, or personal network details.

## Changes

Keep changes focused and explain their effect on control behavior. For changes to the control logic, describe the scenarios checked, including relevant limit conditions and failure recovery. Clearly distinguish static checks, simulations, and hardware tests.

Preserve the independent-project notice and existing copyright notices. Contributions are provided under this repository's MIT license.

## Sharing Node-RED flows

Review the complete exported JSON before committing it. Remove credentials, installation-specific server settings, private URLs, and identifiers. Use clearly marked placeholders where configuration is required.

Do not include live Node-RED credential files or runtime state.
