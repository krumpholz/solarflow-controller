# V4.33-SIM-IDLE3: laufende Nachregelung auf gemessene Batterie0W

28.10.2026. Die Zehn-Minuten-Prüfung aus IDLE2 entfällt. Stattdessen die Batterieleistung bei normalem0/0W-Bedarf laufend prüfen und den bestehenden Zusatzauftrag korrigieren. PackState bleibt unveränderte Diagnose, kein Auslöser und kein Abbruchgrund.

## Neue Berechnung

Nach abgeklungener Stellreaktion:

```js
neuerZusatzauftrag = Math.max(0, Math.min(100,
  Math.round(bisherigerZusatzauftrag - MedianBatterieleistung)
));
```

Beispiele:

| Bisheriger Zusatzauftrag | Frisch gemessener Median | Neuer Zusatzauftrag |
|---:|---:|---:|
| 18W | 0W | 18W |
| 18W | +3W | 15W |
| 18W | −2W | 20W |
| 18W | +18W | 0W |

Gemessene0W während der Kompensation sind deren Wirkung und löschen den notwendigen Auftrag nicht. Wenn der interne Restverbrauch entfällt, entsteht bei unverändertem Auftrag zunächst positive gemessene Leistung. Die neue Rechnung reduziert daraufhin den Zusatzauftrag bis auf0W, ohne vorher eine künstliche0W-Testphase einzufügen.

Kein Reserveaufschlag, keine zusätzliche Totzone. Die vorhandene Stellauflösung ist ganzzahlig; daher Rundung auf1W. Zusatzauftrag ausschließlich Laden0…100W, kein künstliches Entladen. Nicht erreichbare Grenzen sind über `bound=lower/upper` sichtbar. Ein positiver Restwert bei bereits0W darf nicht zur Umgehung einer Entladesperre führen.

## Zeitverhalten

Frische Batteriemessung wird bei jedem gültigen2s-Takt diagnostiziert. Nach Beginn einer Ruheepisode und nach tatsächlicher Stelländerung **8 Sekunden einschwingen lassen**, anschließend vier Messungen aus unterschiedlichen gültigen Takten auswerten. Median = Mittel der beiden mittleren sortierten Werte. Bei normalem Takt ergibt sich die erste Korrektur etwa14s nach einer Stelländerung. Während dieser Zeit wird der zuletzt ermittelte Auftrag gehalten.

Bleibt der Auftrag unverändert, können anschließend jeweils vier weitere Proben ausgewertet werden, normalerweise alle8s. Kein wiederholtes achtsekündiges Abschalten und kein Zehn-Minuten-Termin. Eine Aufruflücke >3s verwirft das unvollständige Messfenster und beginnt das Einschwingen neu, **hält aber den vorhandenen Zusatzauftrag**. Doppelte Aufrufe desselben Takts zählen nicht als zweite Messung.

Die Einschwingzeit ist auf die bislang beobachtete Reaktion abgestimmt. Die neue dynamische Driftkorrektur ist trotzdem noch live zu validieren.

## Vorrang sämtlicher normaler Leistungsanforderungen

Nur bei regulären Lade-/Entladeanforderungen0/0W sowie bestätigtem AC-Modus Ist1 und frischer Batteriemessung darf die Zusatzregelung übernehmen. **Jede positive normale Lade- oder Entladeanforderung übernimmt sofort**, auch kleine Ladeleistungen. Netzladen, OFF, volle Batterie/Ladesperre behalten Vorrang. Verlust von AC-Bestätigung oder frischer Batterie-Rückmeldung beendet die übernommene Ruheepisode. Die alte Echo-Unterdrückung kleiner echter Ladeanforderungen bleibt entfernt.

Während der übernommenen Ruheepisode stehen normale Sollwerthistorie und Integratoren auf0. Der zusätzliche Auftrag läuft damit nicht als normale PI-Ladeleistung zurück in HOLD. Interne Richtung/AntiFlip bleiben erhalten. Nach normalem Leistungsbetrieb beginnt die nächste Ruheepisode neu; eine frische IDLE2-Migration wird nur einmal beim Versionswechsel versucht.

## Übergang von IDLE2

