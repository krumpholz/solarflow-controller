# Reproduce model V13

**English** | [Deutsch](README_DE.md)

This directory preserves the relative layout of the verified analysis workspaces. It contains no raw household logs and sends no installation commands. Requirements: Node.js, Python 3, and `python3 -m pip install -r requirements.txt`.

Place your original local files at `upload/regler_event_log_12.jsonl` and/or `upload/regler_event_log_13.jsonl`. Run from this directory:

```sh
node analysis_log12/replay.cjs
node analysis_log12/compare.cjs
python3 analysis_log12/analyse.py
node analysis_log13/replay.cjs
node analysis_log13/study.cjs
python3 analysis_log13/analyse.py
```

The optional `node analysis_log13/study_separate_paths.cjs` documents the rejected independent grid/battery response case. Do not use its tuning ranking. `analysis_log12/acceptance_model.py` provides the optional charge envelope; `analysis_log13/startup_model.py` provides separate SOC limits and the optional startup gate. The closed-loop study uses a locally coupled AC-power response. Both extensions need scenario-specific activation/release assumptions and are not universal SOC physics.

Latest complete model: `results_regler_log13/Regler_Modell_V13_Voll_Entladen.json` (identical to `../Regler_Modell_V13.json`). Earlier JSON files are preserved inputs, not competing latest versions. Reproduction writes results beneath `results_regler_log12` and `results_regler_log13`. The current Function is also at `../Regler_V4_25_SIM.txt`; nested controller copies are fixed replay references.

Published reports for logs10/11 summarize previous decisions; this directory reproduces logs12/13, not every historical parameter search. Package names mentioned in historical reports refer to the respective earlier deliverables. Raw logs remain local. Do not place them in a public commit.

Replay agreement validates code execution only. Log12's later taper segment is a chronological holdout of one event. Log13's startup model is fitted to one event; its post-start segment does not independently validate startup timing. Exogenous net load reconstructed from measurements may include sensor timing noise. There is no claim of a universal physical optimum.
