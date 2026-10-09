# Changelog

**English** | [Deutsch](CHANGELOG_DE.md)

## v5.1.0 — 2026-10-09

- Keep output 1 available from valid retained mean history during brief SOC/source failures. Pause new collection, clear its interpolation baseline and continue clock-based 168-hour expiry without zero or held-value samples.
- Separate mean validity from current source validity and expose collection status, last valid interval and sample age. Unknown, expired or untrusted history remains unknown.
- Replace Companion sensor/entity nodes with normal Home Assistant API state writes and explicit preparation Functions. No `hass-node-red` custom integration is required. Publish `%`, measurement class, coverage and source diagnostics.
- Update SOC preparation to preserve the original timestamp and clear only the original efficiency key on watchdog timeout. Warning output goes to diagnostics; its connection to the original sensor is optional. Use the existing common timer after the one-second SOC delay; the import adds only a manual test Inject.
- Require SOC timestamps by default. Keep release version **5.1.0**, calculation revision **5.1**, energy schema **4** and mean schema **1** distinct; retain compatible energy and V5 mean buffers.
- Expand both-language regressions to **144 tests**, update German/English installation and wiring guides, and publish versioned release assets after successful main-branch CI.

## v5.0.0 — development draft, not released (2026-10-09)

- Add a time-weighted rolling **7-day mean** of unrounded valid SOC-adjusted efficiency values. Actual elapsed time determines weights; invalid samples and measurement gaps do not contribute.
- **Breaking output order:** output 1 = mean, output 2 = original efficiency, output 3 = diagnostics. Import flows include a separate HA mean sensor and clear both sensors on watchdog timeouts.
- Retain the existing V4 energy history, V3 migration marker and exclusion diagnostics. Add bounded persistent minute aggregates for the mean; do not invent pre-upgrade percentage history.
- Expose mean coverage, startup history, window completeness and the partial-minute boundary approximation. Keep the original energy balance and SOC correction formula.
- Fix machine-precision overshoot at the algebraic 0/100% boundaries with a 1e-9 percentage-point tolerance; actual out-of-range values remain invalid.
- Add mean, restart, migration, DST, output-order and graph regression coverage, plus GitHub Actions checks in UTC and Europe/Berlin. English/German code and flows remain generated from one calculation source.

## v4.0.0 — 2026-09-23

- Rolling **168 hours** replaces the seven-calendar-day window. Old data leaves gradually instead of removing a whole day at midnight.
- Charge and discharge energy is integrated from measured signed battery power using actual timestamps, including direction changes. Daily energy counters are no longer inputs.
- Persistent minute aggregates retain history across restarts. Compatible V3 history is imported once; existing V4 buffers continue unchanged.
- New users receive a result after sufficient valid charge energy has accumulated, without waiting seven days.
- The latest ten exclusion episodes explain rejected data, their duration, causes and measured limits.
- English/German installation guides and flows are aligned. Superseded V3 runtime files and build dependencies have been removed from the current tree; v3.3.0 remains available.

## v3.3.0 — 2026-09-22

Initial release: SOC-adjusted daily charge/discharge counter calculation over seven local calendar days, persistent V3 buffer, and English/German flows.
