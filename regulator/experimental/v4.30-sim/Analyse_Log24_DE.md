# Kurzlog 24: Leistungsnullpunkt beendet den Versuch, nicht die Minutengrenze

Aufzeichnung am 28.10.2026, 14:53:09 bis 14:54:07 MEZ. 30 Datensätze, davon 29 ausgeführte Regelaufrufe und ein Diagnose-only-Aufruf wegen Snapshot-Alter/Zyklusabweichung. Version V4.29-SIM-ZERO4.

| Zeitpunkt MEZ | Ladeanforderung | Batteriemessung | PackState | Einordnung |
|---|---:|---:|---|---|
| 14:53:19 | 0 W | +62 W | Laden | Lastzuschaltung beendet normale Ladung; Entladen gesperrt |
| 14:53:25 | 0 W | −17 W | noch Laden | Beginn Restentladungsbestätigung; Status läuft der Leistung nach |
| 14:53:31 | 23 W | −18 W | Entladen | Dynamischer Versuch startet korrekt: 18+5 W |
| 14:53:35 | 23 W | −13 W | Entladen | Leistungsreaktion beginnt |
| 14:53:37 | 0 W | +5 W | Entladen | Abbruchgrund `battery_power_cleared`, nach 6,002 s |
| 14:53:41 | 0 W | −9 W | Entladen | Rückkehr zur Restentladung |
| 14:53:43 | 0 W | −18 W | Entladen | Restentladung wieder vollständig vorhanden |
| 14:53:45–14:54:03 | 0 W | −18 W | Entladen | Einmaligkeitslogik verhindert erneute Versuche |
| 14:54:05–07 | 60→79 W | noch −18 W | Entladen | Last fällt ab, normale PV-Laderegelung übernimmt; Log endet zu früh für deren Reaktion |

Die 60-s-Frist lag bei 14:54:31 und wurde nie erreicht. Der ganze Log dauert nur rund 58 s; er kann das Verhalten nach einer Minute ohnehin nicht zeigen. Nur den Timeout zu entfernen würde den beobachteten Abbruch nach sechs Sekunden nicht verändern.

## Transport und Signale

AC-Modus Ist bleibt 1. Der BLE-Diagnoseblock erfasst den HA-Aufruf für 23 W sowie danach einen gemeldeten Eingangsgrenzwert von 23 W; später entsprechend 0 W. Das stützt die Übernahme der Anforderung, ist aber kein korrelierter BLE-Schreib-ACK.

Die Modbus-Batteriemessung erreicht bei 23-W-Auftrag +5 W ausgehend von −18 W. Das stützt die additive Kompensation für diesen Betriebspunkt. Die nachfolgende Rückkehr zu −18 W zeigt, dass der kurze Versuch keine dauerhafte Null-Ruhelage hergestellt hat. Ein Umschaltzeitpunkt des PackState auf Laden lässt sich daraus nicht bestimmen.

Der BLE-Batterieleistungssensor zeigt zeitversetzt andere Werte (beispielsweise 22 W, während die Modbus-Messung +5 W erfasst). Die Signale und Zeitbasen dürfen nicht als identische Leistungsgröße behandelt werden. Die Regelrückmeldung bleibt die vorhandene Modbus-Batteriemessung; PackState dient im nächsten Test ausschließlich als beobachtetes Statussignal.

Keine belastbare Kalibrierung einer PackState-Verzögerung oder dauerhaften Gerätezustandsänderung möglich. Anlagenmodell V16 bleibt unverändert; kein frei erfundener Umschalttimer wird eingeführt.

## Konsequenz für ZERO5-TEST

23 W bei Startwert −18 W weiterhin halten. Für diesen Test weder nach 60 s noch beim ersten Leistungsnullpunkt zurücknehmen. Leistungsnullpunkt nur mit Zeitstempel protokollieren. Rücknahme über gültigen PackState-Wechsel 2→1/0; Schutz-/Betriebswechsel und erhebliche PV-/Laständerungen behalten Vorrang. Dadurch kann die nächste Aufzeichnung klären, ob und wann der gemeldete PackState bei länger anliegender Kleinladung wechselt. Die resultierende Anlagenantwort kann aus diesem Kurzlog noch nicht simulativ vorhergesagt werden.
