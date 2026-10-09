# Contributing

**English** | [Deutsch](CONTRIBUTING_DE.md)

Keep calculation changes in `rolling-efficiency/battery-efficiency.js` and capture changes in `rolling-efficiency/prepare-cycle.js`. `flow-template.json` supplies node configuration without embedded code; `localize.py` and `build.py` generate the German wrappers and both import flows. Do not edit generated Function code independently.

From the repository root:

```sh
python3 rolling-efficiency/build.py
node --test rolling-efficiency/tests/*.test.cjs
TZ=Europe/Berlin node --test rolling-efficiency/tests/*.test.cjs
```

Keep both READMEs and release notes consistent. Preserve persisted-state compatibility and test any migration changes. Explain changes to integration, exclusion boundaries, SOC handling, or time weighting. Generated files must match their sources and the build must be reproducible.

Mean tests must verify elapsed-time weighting, unrounded source values, excluded gaps, startup coverage, persistence and the output order. Run the suite in UTC and Europe/Berlin; CI also runs Node.js 22 and 24. See [testing details](rolling-efficiency/TESTING.md). Only report a field test when actual operating data supports it.

Include a minimal reproduction for bugs, with configuration, software versions and sanitized diagnostics. Never commit credentials, personal live buffers, installation exports or raw operational logs. Regression fixtures contain synthetic data.

Contributions are provided under the [MIT License](LICENSE). See [project notice](NOTICE.md).

Sensor payload preparation lives in `rolling-efficiency/prepare-sensor.js`; `build.py` also creates its German wrapper. Keep the mean usable during short source failures while excluding missing duration. Test clock-based expiry, mandatory original SOC timestamps, API unknown/zero handling and warning wiring. Sensor states written through the standard API have no entity-registry entry; do not claim Companion or registry features.

After all four matrix jobs pass on a push to main, the release job reads `VERSION`, creates the corresponding tag/release with bilingual notes and uploads the generated flow/Function files. Existing releases are left unchanged. Update VERSION, calculation revision, changelogs and both release-note files together before merging a release.
