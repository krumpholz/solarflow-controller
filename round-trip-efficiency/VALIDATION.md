# Validation — revision 3.3 publication candidate

**English** | [Deutsch](VALIDATION_DE.md)

## Automated checks

Run from the repository root with Node.js:

```sh
TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
EFFICIENCY_LANGUAGE=de TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
node --test round-trip-efficiency/tests/localization.test.cjs
```

**47 tests per language plus 3 localization checks: 97 passing executions, no failures.** These execute the actual Function bodies using controlled time and simulated Node-RED stores. Removed v2 import tests have been replaced by fresh-start isolation and existing-v3 compatibility tests; personal history is not included in the test fixtures.

Covered cases:

- New installation ignores v2 ring/live/snapshot keys and creates no migration backup; valid results appear with only one day of included intervals.
- Already persisted v3 history, SOC corrections and metadata survive restart without reimport or compounding, then expire by calendar date.
- Existing v3 state without an optional energy allowance initializes that allowance in place.
- Known energy balance, aligned SOC correction, invalid inputs, units and timestamp boundaries.
- Pair ordering, duplicates, incomplete cycles, late responses, watchdog and exported wiring/source synchronization.
- SOC spikes, confirmed rebaselining, restart, older flushed checkpoints, outages, daily reset and DST boundaries.
- Delayed minute/coarse counter updates, independent directions, repeated excessive increments, deferred recovery, counter decreases and bounded persistent anomalies.
- Corrupt state, changed configuration, zero throughput, out-of-range results and seven-day expiration.
- Identical executable core in both languages, German diagnostics and matching graph/entity references.

The optional Home Assistant YAML is syntax-checked and its template sign/availability logic reviewed manually (not executed in HA); this does not substitute for loading it into a real HA installation. It requires a real power source and verified entity IDs. No claim is made that importing the Node-RED flow provisions those inputs.

## Remaining live checks

Earlier revisions have limited user feedback. Revision 3.3 still needs the planned deploy/log review. Verify actual HA and websocket/companion-integration versions, input units/reset metadata, source update cadence, entity mapping, null-to-Unknown output, SOC acquisition, context persistence, midnight and restart behavior. Restart simulations do not test real filesystem durability. Capacity, SOC/BMS behavior and meter boundaries determine measurement uncertainty.

Follow the commissioning steps in [README.md](README.md). This is a simulated implementation test report, not hardware acceptance or certification of efficiency accuracy.
