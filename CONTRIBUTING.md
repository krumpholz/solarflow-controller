# Contributing

**English** | [Deutsch](CONTRIBUTING_DE.md)

Keep calculation changes in `rolling-efficiency/battery-efficiency.js` and capture changes in `rolling-efficiency/prepare-cycle.js`. `flow-template.json` supplies node configuration without embedded code; `localize.py` and `build.py` generate the German wrappers and both import flows. Do not edit generated Function code independently.

From the repository root:

```sh
python3 rolling-efficiency/build.py
node --test rolling-efficiency/tests/*.test.cjs
```

Keep both READMEs and release notes consistent. Preserve persisted-state compatibility and test any migration changes. Explain changes to integration, exclusion boundaries, SOC handling, or time weighting. Generated files must match their sources and the build must be reproducible.

Include a minimal reproduction for bugs, with configuration, software versions and sanitized diagnostics. Never commit credentials, personal live buffers, installation exports or raw operational logs. Regression fixtures contain synthetic data.

Contributions are provided under the [MIT License](LICENSE). See [project notice](NOTICE.md).
