# SolarFlow Controller v5.0.0 — prepared release

**English** | [Deutsch](RELEASE_NOTES_DE.md)

## Changes since v4.0.0

- Add a time-weighted rolling **7-day mean** of the existing 168-hour SOC-adjusted energy balance. Integrate unrounded valid percentages using actual elapsed time and linear interpolation. Output is rounded to one decimal place only at publication.
- **Three outputs in a new order:** 1 = mean, 2 = original efficiency, 3 = diagnostics. The import includes a new HA mean sensor. The existing sensor IDs and raw-efficiency context key remain intact.
- Store bounded minute aggregates and the mean baseline in the existing persistent V4 state. Energy history, V3 migration and exclusion diagnostics continue; the percentage mean starts with new observations at upgrade.
- Exclude invalid measurements from both histories and invalid efficiency values from the mean; clear both output values on failure and watchdog timeout. No stale-value continuation across an outage.
- Fix floating-point overshoot at exact 0/100% endpoints using a 1e-9 percentage-point arithmetic tolerance. Real out-of-range results remain invalid.
- Disclose mean coverage, elapsed startup history and window completeness. A partial oldest minute is weighted uniformly, as in the energy buffer.
- Expand automated regressions and add a reproducibility/UTC/Berlin GitHub Actions matrix. Generate both language wrappers and import flows from the canonical calculation source.

## Upgrade

Follow the [guide](rolling-efficiency/README.md). Set the calculation Function to three outputs and rewire the existing sensor to **output 2** and diagnostics to **output 3**. Use **output 1** for the new mean. Replace the capture/watchdog code and connect its warning output to both sensors and diagnostics. Preserve capacity, flow tab and context; run only one calculation writer.

Release v5.0.0 uses calculation revision **5.0**, energy-state schema **4** and additive mean-state schema **1**. This is a major version because the output order changes. No historical mean can be reconstructed reliably from the existing aggregate energy buffer.

The mean starts after two consecutive valid efficiency observations, then builds towards a full seven days. `mean_window_complete` requires 168 hours of valid covered time inside the latest 168-hour window. Smoothing reduces short-term fluctuations but retains systematic SOC errors and responds slowly to lasting changes: it averages a balance that already spans seven days.

This release is prepared for review, not a claim of a completed seven-day field test. Automated synthetic regression coverage is documented in [TESTING.md](rolling-efficiency/TESTING.md). Historical migration and minute-boundary weighting remain approximations; the metric remains an SOC-adjusted energy balance.
