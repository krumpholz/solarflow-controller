# Regler V4.25-SIM und Simulationsmodell V15

[English](README.md) | **Deutsch**

**Update 13.10.2026 — Modell V15 / Tageslogs 17–20:** [Analyse](validation/log17-20/Log17_20_Analyse_DE.md) · [Modell V15](Regler_Modell_V15.json) · [Reproduktion](simulation/analysis_log17_20/README.md). Die 20-W-High-PV-Rampe begrenzt schnelle PV-Anstiege, die ruhige Exportlage bleibt zu tief. Geprüfte schnellere Varianten erhöhen jedoch einzelne Importspitzen. Nach 2.440 bedingten Simulationen bleibt der Regler unverändert. Die neue Tageskennlinie verbessert die neueren Modellprüfungen; historische Kennlinien bleiben erhalten. **Kein Node-RED-Codeaustausch.**

**Update 13.10.2026 — Modell V14 / Logs 15–16:** [Messauswertung und Simulation](validation/log15-16/Log15_16_Analyse_DE.md), [aktuelles Modell V14](Regler_Modell_V14.json). Log 15: +7,47 W bei Ziel +7,5 W, 99,32 % im Fenster. Log 16: vollständige DIAG1-Ausgabe einschließlich fünf Abbrüchen; verzögerter Ladebeginn und Export beim PV-Anstieg erklärt. Sechs Änderungen in 1.001 Simulationsläufen geprüft und nicht übernommen. **Regler unverändert, kein Node-Tausch.** Die folgenden V13-Angaben beschreiben die erhaltene historische Basis.

Stand 12.10.2026: veröffentlichte Arbeitsbasis für weiteres Feintuning. V4.25 wurde an der Anlage aufgezeichnet; die vollständigen Replays von Log12 (685 Punkte) und Log13 (110 Punkte) stimmen mit dem hier veröffentlichten Code überein. Das bestätigt die Reglerimplementierung für diese Eingänge, nicht die allgemeine Prognosegüte des Anlagenmodells. Ein physikalisches Gesamtoptimum ist nicht nachgewiesen.

**Update 13.10.2026 — DIAG1:** Nur die Diagnose wurde erweitert. Auch ausgelassene Snapshot-Zyklen erzeugen einen Status an Ausgang 4; die drei Regelausgänge und die Schutzgrenzen behalten ihr Verhalten. Zehn Testgruppen und 1.395 Datensätze im Vergleich gegen V4.25 geprüft; Log 16 bestätigt inzwischen die Live-Ausgabe einschließlich Abbruchfällen. [Details](DIAG1_DE.md).

## Direkt verwenden

- [Aktueller Function-Code V4.25-SIM-DIAG1 als TXT](Regler_V4_25_SIM_DIAG1.txt)
- [Identischer JavaScript-Code](Regler_V4_25_SIM_DIAG1.js)
- [Node-RED-Import, ein Function-Node mit vier Ausgängen](NodeRED_Regler_V4_25_SIM_DIAG1_Import.json)
- [Einbau, Abbruchbedingungen und Diagnosefelder](DIAG1_DE.md)
- [Ursprüngliche V4.25-Fassung für bestehende Simulationen](Regler_V4_25_SIM.txt)
- [Aktuelles Simulationsmodell V15](Regler_Modell_V15.json)
- [Änderungen und nächste Schritte](CHANGELOG_DE.md)
- [Simulationsquellen und Reproduktion](simulation/README_DE.md)

Bei bestehender V4.23-/V4.25-Installation nur den Reglercode ersetzen. Ausgangsreihenfolge: **1 Richtung, 2 Ladeleistung, 3 Entladeleistung, 4 Status/Diagnose**. Beim Import die bisherigen Verbindungen übernehmen und nur einen Regler aktiv betreiben. Messwerterfassung, Freigaben, gemeinsamer Flow-Kontext und BLE-Ansteuerung müssen bereits vorhanden sein; dies ist kein vollständiger Anlagenflow. Bestehende BLE-Diagnosepfade bleiben erforderlich, zusätzliche Nodes sind für V4.25 nicht nötig.

DIAG1-SHA256: `f1a9b4527bbb07250a492d077de893794770202ec73d65c78742bfa061fa25da`. Ursprünglicher Controller: `70935e53246a01031ad4d93a2959d8b7580b6b267873f43bbcbf62100aed22f0`.

## Seit V4.23 erreicht

**V4.24: High-PV ohne Fensterverschiebung.** Die Ladefenster-Offsets für High/VeryHigh sind null. Das originale Ladefenster −5…+15 W bleibt bestehen. Normal-PV zielt auf +5 W; High/VeryHigh zielt auf die Exportgrenze −5 W. Die Feinführung erlaubt −7…−5 W als kleine Exportreserve. Positive Importwerte erhalten Vorrang vor HOLD/Seitenhysterese. Begrenzte PV-Trendvorsteuerung berücksichtigt kleine erkannte PV-Abfälle kausal; zukünftige Messwerte werden nicht vorausgesetzt. Ruhige Nacht- und Normal-PV-Parameter bleiben erhalten.

