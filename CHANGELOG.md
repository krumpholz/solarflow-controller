# Changelog

**English** | [Deutsch](CHANGELOG_DE.md)

## Unreleased

### Changed

- Remove the appended estimate label from Function status in both languages; document calculation, partial-buffer startup and interpretation. Calculation revision remains 3.2.

- Calculation revision 3.2: persistent bounded energy allowances for delayed/rounded HA updates (2400 W, 20% reserve, 120-second reporting allowance, 0.1 kWh assumed resolution). Hold anomalous increments without losing the accepted baseline; distinguish real observation outages, verify resets, allow SOC timestamps up to 120 seconds. Preserve existing history. 55 regression tests per language plus three localization checks passed.

- Calculation revision 3.1 restores window-endpoint SOC correction for legacy history while preserving new intervals and existing migrated state. Explicit historical uncertainty diagnostics. 44 regression tests per language and three localization checks passed.

- Preserve existing efficiency history through one-time v2 ring/live-day/snapshot migration, a full original-data backup, and duplicate/overlap protection.
- Extend the regression suite to 41 passing tests, including restart-safe migration.

### Added

- Separate German flow alternative with original node names, translated status/error messages and reproducible generation from the English core; 85 passing test executions across both languages and localization checks.

- Full German translations of the project overview, setup and migration guide, validation report, and supporting project documentation, with reciprocal language links.

- Version 3 of the SOC-adjusted efficiency monitoring utility: paired measurements, interval-based energy/SOC accounting, automatic persistent state, conservative reset/gap handling, and explicit invalid results.
- Importable English Node-RED monitoring flow, setup instructions, and simulated-context regression tests.
- Preserved the original text-file download path with the updated Function body; a complete flow upgrade is required.

- Initial English README describing project scope and current publication status.
- MIT license, matching the license choice of the related BLE controller.
- Independent-project, trademark, and operating-responsibility notices.
- Contribution guidance and exclusions for local secrets and generated files.

The controller flow has not yet been published in this repository.


