# Modell V13 reproduzieren

**Neu: Logs 21–23 / Modell V16.** [Reproduktion](analysis_log21_23/README.md): unabhängige Tagesprüfung, lokaler Telemetrieoffset, 3.048 geschlossene Läufe. Forschungsprototypen bleiben simulation-only; der Anlagenregler wird nicht verändert.

**Neu: Tageslogs17–20, Modell V15.** [Reproduktion und Grenzen](analysis_log17_20/README.md): 2.361 genaue Replays, lokale Kalibrierung mit Prüfabschnitten, 2.440 bedingte Simulationen. Regler unverändert.

**Neu: Logs 15/16, Modell V14.** [Reproduktion](analysis_log15_16/README.md), vollständiges Replay, chronologische Kalibrierprüfung und 1.001 geschlossene Simulationen. Regler bleibt DIAG1. Originale Logs werden lokal benötigt und nicht veröffentlicht.

[English](README.md) | **Deutsch**

Dieser Ordner erhält die relativen Pfade der geprüften Analysepakete. Er enthält keine Haushalts-Rohlogs und sendet keine Anlagenbefehle. Benötigt: Node.js, Python 3 und `python3 -m pip install -r requirements.txt`.

Die originalen lokalen Dateien unter `upload/regler_event_log_12.jsonl` bzw. `upload/regler_event_log_13.jsonl` ablegen. Aus diesem Ordner ausführen:

```sh
node analysis_log12/replay.cjs
node analysis_log12/compare.cjs
python3 analysis_log12/analyse.py
node analysis_log13/replay.cjs
node analysis_log13/study.cjs
python3 analysis_log13/analyse.py
```

Optional dokumentiert `node analysis_log13/study_separate_paths.cjs` den verworfenen Fall unabhängiger Netz-/Batteriepfade. Dessen Parameterrangfolge nicht verwenden. `analysis_log12/acceptance_model.py` enthält die optionale Ladehülle; `analysis_log13/startup_model.py` getrennte SOC-Grenzen und den optionalen Anlaufzustand. Die geschlossene Simulation verwendet eine lokale Kopplung der AC-Leistung. Beide Erweiterungen benötigen szenariospezifische Aktivierung/Freigabe und sind keine allgemeine SOC-Physik.

Aktuelles Gesamtmodell: `results_regler_log13/Regler_Modell_V13_Voll_Entladen.json`, identisch zu `../Regler_Modell_V13.json`. Ältere JSON-Dateien sind erhaltene Eingangsdaten. Ergebnisse werden in `results_regler_log12` und `results_regler_log13` geschrieben. Der aktuelle Regler liegt auch unter `../Regler_V4_25_SIM.txt`; verschachtelte Codekopien sind feste Replay-Referenzen.

Die Berichte zu Log10/11 dokumentieren frühere Entscheidungen. Dieser Ordner reproduziert Log12/13, nicht sämtliche historischen Parametersuchen. Historische Paketnamen in den Berichten beziehen sich auf die damaligen Lieferstände. Rohlogs lokal halten und nicht öffentlich committen.

Replay-Gleichheit prüft Codeausführung. Der spätere Log12-Abregelabschnitt ist eine zeitlich getrennte Prüfung desselben Ereignisses. Der Log13-Start wurde an einem Ereignis angepasst; nachfolgende Messpunkte validieren den Startzeitpunkt nicht unabhängig. Rekonstruierte externe Netzlast kann Messzeitfehler enthalten. Kein Nachweis eines universellen physikalischen Optimums.