**V4.25: gezielte Entlade-Schnellkorrektur.** Der vorhandene schnelle Exportabbau wird bei gültigem großem Lastabfall und nachgewiesenem Überschuss ohne Batterieentladung auch außerhalb des Nachtbereichs freigegeben. Große Teillastabfälle mit weiter bestehendem Entladebedarf lösen diese Erweiterung nicht aus. Die normale PV-Entladeverstärkung 0,8, die Lastsprungrampe 900 W/Tick und die Richtungsbestätigungen bleiben erhalten.

**Modell V13:** getrennte Betrachtung von normaler Stellreaktion, weicher Ladeaufnahmebegrenzung bei fast voller Batterie, hartem Lade-Stopp durch `batt_max` und verzögertem Entladestart aus vollem Standby. Lokale Normal-/High-PV-Kalibrierungen und die bisherigen Unsicherheitsfälle bleiben dokumentiert. Modellrevision V13 ist keine Reglerrevision V4.13 und verändert keinen Node-RED-Timer.

## Belege und Grenzen

| Prüfung | Ergebnis | Aussagegrenze |
|---|---|---|
| Log8, V4.23 gegen V4.24 | Alle 1.186 Ausgänge/Ziele im Nicht-High-PV-Log gleich | Keine High-PV-Feldvalidierung |
| Log11, Normal-PV | 28 Kandidaten untersucht; Finalisten scheitern an unabhängigen Störszenarien | Keine neue Ladeparameterfassung übernommen |
| Log12, V4.25 | 685 Entscheidungen exakt reproduziert; neuer Schnellzweig aktiv | V4.24 hätte beim konkreten Abfall ebenfalls 0 W verlangt; kein zusätzlicher Energiegewinn nachgewiesen |
| Log12, Aufnahmebegrenzung | Späterer, nicht angepasster Abschnitt: 9,55 W RMSE der Aufnahmehülle | Ein Abregelereignis, keine allgemeine SOC-Kennlinie |
| Log13, voller Standby → Entladen | 110 Entscheidungen exakt; sofort 900 W angefordert, Leistungsabgabe erst später beobachtet | Ein Anlauf; effektive Verzögerung enthält mögliche Geräte-/BLE-/Messanteile |
| Log13, nach Anlauf | Mittel +7,87 W bei Ziel +7,5 W; 86,88 % im Fenster 0…+15 W | Nur rund 198 s Beobachtung, keine umfassende Entladevalidierung |

[Log10](validation/Log10_Analyse_V4_25.md) · [Log11](validation/Log11_Analyse_Entscheidung.md) · [Log12](validation/Log12_Analyse_V25_Ladebegrenzung.md) · [Log13](validation/Log13_Analyse_Umschaltung.md).

## Basis für das nächste Feintuning

1. **Kleinen High-PV-Import bei aufnahmefähiger Batterie korrigieren.** Istwertbasis, Soll-/Istabweichung und nur positiver Ladeintegrator können eine kleine Importlage bestehen lassen. Gezielte Feinabsenkung oder Basiskorrektur gegen Messrauschen und PV-Abfälle prüfen. Noch nicht umgesetzt.
2. **PV-Anstiege und -Abfälle getrennt bewerten.** Die vorsichtige 20-W-High-PV-Aufwärtsrampe kann bei steigendem PV-Angebot Export verursachen; schnellere Varianten müssen Import nach PV-Abfall zuverlässig begrenzen.
3. **Anlauf und BLE-Befehlsfolge untersuchen.** Drei Richtungsanforderungen wurden beobachtet. Ihr Einfluss auf die Startzeit ist ungeklärt; kein universeller 8-s-Timer und keine ungeprüfte Änderung der Wiederholungen.
4. **Abbruchdiagnose weiter prüfen.** Der bereits an der Anlage eingesetzte Logger V2 trennt Lade-/Entladesperren und verwirft unpassende zusätzliche Snapshots; Log14 bestätigt die normale Ausgabe. DIAG1 ergänzt jetzt übersprungene Regleraufrufe und Laufzeitfehler. Log 16 bestätigt die Abbruchgründe live; aktive Sperrwechsel bleiben noch separat zu prüfen. Logger V2 ist Voraussetzung dieses Einbaupfads und wird durch den DIAG1-Reglerimport nicht installiert.
5. **Modelle unabhängig bestätigen.** Aufnahmegrenze, Freigabe und Wiederaufnahme nach Entladung benötigen weitere Ereignisse. Ein fest wiederverwendeter Messfehler ist bei geändertem Batterieverlauf keine sichere Zukunftsprognose.

Bei Entladesperre im Energiesparmodus ist Import durch Last über PV kein Regelversagen. Bei begrenzter Ladeaufnahme ist Export nicht allein über Reglerparameter vermeidbar. HA-Aufrufabschluss ist keine korrelierte BLE-Gerätebestätigung. Messlücken werden bei Energieauswertungen nicht überbrückt.

Die Effizienz-Komponente v5.1.0 besitzt eine eigene Versionsfolge. Diese Veröffentlichung betrifft den experimentellen Regler und dessen Simulation.
