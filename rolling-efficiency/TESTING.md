# Calculation review and automated validation

**English** | [Deutsch](TESTING_DE.md)

## Reviewed energy balance

The existing signed-power integration, separate zero-crossing triangles, actual time differences, SOC delta sign and kWh conversion remain in place. Example: 2,400 W for two seconds contributes 0.001333333 kWh. The underlying formula remains `100 × (discharged_kWh + stored_energy_delta_kWh) / charged_kWh`; the new output averages that formula's valid percentages rather than introducing another energy-balance formula.

Matching energy/SOC intervals, exclusions, duplicate handling, persisted buffers and V3 migration are covered by the existing regression cases. Nominal capacity and measured SOC remain assumptions: a mean cannot recover the actual energy content of the battery or eliminate systematic BMS bias. The result is an SOC-adjusted balance, not a certified cycle measurement.

A new endpoint regression reproduced a false rejection in the previous calculation: binary floating-point SOC subtraction could produce a tiny overshoot at a mathematically exact 100% result. The correction resolves overshoot within 1e-9 percentage points at 0/100. Separate tests still reject genuine out-of-range values. The charging-energy threshold remains 0.1 kWh.

## Run locally

No third-party test dependencies are required. Use Python 3 to regenerate wrappers/flows and Node.js with the built-in test runner (CI: versions 22 and 24):

```sh
python3 rolling-efficiency/build.py
TZ=UTC node --test rolling-efficiency/tests/*.test.cjs
TZ=Europe/Berlin node --test rolling-efficiency/tests/*.test.cjs
```

Run from the repository root. After generation, `battery-efficiency_DE.js`, `prepare-cycle_DE.js`, `prepare-sensor_DE.js`, `flow.json` and `flow_DE.json` must match the committed files. The GitHub Actions workflow checks this before testing. Both language variants execute the same canonical calculation body.

## Mean and integration regressions

The suite contains **144 tests**, including the original 70 cases. It exercises both languages with synthetic data and an in-memory mock of Node-RED context.

| Area | Evidence checked |
| --- | --- |
| Time weighting | 80→84% for 2 s and 84→76% for 8 s yields 80.4%; subdividing the same linear trace leaves its integral unchanged |
| Precision and boundaries | Unrounded source percentages enter the mean; 0% is a valid sample; exact 0/100 endpoints remain valid while actual overshoot is excluded |
| Minute splitting | Linear percentage-time integral is conserved across a minute boundary |
| Invalid data | Fallback, SOC jumps and out-of-range efficiency add no mean duration; null is not treated as zero |
| Failures and recovery | Mean remains available from retained history while original output clears; no held/zero interval is inferred across a gap |
| Startup and upgrade | Existing energy/migration history remains; V3/V4 history does not fabricate earlier mean samples |
| Restart and rollback | JSON serialization retains mean history; duplicates cannot extend it; an intervening V4 writer cannot bridge missing mean history |
| Seven-day window | Seeded complete 168-hour buffers retire only the oldest fraction; gaps prevent complete coverage; an eight-day outage expires all records |
| Storage and corruption | Both complete buffers remain bounded and survive serialization; malformed mean state fails closed without erasing energy history |
| Flows and watchdog | Three outputs in order; standard API request objects; unknown versus real zero; warnings preserve the mean key and route only to diagnostics; manual Inject does not repeat |
| Language and DST | Canonical/generated bodies match; UTC window duration stays 168 hours across a Europe/Berlin DST transition |

The seven-day tests use deterministic synthetic minute histories and exercise their processing, pruning, coverage and serialization. They are not a seven-day real-time hardware run. Live Home Assistant sensor creation, BLE timing and actual SOC accuracy require operating the updated flow on the installation. No operational measurement logs or credentials are included in the repository.

## v5.1 source availability and sensor regressions

Additional cases verify a preserved one-second-old SOC timestamp against the default mandatory timestamp check, invalid SOC/numeric overflow, continuing timer evaluation during an outage, partial-boundary expiry with invalid SOC, total expiry, serialization during failure, recovery without bridging, insufficient current charge, and untrusted runtime/context failure. Sensor cases verify HTTP POST objects, retained mean validity independent of source validity, real zero versus unknown, configurable entity IDs and the optional original-only watchdog path. Release 5.1.0 / calculation 5.1 / energy schema 4 / mean schema 1 are checked separately.

The operator reported a live test of the SOC-preparation replacement on 2026-10-09. This validates that component's use in the installation, not the entire new sensor/mean flow or a seven-day hardware run. CI still uses synthetic data and no Home Assistant credentials.
