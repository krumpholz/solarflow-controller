# Changelog

## 4.1 — Persistent exclusion diagnostics

- Keep the last ten exclusion episodes, grouped across repeated failures, with measured values and validation limits.
- Retain lifetime episode counters per cause and distinguish prior exclusions without known causes.
- Extend existing V4 state without resetting energy or migration history.

## 4.0 — Rolling power integration

- Add `rolling-efficiency/` with signed-power integration over a rolling 168-hour window.
- Split direction changes and minute boundaries; disclose proportional weighting of the oldest partial minute.
- Import compatible V3 state once, including existing legacy SOC corrections, with proportional expiration of historical daily totals.
- Preserve the V3 buffer and the existing output sensor contract.
- Provide English/German Function bodies, flows and setup documentation.


**English** | [Deutsch](CHANGELOG_DE.md)

Revision numbers below refer to the efficiency calculation, not the separately maintained BLE firmware. The persistent state schema remains version 3.

## 3.3

- New installations start from their first valid paired measurement; automatic v2 history import removed.
- Existing v3 state remains compatible, including evaluation of previously stored historical records until they expire.
- English and German flows, setup guides, external-variable reference and optional HA energy-sensor YAML.
- Concise Function status without an appended estimate label; calculation assumptions are documented in the README.
- Repository overview and supporting documentation describe the supplied monitoring component and its actual requirements.

## 3.2

- Persistent, bounded allowances for delayed and rounded HA energy updates.
- Defaults: 2.4 kW, 20% reserve, 120-second reporting allowance and 0.1 kWh resolution allowance.
- Defer anomalous counter increments without advancing the accepted baseline; distinguish observation outages and confirmed resets.
- SOC timestamp age allowance of 120 seconds.

## 3.1

- Window-endpoint SOC adjustment for already imported history, preserving newly measured interval accounting.
- Explicit diagnostics for historical SOC discontinuities and uncertainty.

## Initial v3 implementation

- Paired cycles, aligned energy/SOC intervals and automatic persistent state.
- English/German interfaces and documentation; MIT license and independent-project notices.
- The initial v2 import path was removed in revision 3.3.
