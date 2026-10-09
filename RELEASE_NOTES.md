# SolarFlow Controller v5.1.0

**English** | [Deutsch](RELEASE_NOTES_DE.md)

Release **5.1.0** contains calculation revision **5.1**, energy-state schema **4** and mean-state schema **1**. Compatible energy and existing V5 mean history remain intact.

## Current main sensor adjustment, version unchanged

The current imports use the supplied simple **ha-sensor** configuration directly: State = `msg.payload`, unit `%`, empty attributes/output properties, disabled resend/debug and separate Entity configs. Output **1** connects to the mean sensor, **2** to the existing sensor and **3** to diagnostics. API nodes and sensor-preparation Functions have been removed. These sensors require `hass-node-red` Companion integration **1.1.0+** in HA.

For an existing installation, import only [sensor-mean.json](rolling-efficiency/sensor-mean.json), select the existing server in its Entity config and connect calculation output 1. Retain the original sensor/Entity config on output 2. See the [guide](rolling-efficiency/README.md) and [direct wiring](rolling-efficiency/WIRING.md).

This configuration/documentation correction does not change VERSION, calculation revision, calculation/capture code or persisted history. The published `v5.1.0` tag and existing release downloads retain their original API-based snapshot. Updated files are on `main`; no tag or historical asset is replaced.

## Calculation changes since v4.0.0

- Add a persistent, time-weighted rolling **7-day mean** of unrounded valid percentages from the existing SOC-adjusted 168-hour balance. **Output 1 = mean, output 2 = original efficiency, output 3 = diagnostics.**
- Keep a valid retained mean available during short SOC/source failures. Pause collection and clear its interpolation baseline. Continue clock-based expiry; disclose coverage, source validity and sample age. Missing values never become 0% or held-value coverage.
- Preserve the original SOC timestamp and require it by default. Use the existing common timer approximately one second later. No daily-counter queries or additional repeating timer; imported Inject is manual only.
- Route missing-measurement warnings to diagnostics, optionally also to the original sensor. No warning wire goes to the mean; the watchdog clears only the original efficiency key.
- Preserve signed-power integration, SOC correction, V3 migration and exclusion diagnostics. Resolve only floating-point overshoot within 1e-9 percentage points at exact 0/100% endpoints; genuine out-of-range values remain invalid.
- Provide **144 automated regressions**, German/English import flows, sensor-only imports, installation guides and wiring diagrams. GitHub Actions checks Node.js 22/24 in UTC/Berlin. New versions are released after successful main tests; an existing release is left intact.

## Upgrade and validation

Retain flow tab, context stores, capacity and both histories; use one calculation writer. V3/V4 energy-only history cannot reconstruct previous mean samples. A new mean needs two consecutive valid efficiency observations, not seven days. Missing, expired or untrusted mean history produces null; complete-window flags describe measured coverage rather than elapsed startup time.

The operator reported a live test of the replacement SOC-preparation node. The synthetic suite does not claim an authenticated HA sensor test or seven-day hardware run. See [validation](rolling-efficiency/TESTING.md). Mean smoothing preserves systematic SOC/capacity errors and reacts slowly to lasting changes because its source balance already spans seven days.
