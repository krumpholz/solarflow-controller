# SolarFlow Controller v5.1.0

**English** | [Deutsch](RELEASE_NOTES_DE.md)

Release **5.1.0** contains calculation revision **5.1**, energy-state schema **4** and mean-state schema **1**. Compatible energy and existing V5 mean history remain intact.

## Changes since v4.0.0

- Add a persistent, time-weighted rolling **7-day mean** of unrounded valid percentages from the existing SOC-adjusted 168-hour balance. **Output 1 = mean, output 2 = original efficiency, output 3 = diagnostics.**
- Keep a valid retained mean available during short SOC/source failures. Pause collection and clear its interpolation baseline. Continue the clock-based window, remove expired intervals and disclose coverage, source validity and sample age. Never insert missing values as 0% or fabricate held-value coverage.
- Replace Companion sensors with preparation Functions and **standard Home Assistant API** state writes. No `hass-node-red` custom integration is needed. These are state-machine sensors without an entity-registry entry/unique ID; they are recreated on the next successful write after HA restart.
- Update SOC preparation: preserve the original timestamp, require it by default in the calculation, and use the existing common timer approximately one second later. Remove daily-counter queries. The imported Inject is manual only.
- Route the missing-measurement output to diagnostics. Its additional connection to the original sensor is optional; no warning wire goes to the mean sensor. The watchdog clears only the original efficiency key.
- Preserve signed-power integration, SOC correction, V3 migration and exclusion diagnostics. Resolve only floating-point overshoot within 1e-9 percentage points at exact 0/100% endpoints; genuine out-of-range values remain invalid.
- Provide **144 automated regressions**, German/English import flows, installation guides and wiring diagrams. GitHub Actions verifies Node.js 22/24 in UTC/Berlin and publishes the versioned release assets after successful main-branch tests.

## Upgrade

Replace calculation, SOC preparation and sensor paths together, following the [guide](rolling-efficiency/README.md) and [wiring](rolling-efficiency/WIRING.md). Set three calculation outputs and two preparation outputs. Configure battery capacity, power limits, original SOC timestamp and sensor entity IDs; select the existing HA server in both API nodes. Branch automations from calculation output 1 before API preparation. Preserve flow tab/context and run only one writer.

From V3/V4 energy-only history, the mean begins with new valid intervals. From the v5.0.0 development draft, both histories continue without reset. Mean startup needs two consecutive valid efficiency observations, not seven days. If all valid history expires, or state/configuration/runtime cannot be trusted, output 1 is unknown. Complete-window flags report actual covered intervals, not elapsed startup time.

The operator reported a live test of the replacement SOC-preparation node. Whole-flow Home Assistant operation and a seven-day hardware run are not claimed by the synthetic test suite. See [validation](rolling-efficiency/TESTING.md). Mean smoothing preserves systematic SOC/capacity errors and responds slowly to lasting changes because its source balance already spans seven days.
