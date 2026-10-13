# V4.25-SIM-DIAG1: Diagnose bei jedem empfangenen Reglertrigger

Stand: 13.10.2026. Reine Diagnoseerweiterung des veröffentlichten Reglers V4.25-SIM. `version` bleibt `4.25-SIM`; das zusätzliche Feld `diagnosticVersion` lautet `4.25-SIM-DIAG1`. Die ursprüngliche V4.25-Datei bleibt für bestehende Simulationen und Vergleiche erhalten.

## Einbau

1. [Regler_V4_25_SIM_DIAG1.txt](Regler_V4_25_SIM_DIAG1.txt) öffnen und den vollständigen Inhalt in den bestehenden **Regler-Function-Node** kopieren. Alternativ den [einzelnen Function-Node](NodeRED_Regler_V4_25_SIM_DIAG1_Import.json) importieren und damit den bisherigen Regler ersetzen.
2. Vier Ausgänge beibehalten: **1 Richtung, 2 Laden W, 3 Entladen W, 4 Diagnose**. Ausgang 4 bleibt mit **Zusatz Daten anfügen → vorhandenem Logger** verbunden. Beim Import bestehende Verbindungen übernehmen und genau einen Regler betreiben.
3. Den bestehenden 2-s-Trigger und seine Verzögerung beibehalten. **Keine anderen Function-Nodes austauschen.** Die bestehenden elf BLE-Diagnosenodes und der bereits eingebaute Logger V2 werden weiterverwendet.
4. Deploy; eine Daueraufzeichnung starten. Im neuen Log muss `diagnosticVersion` erscheinen. Zum Zurückwechseln den ursprünglichen [V4.25-Code](Regler_V4_25_SIM.txt) einsetzen.

Der Import ist ein einzelner Regler, kein vollständiger Anlagenflow. Er enthält keine neuen Timer oder BLE-/HA-Aufrufe.

## Wann wird ein Zyklus nicht geregelt?

Die Messwerterfassung und der Regler prüfen unterschiedliche Bedingungen:

| Stelle | Vorhandene Bedingung | Folge |
|---|---|---|
| Snapshot-Builder V1.3 | Frischer Zähler oder einer der beiden PV-Werte fehlt | Wartet auf weitere Eingänge; noch kein vollständiger Snapshot |
| Snapshot-Builder V1.3 | Batterie weder frisch noch über den vorhandenen zulässigen Ersatzpfad verfügbar | Noch kein verwendbarer Snapshot |
| Snapshot-Builder V1.3 | Empfangsspreizung der frischen Pflichtwerte **>120 ms** | Snapshot abgelehnt |
| Snapshot-Builder V1.3 | Maximale Empfangslatenz der frischen Pflichtwerte seit Trigger **>450 ms** | Snapshot abgelehnt |
| Regler | Erwartete Zyklus-ID fehlt oder stimmt nicht mit dem letzten erfolgreichen Snapshot überein | Normalregelung ausgelassen |
| Regler | Snapshot-Zeitstempel fehlt, liegt in der Zukunft oder ist **>1.800 ms** alt | Normalregelung ausgelassen |

Die Builder-Grenzen gelten für Zähler und beide PV-Werte, nicht pauschal für jedes BLE-Statusfeld. `incompleteCount` zählt auch das vorübergehend unvollständige Eintreffen einzelner Werte; es ist kein Zähler endgültig verlorener Zyklen. Die vorhandene Batterie-Ersatzwertbehandlung wird nicht geändert. **REGELUNG AUS und NETZLADEN behalten ihre bisherigen Ausnahmen vom Snapshot-Schutz.**

Bei einem Snapshot-Abbruch waren früher alle vier Ausgänge leer. DIAG1 gibt `[null, null, null, Diagnose]` zurück. An den drei Regelausgängen entsteht insbesondere **keine 0-W-Nachricht**. Rampen, Integratoren, SOC-Bestätigung, Richtungszähler und Messwerthistorie werden durch einen solchen Abbruch weiterhin nicht fortgeschrieben. Die zusätzliche Ablaufstatistik benutzt ausschließlich den eigenen Flow-Schlüssel `regler_diag_v425_d1`.

