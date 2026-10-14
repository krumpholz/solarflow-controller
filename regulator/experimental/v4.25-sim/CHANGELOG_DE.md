# V4.23 → V4.25 / Modell V16

## 14.10.2026 — Modell V16, Regler unverändert

Logs 21–23: 1.799 Aufrufe, 24 Snapshot-Abbrüche, 1.775 genaue Replays. Lokaler Batterie-Telemetrieoffset separat angepasst und zeitlich geprüft. 3.048 Simulationen einschließlich ausstehender Stellreaktionen und kleiner Importkorrekturen; keine neue Reglerfassung übernommen. [Analyse](validation/log21-23/Log21_23_Analyse_DE.md).

## 13.10.2026 — Modell V15, Tagesvalidierung

Logs17–20: 2.398 Aufrufe, 37 Snapshot-Abbrüche, 2.361 exakt reproduzierte Regelentscheidungen. Lokale Tageskennlinie und getrennte AC-Modus-/Leistungs-/PackState-Zeitpunkte ergänzt. 15 Varianten in 2.440 Simulationen; keine Regleränderung übernommen. [Auswertung](validation/log17-20/Log17_20_Analyse_DE.md).

## 13.10.2026 — Modell V14, Regler unverändert

Logs 15/16 und DIAG1 live geprüft; 1.188 Entscheidungen exakt wiedergegeben. Schwache PV, Leerlauf-Telemetrie und Umschaltung ergänzt. 1.001 bedingte Simulationen: frühere Freigabe und stärkere Nachführung nicht übernommen, da Störfälle schlechter ausfallen. Keine neue Reglerrevision und keine geänderten Schutzgrenzen. [Auswertung](validation/log15-16/Log15_16_Analyse_DE.md).

## 13.10.2026 — V4.25-SIM-DIAG1

Nur Diagnose: jeder empfangene Reglertrigger erhält eine Statusausgabe, einschließlich Snapshot-Abbruch und synchronem Laufzeitfehler. Ausgänge 1–3, Schutzbedingungen und Regelzustände behalten ihr bisheriges Verhalten. Neue Ablaufzähler, Zeitstempel, beide Zyklusquellen und eingefrorene Fehlerbeobachtungen. Nur Regler-Function-Code ersetzen; bestehender Logger V2 und Zusatzdaten-Node bleiben angeschlossen. Zehn Testgruppen und 1.395 Datensätze ohne Unterschiede der Stellnachrichten/Regelzustände; vollständiger Diagnoseweg offline geprüft. Noch keine neue Live-Validierung. [Einbau und Details](DIAG1_DE.md).

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
4. **Abbruchdiagnose live prüfen.** Der bereits an der Anlage eingesetzte Logger V2 trennt Lade-/Entladesperren und verwirft unpassende zusätzliche Snapshots; Log14 bestätigt die normale Ausgabe. DIAG1 ergänzt jetzt übersprungene Regleraufrufe und Laufzeitfehler. Die Reglererweiterung ist offline geprüft; ein neuer Live-Log soll die Abbruchgründe und aktive Sperrfälle bestätigen. Logger V2 ist Voraussetzung dieses Einbaupfads und wird durch den DIAG1-Reglerimport nicht installiert.
5. **Modelle unabhängig bestätigen.** Aufnahmegrenze, Freigabe und Wiederaufnahme nach Entladung benötigen weitere Ereignisse. Ein fest wiederverwendeter Messfehler ist bei geändertem Batterieverlauf keine sichere Zukunftsprognose.

Bei Entladesperre im Energiesparmodus ist Import durch Last über PV kein Regelversagen. Bei begrenzter Ladeaufnahme ist Export nicht allein über Reglerparameter vermeidbar. HA-Aufrufabschluss ist keine korrelierte BLE-Gerätebestätigung. Messlücken werden bei Energieauswertungen nicht überbrückt.

Die Effizienz-Komponente v5.1.0 besitzt eine eigene Versionsfolge. Diese Veröffentlichung betrifft den experimentellen Regler und dessen Simulation.
