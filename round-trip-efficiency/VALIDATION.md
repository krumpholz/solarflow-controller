# Validation

## Scope

Reviewed against the supplied full Node-RED export, which declares `node-red-contrib-home-assistant-websocket` 0.80.3. That export contains the daily charge/discharge reads and HA output sensor but not the trigger or SOC acquisition writer.

The replacement adds paired measurement cycles and uses a versioned interval ledger. It intentionally starts new accounting rather than silently converting the older daily ring-buffer history.

## Automated checks performed

- Runtime: Node.js v24.19.0.
- Timezone: Europe/Berlin.
- Command: `TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs` from the repository root.
- Result: **33 tests passed; 0 failed**.

The tests execute the actual Function bodies with simulated Node-RED context, status/error handlers and a controlled clock. They cover:

- Known 80% energy balance and aligned SOC correction.
- Partial-day startup without counting earlier energy.
- Invalid energy/SOC values and original HA state coercion.
- Unit validation and strict/optional SOC timestamp behavior.
- Reversed arrival order, incomplete pairs, duplicates and delayed responses.
- SOC spike rejection, recovery and confirmed rebaselining.
- Same-day restart and recovery from a simulated older flushed checkpoint.
- Long downtime, midnight rollover, cross-day restart and daily reset metadata.
- Counter decreases and implausible counter jumps.
- Zero throughput, insufficient energy and out-of-range efficiency without clipping.
- Seven-calendar-day expiration and daylight-saving calendar boundaries.
- Corrupt state, configuration changes and untouched legacy state.
- Missing stores, preparation snapshot and watchdog behavior.
- Exported JSON references, two-output wiring, exact Function/source/text equality and preparation/calculation execution together.

## Review conclusions

Invalid input does not overwrite accepted energy history. Paired current counters establish the baseline for subsequent differences. Every accumulated SOC difference is associated with the same accepted interval as its energy counters. No interval spanning an unresolvable reset, long gap or confirmed SOC discontinuity is silently included.

Persistent totals and the matching baseline are stored as one object. Restart tests model in-memory context loss and an older persisted checkpoint; they do not test a real filesystem, disk durability or a real abrupt shutdown.

## Not yet verified on hardware

- Live import/deploy behavior with the user's exact Node-RED and HA integration versions.
- Actual source counter units, meter boundaries, reset metadata and update cadence.
- Correct HA sensor entity mapping and null-to-Unknown handling in the installed versions.
- External SOC acquisition freshness and optional timestamp writer.
- Actual persistent-store configuration and startup/shutdown behavior.
- Capacity accuracy, SOC quantization, BMS recalibration and resulting measurement uncertainty.

This is a tested implementation in a simulated execution environment, not a hardware acceptance test or proof of measurement accuracy. Commission the complete flow using the README and observe diagnostics before relying on the displayed estimate.