Ein laufender IDLE2-Auftrag wird beim ersten gültigen Aufruf übernommen, wenn sein Kontext plausibel ist, zuletzt wirklich die gleiche Ladeanforderung vorbereitet wurde, Entladeanforderung0W war und dieser Kontext höchstens6s alt ist. Dadurch können die derzeitigen18W weiterlaufen, ohne absichtliche0W-Unterbrechung.

Fehlt dieser frische Kontext, beginnt die neue Ruheepisode bei0W und ermittelt den nötigen Ausgleich über die normalen Einschwing-/Messfenster. Es gibt keine fest einprogrammierte18W-Kompensation. Kontext `regler_idle_compensation_v433`; alte IDLE2-Timerfelder werden nicht weiterverwendet.

## Anzeige und Diagnose

`behaviorVersion=4.33-SIM-IDLE3`. Node-/Diagnosestatus zeigt `RUHEKOMPENSATION` bei Zusatzauftrag>0W und `RUHE_0W` bei Zusatzauftrag0W. `logicalMode` bleibt die interne Richtungsentscheidung. PackState wird weder gefälscht noch künstlich auf Laden/Standby gesetzt. Sein späterer Wechsel ist möglich, aber durch gemessene0W nicht garantiert.

Unter `idleCompensation`:

- `strategy=previous_compensation_minus_measured_battery_power`;
- `periodicZeroProbeEnabled=false`, `checkIntervalMs=null`, `nextCheckTs=null`;
- gemessene Batterieleistung, letzter Median, letzte tatsächliche Korrektur und Kandidat vor Begrenzung;
- `estimatedW`/`appliedW`, `bound`, aktuelles/zuletzt ausgewertetes Probenfenster;
- `settleUntilTs`, `lastEvaluationTs`, `initialSource`;
- regulärer Bedarf und regulärer Sollwertspeicher getrennt von den tatsächlichen `outputs`.

Bei verworfenem Snapshot oder Laufzeitfehler unverändert nur Diagnose und keine neuen Stellnachrichten. Das Gerät kann seinen letzten Auftrag halten. `retainedState` beschreibt den zuletzt vorbereiteten Kontext, keinen aktuellen Geräte-ACK. Kein unabhängiger Timer bzw. Watchdog wurde eingeführt.

## Einbau und Live-Prüfung

Nur Regler-Function-Code aus `Regler_V4_33_SIM_IDLE3.txt` ersetzen oder den einzelnen Node aus `NodeRED_Regler_V4_33_SIM_IDLE3_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. Richtungsnode, BLE-Firmware, Zusatzdiagnose und Logger bleiben bestehen. Nur einen Regler betreiben.

Nächster Log: bestehende Ruhekompensation, natürliche Leistungsabweichungen, normale Lade-/Entladeübernahme und Rückkehr zur Ruhe beobachten. Auch über zehn Minuten darf kein allein zeitgesteuertes Abschalten mehr auftreten. PackState als getrennte Rückmeldung mitführen.

## Prüfung

22 gezielte Offline-Testgruppen bestanden: Korrektur in beiden Richtungen, Halten bei0W über zehn Minuten, Wegfall des Restverbrauchs, Median/Settling, Migration, normale Vorränge, Datenlücken, Fehler und Importgleichheit. Ein synthetischer verzögerter Prüfstand verfolgt Offsetwechsel18→15→24→0W. Das prüft Softwarelogik unter dieser Modellannahme, keine zugesicherte Anlagenreaktion.

Log27: Wiedergabe des ruhigen Abschnitts vor der alten Zehn-Minuten-Abschaltung,289 ausgeführte Aufrufe und ein Diagnose-Abbruch: neue Fassung hält bei aufgezeichneter0W-Rückmeldung unverändert18W. Der alte0W-Test und seine dadurch geänderten Messwerte werden nicht als Eingang zu unveränderter18W-Anforderung verwendet; das wäre keine gültige Vorhersage.

Deaktivierte Zusatzregelung:5.324 historische ausgeführte Aufrufe unverändert gegenüber ZERO1,66 Diagnose-Abbrüche weiterhin ohne Stellnachrichten. ModellV16 bleibt unverändert.

```sh
node --test tests/idle-tracking.test.cjs
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
node tests/private-log27.cjs /pfad/zum/simulationsordner
```

Private Rohlogs werden nicht veröffentlicht.
