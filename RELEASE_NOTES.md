# SolarFlow Controller v4.0.0

**English** | [Deutsch](RELEASE_NOTES_DE.md)

## Changes since v3.3.0

- Rolling **168 hours** replaces the seven-calendar-day window. Old data leaves gradually instead of removing a whole day at midnight.
- Charge and discharge energy is integrated from measured signed battery power using actual timestamps, including direction changes. Daily energy counters are no longer inputs.
- Persistent minute aggregates retain history across restarts. Compatible V3 history is imported once; existing V4 buffers continue unchanged.
- New users receive a result after sufficient valid charge energy has accumulated, without waiting seven days.
- The latest ten exclusion episodes explain rejected data, their duration, causes and measured limits.
- English/German installation guides and flows are aligned. Superseded V3 runtime files and build dependencies have been removed from the current tree; v3.3.0 remains available.

## Upgrade

Follow the [guide](rolling-efficiency/README.md): use the snapshot input instead of the two daily-counter requests, preserve the context stores and existing history, and run only one writer. The regulator/snapshot source must already provide the documented context variables. Release v4.0.0 includes calculation revision **4.1**, state schema **4**.

The calculation has been exercised in operation and has automated regression coverage. Imported daily history remains an approximation; this release does not claim a completed 168-hour field test or certified measurement accuracy. Source timing, BMS corrections and missing measurements remain relevant.
