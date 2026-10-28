# Log25: zusätzlicher Lastdelta-Abbruch nach zehn Sekunden

28.10.2026, 15:01:45 bis 15:02:47 MEZ. 32 Datensätze über 62,232 s, alle mit ausgeführter Regelung; V4.30-SIM-ZERO5-TEST. Keine Snapshot-Abbrüche oder Laufzeitfehler. Alle acht erwarteten BLE-Diagnosebeobachter vorhanden und gültig; dies beschreibt Diagnoseabdeckung, keinen korrelierten Schreib-ACK.

| Zeit MEZ | Ladeanforderung | Modbus-Batterie | PackState | Ereignis |
|---|---:|---:|---|---|
| 15:01:55 | 0 W | +7 W | Entladen | Last steigt, normale Ladung endet; Entladen gesperrt |
| 15:01:59 | 0 W | −11 W | Entladen | Restentladung bestätigen |
| 15:02:05 | 23 W | −18 W | Entladen | Dynamischer Test startet korrekt |
| 15:02:09 | 23 W | +4 W | Entladen | Leistungsnullpunkt erstmals erreicht, wird korrekt nur protokolliert |
| 15:02:11–13 | 23 W | +5 W | Entladen | Auftrag bleibt trotz positivem Messwert bestehen |
| 15:02:15 | 0 W | +5 W | Entladen | `pv_or_load_changed`, nach 10,001 s laut Reglerzustand |
| 15:02:21 | 0 W | −18 W | Entladen | Restentladung wieder vorhanden |
| 15:02:23–47 | 0 W | −18 W | Entladen | `done`, keine Wiederholung |

## Warum der Test abbrach

Am Start: PV 115 W, Zähler +917 W, Batterie −18 W, abgeleitete Hausleistung 1050 W. Am Abbruch: PV 113 W, Zähler +995 W, Batterie +5 W, abgeleitete Hausleistung 1103 W.

PV-Abweichung −2 W liegt unter der 15-W-Schwelle. Die abgeleitete Hausabweichung beträgt **+53 W** und übersteigt die zusätzliche 25-W-Abbruchschwelle. Sie ist aus PV+Zähler−Batterie berechnet, keine unabhängige Hausleistungsmessung; eine physikalische Laständerung lässt sich daher nicht von zeitlicher Messabweichung allein trennen. Für den Code ist die Ursache eindeutig diese Schwelle. Die reguläre Lade-/Entladeanforderung blieb an der Abbruchstelle **0/0 W**. OFF, Netzladen, volle Batterie und neue Entladung waren nicht die Ursache.

Die Entfernung des Timeouts und des Leistungsnullpunkt-Abbruchs funktioniert. Eine weitere, bisher beibehaltene Heuristik verhindert jedoch den beabsichtigten länger laufenden PackState-Test. Es gibt weiterhin keine Minute durchgehend gehaltenen Ladeauftrag.

## Gerätebeobachtung

Der BLE-Readback des Eingangsgrenzwerts erreicht während des Versuchs 23 W und fällt nach Rücknahme wieder auf 0 W. Der BLE-Batterieleistungssensor zeigt zeitversetzt 23 W, die Modbus-Messung +5 W. Beide Messgrößen nicht gleichsetzen. PackState bleibt während des gesamten Versuchs sowie danach auf 2; nur zu Beginn vor der Lastzuschaltung ist 0 erfasst.

Gemeinsam mit Log24 bestätigt dies wiederholbar die lokale Kompensation: Auftrag 23 W bei ursprünglichen −18 W liefert gemessen etwa +4…+5 W. Nach Auftrag 0 W kehren −18 W zurück. Das belegt noch keine dauerhaft geänderte Gerätezustandslage und keine bekannte PackState-Umschaltzeit. Eine größere Amplitude ist aus diesem Log nicht zwingend abzuleiten, weil positive gemessene Leistung bereits erreicht wurde und die Haltezeit wieder künstlich begrenzt war.

## Änderung ZERO6-TEST

Die reinen PV-/Hausdeltas sind nur Diagnose; sie beenden den gezielten Test nicht mehr. Die normale Regelung wird weiterhin berechnet: neue positive Entladeanforderung oder deutlicher Ladebedarf übernehmen, OFF/Netzladen/volle Batterie sowie verlorene AC-Bestätigung/frische Batterie-Rückmeldung behalten Vorrang. Kleine normale Ladeanforderungen bis Testauftrag+15 W bleiben als mögliche eigene Rückwirkung während des Tests unterdrückt.

Damit hält der PackState-Test unter den Bedingungen dieses Logs trotz +53 W Hausdelta seinen Startauftrag von 23 W. Es gibt weiterhin weder Zeitlimit noch Leistungsnullpunkt-Abbruch. Ohne PackState-Wechsel oder anderen Vorrang kann der Auftrag bestehen bleiben. Test beobachten, zum Beenden Regler ausschalten.

## Validierung und Grenzen

- Originalfassung offline mit allen aufgezeichneten Eingängen: **32/32 Leistungsanforderungen exakt reproduziert**.
- Neue Testfassung unter denselben fest vorgegebenen Eingängen: erste Änderung an Zeile 15, danach weiterhin 23 W statt 0 W; 17 abweichende Aufrufe, genau die nun entfallende Rücknahme.
- Dies ist eine Wiedergabe mit festen Eingangsdaten. Nach geänderter Anforderung wäre die reale Batteriereaktion anders; daraus keine Vorhersage ihres weiteren Verlaufs oder des PackState-Zeitpunkts ableiten.
- 23 gezielte Software-Testgruppen bestanden, einschließlich des +53-W-Falls, Schwankungen über eine Minute und eingefrorener Dauer nach Rücknahme.
- Mit deaktiviertem Testauftrag 5.324 historische ausgeführte Aufrufe gegenüber ZERO1 unverändert; 66 Diagnose-only-Aufrufe unverändert.

Modell V16 bleibt unverändert. Die lokale −18-W-Kompensation ist eine wiederholte Beobachtung, kein allgemeines SOC-/Eigenverbrauchsmodell und kein Ersatz für den noch ausstehenden längeren Test.