Synchrone Laufzeitfehler werden ebenfalls als Diagnose ausgegeben und mit `node.error(error, msg)` an die vorhandene Node-RED-Fehlerbehandlung gemeldet. Wie zuvor entstehen keine Stellnachrichten; eventuell schon vor dem Fehler geschriebener Regelzustand wird nicht zurückgerollt und ausdrücklich als möglicherweise teilweise aktualisiert markiert.

## Sind die Grenzen zu streng?

Log14 enthält 19 erfolgreiche Reglerstatuszeilen. Beim Regleraufruf lag das Snapshot-Alter zwischen **589 und 891 ms**, die aufgezeichnete Eingangslatenz zwischen **210 und 382 ms**, die Spreizung zwischen **0 und 82 ms**. Die Altersgrenze 1.800 ms zeigt für diese erfolgreichen Zyklen ausreichende Reserve. Den Zyklusvergleich aufzugeben würde erlauben, alte Messwerte nochmals als neuen Regelzyklus zu verwenden.

Die Builder-Grenzen von 450/120 ms sind vergleichsweise eng. Ob ihre Lockerung der Anlage nützt, ist aus ausschließlich erfolgreichen Zeilen nicht belegbar. Die kumulierten Builder-Zähler am Ende von Log14 zeigen etwa 0,85 % Ablehnungen unter den als akzeptiert/abgelehnt gezählten Snapshots; endgültig unvollständige Zyklen sind in dieser Quote nicht enthalten. In der einzelnen 4,061-s-Lücke stieg `okCount` um zwei und `rejectedCount` blieb gleich. Für diese Lücke ist eine Builder-Ablehnung daher nicht nachgewiesen. **Alle Grenzwerte bleiben in DIAG1 unverändert.** Die neue Diagnose liefert die bisher fehlenden Entscheidungsdaten.

## Neue Felder

| Feld | Aussage |
|---|---|
| `execution.outcome` | `executed`, `skipped_snapshot` oder `runtime_error` |
| `execution.controlExecuted` | Hat der Regelkern regulär abgeschlossen? |
| `execution.outputEmitted` | Vier boolesche Werte in der Reihenfolge der Ausgänge |
| `execution.reasons` | Zum Beispiel `snapshot_cycle_mismatch`, `snapshot_too_old`, `snapshot_missing`, `snapshot_timestamp_in_future` |
| `execution.enteredTs`, `finishedTs`, `intervalMs` | Aufrufzeit, Abschlusszeit und Abstand zum vorherigen empfangenen Aufruf |
| `execution.cycleIdFromMsg`, `cycleIdFromFlow`, `cycleIdSource` | Beide Zyklusquellen und die verwendete Quelle |
| `execution.triggerTsFromMsg`, `triggerTsFromFlow` | Beide vorhandenen Triggerzeitstempel, ohne sie zu vermischen |
| `execution.invocationSequence`, `counters` | Aufrufe, normale Abschlüsse, Snapshot-Abbrüche und Fehler |
| `snapshotCycle` | Tatsächliche Schutzentscheidung mit Snapshot-ID, Alter und Grenzwert |
| `measurementAtDecision` | Nur bei Abbruch/Fehler: letzter akzeptierter Snapshot, gespeicherte Werte, Builder-Zähler, Ablehnung für diesen Zyklus und noch ausstehende Einzelwerte |
| `retainedControlState` | Nur bei Abbruch/Fehler: im Flow gespeicherte Stellwerte; keine neue Ausgabe und kein Gerätenachweis |

