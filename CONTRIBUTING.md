# Contributing

**English** | [Deutsch](CONTRIBUTING_DE.md)

Contributions to SolarFlow Controller are welcome.

## Issues

For a reproducible problem, include:

- The repository commit and calculation revision.
- Node-RED, Home Assistant, and relevant integration versions.
- Battery model and firmware version.
- Expected and actual behavior.
- A short, sanitized diagnostic log, the relevant charge/discharge counter states, SOC and timestamps.

Include units, sign conventions, and sampling intervals. Do not publish passwords, access tokens, private keys, device identifiers, or personal network details.

## Changes

Keep changes focused and explain their effect on calculation, state compatibility and input handling. Use synthetic data in examples and regression fixtures.

Preserve the independent-project notice and existing copyright notices. Contributions are provided under this repository's MIT license.

## Sharing Node-RED flows

Review the complete exported JSON before committing it. Remove credentials, installation-specific server settings, private URLs, and identifiers. Use clearly marked placeholders where configuration is required.

Do not include live Node-RED credential files or runtime state.


## Developer maintenance

The regression sources live in `round-trip-efficiency/tests/`. Run from the repository root with Node.js:

```sh
TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
EFFICIENCY_LANGUAGE=de TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
node --test round-trip-efficiency/tests/localization.test.cjs
```

Edit the English Function sources and synchronize their copies in `flow.json` and the calculation text download. Run `python round-trip-efficiency/build-german-flow.py` to regenerate the German sources and export. Preserve both languages and the existing state schema unless an explicit compatibility change is documented. Simulation coverage does not certify measurement accuracy.
