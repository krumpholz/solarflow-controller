# Log26: PackState bleibt trotz positiver gemessener Leistung auf Entladen

28.10.2026, 15:10:31 bis 15:11:23 MEZ. 27 gültig ausgeführte Aufrufe, V4.31-SIM-ZERO6-TEST. Der laufende Versuch begann vor dem aufgezeichneten Ausschnitt; protokollierte Dauer von 68,082 bis 120,091 Sekunden.

Durchgehend:

- normale Leistungsanforderung 0/0 W;
- tatsächliche Ladeanforderung 23 W und Entladeanforderung 0 W;
- bestätigter AC-Modus Ist=1 und gemeldeter Eingangsgrenzwert 23 W;
- Modbus-Batterieleistung **+5 W**;
- PackState **2 / Entladen**;
- interne logische Reglerbetriebsart `REGEL_ENTLADEN` bei gesperrter normaler Entladung.

Der Modbus-Leistungswert und der Regler-Sollwert passen zur lokalen Bilanz **23 W Auftrag − 18 W Offset ≈ +5 W**. PackState beschreibt in diesem Ausschnitt diesen gemessenen Leistungsfluss nicht zuverlässig. Nach zwei Minuten protokollierter Versuchsdauer ist noch kein Wechsel erfasst. Das rechtfertigt weder einen erfundenen weiteren Umschaltzeitpunkt noch die Behauptung einer erfolgreichen dauerhaften Gerätezustandsänderung.

`REGEL_ENTLADEN` war die interne Richtungsentscheidung, nicht die ausgegebene Aktuatorrichtung. Der Regler forderte tatsächlich Laden an. Die neue Anzeige trennt deshalb `mode` als ausgeführte Ruheaktivität von `logicalMode` als interner Entscheidung.

Die BLE-Batterieleistung liegt bei 22–23 W, während Modbus +5 W liefert. Diese Signale nicht als identische Leistungsmessung behandeln. Für die Ruhekompensation bleibt die vorhandene frische Modbus-Batterieleistung maßgeblich; BLE/PackState werden weiterhin unverändert protokolliert.

## Konsequenz nach Nutzerwunsch

Kein PackState-Umschaltimpuls mehr. Stattdessen bei normalem 0/0-W-Bedarf:

1. 0 W anfordern und nach Einschwingen den tatsächlichen Restverbrauch messen.
2. Betrag eines negativen Messwerts ohne Reserve als Ladeauftrag halten; bei gemessenen 0 W keinen Ausgleich.
3. Nach zehn Minuten Kompensationsphase erneut 0 W anfordern und nachmessen. Entfällt die Restentladung, fällt auch die Kompensation weg; andernfalls neue Höhe bestimmen.

Die aktuelle Zahl 18 W wird **nicht fest einprogrammiert**. Sie ist nur das durch Logs24–26 gestützte Beispiel. Während laufender Kompensation darf deren eigener auf0W gebrachtes Messsignal den benötigten Auftrag nicht wieder löschen. Deshalb wird der Offset ausschließlich in ausdrücklichen 0-W-Messphasen neu bestimmt.

## Modellgrenze

Dieser Log enthält keinen 18-W-Auftrag und keine neue 0-W-Prüfphase. Deren genaue Wirkung ist noch live zu bestätigen. Vorherige Logs24/25 zeigen −18 W nach Rücknahme auf0W; zusammen stützen sie das lokale additive Modell, aber keine allgemeine SOC-/PV-Kennlinie. V16 bleibt unverändert. Der Softwaretest mit verzögertem Offsetmodell prüft die Regelstrategie unter dieser Annahme, keine exakte Anlagenvorhersage.