Die Abbruchmodi heißen `SKIP_SNAPSHOT` beziehungsweise `ERROR`. Solche Zeilen sind mit `diagnosticOnly: true` markiert. `inputs` und `outputs` enthalten dort **null**, weil weder eine gültige neue Messung verbraucht noch eine neue Stellnachricht ausgegeben wurde. Beobachtete alte oder unvollständige Werte stehen ausschließlich unter `measurementAtDecision`; ihr eigener Zeitpunkt und Zyklus bleiben erhalten. Der alte erfolgreiche Snapshot wird nicht als aktueller Anhang ausgegeben.

Für Reglergüte, Energiebilanz und Simulation Diagnosezeilen mit `execution.controlExecuted === false` ausschließen; sie dienen zur Erklärung von Lücken. Die abgeleiteten Kompatibilitätsfelder `event_logger.z/pv/batt`, `flowValues` und BLE-Sollwertvergleiche aus dem bestehenden Logger/Zusatzdaten-Node sind bei solchen Zeilen keine frischen Messungen oder neuen Befehle. Maßgeblich sind `execution`, `inputs`, `snapshotCycle` und die ausdrücklich beschrifteten Beobachtungen. Lade-/Entladesperren bleiben separat in Logger V2 enthalten; sie sind von der Snapshot-Sperre zu unterscheiden.

## Takt und Aufzeichnungsmodus

Bei **jedem eintreffenden Reglertrigger** entsteht genau eine Nachricht an Ausgang 4, auch bei mehreren aufeinanderfolgenden Snapshot-Abbrüchen. Beim bestehenden 2-s-Trigger entspricht das einer Diagnose alle zwei Sekunden, zuzüglich normaler Laufzeitstreuung. Es gibt keinen eigenen Timer im Regler. Bleibt schon der Trigger aus, steht Node-RED oder wird die JavaScript-Ausführung extern abgebrochen, kann dieser Function-Node für den ausgefallenen Aufruf keine Nachricht erzeugen; der nächste `intervalMs` macht die Pause sichtbar.

Im **Dauer-Modus** übernimmt Logger V2 jede dieser Diagnosen während der aktiven Aufzeichnung. Sein Event-Modus behält seine bisherigen Ereignis-/Pufferregeln; eine kontinuierliche Dateiausgabe erfordert weiterhin Dauer. Datei-Hochzählung, 20-min-Aufzeichnung und Verdrahtung werden durch DIAG1 nicht verändert.

## Prüfung und Grenzen

- Zehn automatisierte Testgruppen prüfen gültige Zyklen, Lade-/Entladezustände, Snapshot-Grenzen, falsche und fehlende IDs, Ausnahmen für Aus/Netzladen, mehrere Abbrüche mit Wiederaufnahme, eingefrorene Beobachtungen, Laufzeitfehler und den Import.
- **1.395 Eingangsdatensätze aus Logs11–14** wurden mit ursprünglichem V4.25 und DIAG1 unter gleichen Bedingungen ausgeführt. Keine Unterschiede in den vollständigen Stellnachrichten an Ausgang 1–3 oder im bisherigen Regelzustand; bestehende normale Statusfelder stimmen ebenfalls überein. Dies ist ein Vergleich beider Codefassungen, keine neue physikalische Anlagenvalidierung.
- Integration mit dem am 12.10.2026 gelieferten **Zusatz Daten anfügen** und Logger V2: normal → Abbruch → Abbruch → normal ergibt vier gültige JSONL-Zeilen mit fortlaufender Sequenz; Ausgänge 1–3 bleiben bei den Abbrüchen leer.
- [Prüfergebnis](validation/DIAG1_Validation.json). Nach Checkout: `node --test regulator/experimental/v4.25-sim/tests/diagnostics-d1.test.cjs`.

Ein neuer Live-Log steht noch aus. Regelparameter, Anlagenmodell V13 und Effizienz-Komponente v5.1.0 werden mit dieser Diagnoseveröffentlichung nicht neu optimiert oder neu als feldvalidiert bewertet.
