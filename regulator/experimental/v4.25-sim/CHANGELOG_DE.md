# V4.23 → V4.25 / Modell V13

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
4. **Diagnose präzisieren.** Lade-/Entladesperre getrennt ausgeben. `batt_max` sperrt Laden, nicht erlaubtes Entladen. Einen zusätzlichen Snapshot nur bei passender cycleId anhängen; Log13 hat einen veralteten ersten Anhang. Diese Diagnoseverbesserungen sind offen.
5. **Modelle unabhängig bestätigen.** Aufnahmegrenze, Freigabe und Wiederaufnahme nach Entladung benötigen weitere Ereignisse. Ein fest wiederverwendeter Messfehler ist bei geändertem Batterieverlauf keine sichere Zukunftsprognose.

Bei Entladesperre im Energiesparmodus ist Import durch Last über PV kein Regelversagen. Bei begrenzter Ladeaufnahme ist Export nicht allein über Reglerparameter vermeidbar. HA-Aufrufabschluss ist keine korrelierte BLE-Gerätebestätigung. Messlücken werden bei Energieauswertungen nicht überbrückt.

Die Effizienz-Komponente v5.1.0 besitzt eine eigene Versionsfolge. Diese Veröffentlichung betrifft den experimentellen Regler und dessen Simulation.
