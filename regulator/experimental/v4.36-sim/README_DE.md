# V4.36-SIM-IDLE6-NOPULSE

Ladeimpuls und gesamte Ein-Minuten-/PackState-Haltestrategie entfernt. Laufende dynamische Kompensation auf gemessene Batterie0W bleibt, ohne Zehn-Minuten-Prüfung. Neue normale Anforderungen übernehmen sofort; Fehlerpfad bleibt Diagnose-only.

Nur den vorhandenen Regler-Function-Code ersetzen. Vier Ausgänge: Richtung1/2, Ladeleistung, Entladeleistung, Diagnose. Alternativ den einzelnen Function-Node importieren und entsprechend dem vorhandenen Regler verdrahten. Kein Austausch anderer Nodes nötig. TXT und JS sind identisch; JSON enthält denselben Code.

Frischer Nullausgleich ausV4.35 wird übernommen; ein alter84W-Impuls niemals. Standby-Eintritt setzt den Zusatzauftrag einmalig0, danach Messwertregelung. Der Regler sendet keinen SmartMode-/Sleep-Befehl.

Analyse und Quellen: [Analyse_Log_Standby_DE.md](Analyse_Log_Standby_DE.md). 27 Offline-Tests sowie historische Differenztests und Logs28/29 geprüft. ModellV16 unverändert. Live-Betrieb der neuen Version noch zu prüfen. Kein unabhängiger Timeout bei ausbleibenden gültigen Aufrufen.

```bash
node --test tests/idle-tracking.test.cjs
```

Private Replays benötigen die früheren privaten Logs und Analysehelfer (nicht mitveröffentlicht); Aufruf mit deren lokalem Verzeichnis als Argument. Rohlogs werden nicht veröffentlicht.
