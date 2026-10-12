# Log13 – volle Batterie → Entladen bei hoher PV

**Ergebnis:** V4.25 schaltet im beobachteten Übergang korrekt und ohne zusätzliche Reglerwartezeit um. Die wesentliche Verzögerung liegt zwischen Stellanforderung und beobachteter Leistungsabgabe. Das Modell V13 ergänzt hierfür einen gesonderten Anlaufzustand. Kein belastbarer Anlass, aus diesem kurzen Log die Entladeparameter zu verändern; V4.25 bleibt unverändert.

## Datengrundlage und Logqualität

12.10.2026, 15:20:28 bis 15:24:06 MESZ: 110 Datensätze, 218,164 s, durchgehend V4.25-SIM. PV 1.006–1.070 W, SOC-Anzeige 99/100 %. Fünf Punkte voller Standby, anschließend 105 Punkte Entladen. Keine fehlenden Reglerzyklen. Alle 110 Entscheidungen stimmen im vollständigen Code-Replay mit V4.25 überein, einschließlich Integratoren, Richtung, HOLD und Trim; keine abweichende Konfiguration.

Alle Kernmessungen sind frisch und zykluskonsistent. BLE-Beobachter vollständig/gültig, kein Fehler oder HTTP-Rest. 19 HA-Anforderungen mit 19 Abschlussereignissen, Median 112 ms, Maximum 311 ms. Ein Abschluss ist keine Bestätigung der physischen Leistungsabgabe.

**Ein Diagnosefehler bleibt:** Der zusätzliche `snapshot`-Anhang der ersten Zeile enthält einen alten Datensatz und passt nicht zum aktuellen Reglerzyklus. Die eigentlichen `inputs` und `snapshotCycle` sind aktuell. Der Auswerter verwirft diesen Anhang und verwendet die Kerninformationen. Alle 109 folgenden Anhänge passen. Im Logger sollte ein Snapshot nur bei passender cycleId angehängt werden; sonst ausdrücklich `null`/„nicht passend“. Kein ungeprüfter Ersatz des Logger-Codes: dessen aktuelle Function liegt in diesem Auftrag nicht vor.

## Umschaltablauf

Zeitnull ist der erste Reglerdatensatz mit erkanntem Lastanstieg. Die Hauslast steigt von 113 auf 2.059 W, PV beträgt 1.067 W, daraus folgen 992 W Import bei noch 0 W Batterieleistung.

| Zeit ab Reglerentscheidung | Beobachtung |
|---|---|
| 0 s | Sofort `REGEL_ENTLADEN`, Richtung 2, Ladeanforderung 0 W, Entladeanforderung 900 W |
| +0,088 s | HA-Aufruf für 900 W Entladegrenze |
| +0,508 s | HA-Aufruf für AC-Richtung Entladen |
| +1,999 s | Richtung bereits als Entladen zurückgemeldet; Batterie weiterhin 0 W; Anforderung 989 W |
| +4,000 s | Batterie weiterhin 0 W; Anforderung 981 W |
| +8,002 s | Batterie im Reglerdatensatz noch 0 W |
| +10,003 s | Batterie −955 W, Netz +2 W: Zielbereich erreicht |
| +12,003 s | HOLD bestätigt, Netz 0 W |
| +18,006 s | Erst jetzt meldet der Status `packState=Entlädt` |

Die zugehörigen Batterie-Empfangszeiten begrenzen den beobachteten Leistungsbeginn auf **nach +7,207 bis spätestens +9,204 s**. Die Reglerausgabe erfolgt etwas später als der jeweilige Messwerteempfang. Interne Messfilter und BLE-/Gerätezustände sind damit nicht einzeln identifiziert.

In den ersten fünf Entladedatensätzen entstehen nach zeitgewichteter Integration etwa **2,70 Wh Import**. Das ist eine Abtastwertschätzung, keine hochauflösend gemessene Anlaufenergie. Ein höherer P-Faktor kann einen Zustand ohne Leistungsabgabe nicht unmittelbar überbrücken.

Die Richtung wird insgesamt dreimal angefordert (+0,508/+2,506/+4,507 s), auch nach passender Rückmeldung. Ob diese Wiederholungen geräteintern einen Starttimer beeinflussen, ist **nicht belegt**. Ebenso wenig beweist dieser Log, dass die gesamte beobachtete Verzögerung physikalisch unvermeidbar ist. Sie kann Anteile aus Gerät, BLE-Ansteuerung und Messwertbereitstellung enthalten.

## Batterie voll ist keine Entladesperre

`batt_max=true` und das allgemeine Diagnosefeld `soc_block=true` bleiben im gesamten Log gesetzt. Trotzdem wird korrekt entladen. Das maximale SOC sperrt hier nur das Laden. Eine globale Abbruchbedingung `if (soc_block) …` würde die richtige Entladung verhindern und darf nicht nachträglich ergänzt werden.

Vor dem Lastanstieg sind Lade- und Entladeanforderung jeweils 0 W; der Überschuss wird exportiert. Im Modell ist dieser harte Lade-Stopp von der weichen Aufnahmebegrenzung aus Log12 getrennt:

- `batt_max`: Ladegrenze 0 W, Entladen bei Freigabe weiterhin möglich.
- `batt_min` bzw. fehlende Entladefreigabe: Entladegrenze 0 W.
- Weiche Ladebegrenzung aus Log12: optionale Aufnahmehülle ohne notwendiges `batt_max`.
- Anlauf aus vollem Standby: gesonderte Freigabeverzögerung für die Leistungsabgabe.

Die Rückkehr zur Ladung nach Entladung ist in Log13 nicht enthalten. Ihre Freigabe wird deshalb nicht neu erfunden oder aus dem unverändert gesetzten Maximalflag extrapoliert.

## Regelgüte nach dem Anlauf

Für Entladen gilt trotz hoher PV das **asymmetrische Entladefenster 0…+15 W**, mit Ziel **+7,5 W**. Das High-PV-Ladeziel −5 W ist hier nicht anzuwenden.

| Kennzahl nach erster Leistungsabgabe | Ergebnis |
|---|---:|
| Beobachtungszeit | 198,161 s |
| Mittlere Netzleistung | +7,87 W |
| Mittlere absolute Abweichung von +7,5 W | 3,90 W |
| Zeit im ursprünglichen Entladefenster | 86,88 % |
| Netzminimum / -maximum | −5 / +20 W |
| Exportenergie | 0,0061 Wh |

Die Mittellage passt sehr gut. Kleine Fensterverletzungen bleiben bestehen; es handelt sich weder um eine vollständig überschwingfreie Regelung noch um den Nachweis eines physikalischen Optimums. Die Aufzeichnung umfasst nur einen Übergang und gut drei Minuten eingeschwungenen Betrieb.

## Modell V13 und seine Prüfung

Die normale Entladedynamik aus dem bestehenden Modell bleibt numerisch unverändert. Für diesen Übergang erhält sie eine vorgeschaltete Freigabe:

1. Ausgangsbedingung: voller Standby, keine Batterieleistung, Laden/Standby-Richtung.
2. Bei erlaubter Entladeanforderung startet die effektive Anlaufphase.
3. Während dieser Phase bleibt die modellierte Leistung 0 W. Neue, bereits mit normaler Stellverzögerung versehene Sollwerte aktualisieren den Zielwert; es wird anschließend kein Befehlsstapel abgearbeitet.
4. Nach Freigabe wirkt die normale Entladedynamik auf den aktuellen Zielwert.

Ein repräsentativer Freigabezeitpunkt **+8,0 s nach der Reglerentscheidung** beschreibt diesen Log; für Empfindlichkeitsversuche werden 7,2/8,0/9,2 s verwendet. Das ist kein zusätzlich im Regler einzubauender Timer! Es ist ein optionaler Zustand der simulierten Anlage. `packState` darf nicht als harte Startfreigabe dienen: Seine Rückmeldung käme in diesem Log erheblich zu spät.

Die Batterievorhersage in den ersten 20 s verbessert sich von **424,60 W auf 2,92 W RMSE**. Das ist eine Anpassung an diesen einen Anlauf, keine unabhängige Validierung eines universellen 8-s-Wertes. Ab +30 s bleibt der RMSE bei **2,87 W**, mit und ohne Anlaufzustand. Die normale Dynamik muss hierfür also nicht verstellt werden.

Für die lokale geschlossene Simulation wird die reale AC-Batterieleistung gemeinsam für Batterie- und Netzbilanz verwendet und zu den jeweiligen Empfangszeiten abgetastet. Eine probeweise unabhängige Fortführung der bisherigen Netz- und Batteriepfade erzeugte unbeobachtete Schwingungen (Baseline-MAE rund 120 W) und wurde verworfen. Diese Gegenprüfung ist im Paket dokumentiert. Die neue Kopplung wird als lokale Modellvariante geführt; alte Kennwerte werden nicht global überschrieben. Die rekonstruierte externe Netzlast kann noch asynchrone Messfehler enthalten.

## Parameter- und Codeprüfung

54 bedingte Simulationen: drei P-Faktoren × drei Lastsprungrampen × drei Anlaufzeiten × zwei deterministische Rauschszenarien. Externe Last/PV stammen aus Log13. Keine unverändert wiederverwendeten Batterieresiduen. Betriebsfreigaben und Statusfolge stammen aus dem Log; daher kein Versuch, eine neue Richtungspolitik zu validieren.

| PV-Entlade-P | Mittlerer Import erste 20 s | Mittlere spätere Zielabweichung | Zeit im Fenster |
|---|---:|---:|---:|
| 0,60 | 2,8781 Wh | 4,66 W | 80,34 % |
| **0,80, aktuell** | **2,8782 Wh** | **4,88 W** | **79,11 %** |
| 1,00 | 2,8764 Wh | 4,93 W | 76,40 % |

Die 600-/900-/1.200-W-Rampen ergeben hier nach dem Anlauf dieselben Ergebnisse: Ihre anfänglich unterschiedlichen Anforderungen gleichen sich bereits vor der Freigabe an. Die Steigerung auf 1.200 W spart in diesen Szenarien keine Anlaufenergie.

P=0,60 bringt lokal eine kleine Verbesserung der späteren Ruhe, aber praktisch keinen Anlaufvorteil. Daraus ist keine robuste globale Verbesserung ableitbar: PV-Abfälle, andere Lastsprünge, niedrige PV und schnelle Starts sind hier nicht unabhängig geprüft. Eine größere P-Verstärkung ist ebenfalls nicht begründet. **P=0,80 und 900 W Lastsprungrampe bleiben bestehen.**

Konkrete weitere Ansatzpunkte:

- **Diagnose verbessern:** getrennte Felder `chargeBlockedByMaxSoc`, `dischargeBlockedByMinSoc` und `dischargeStartupPending`; Startalter ab gewünschter Richtung, Abschluss über frische gemessene Leistung. So bedeutet `soc_block=true` nicht fälschlich „jede Batterienutzung blockiert“. Bei fehlendem Leistungsbedarf darf 0 W nicht als Startfehler gelten.
- **Snapshot-Anhang absichern:** vor Aufnahme in den Log Zykluszugehörigkeit prüfen, andernfalls fehlend markieren.
- **BLE-/Richtungsfolge gezielt untersuchen:** wiederholte Richtungsbefehle nach bestätigter Richtung sind ein möglicher Prüfpunkt. Aus diesem einzelnen Ereignis folgt noch keine Freigabe, sie zu entfernen oder die Reihenfolge der Grenz-/Richtungsbefehle zu ändern.
- **High-PV-Ladefeinregelung aus Log12:** bleibt ein eigener offener Punkt; dieser Entladelog validiert keine Korrektur dafür.

Es wird keine V4.26 erzeugt. Der Regler V4.25 ist für diesen Übergang korrekt; Modell und Analyse sind erweitert. Ein kürzerer Start wäre vor allem auf der Ansteuerungs-/Geräteseite zu untersuchen, nicht durch pauschal aggressivere Regelparameter.

## Reproduktion

Das ZIP enthält Skripte, Modell V13, Parameterstudie, Diagramm, Referenzcode und erforderliche lokale Abhängigkeiten. Den Rohlog separat als `upload/regler_event_log_13.jsonl` ablegen. Benötigt: Node.js sowie Python mit NumPy und Matplotlib.

Ausführen: `node analysis_log13/replay.cjs`, `node analysis_log13/study.cjs`, optional `node analysis_log13/study_separate_paths.cjs`, anschließend `python analysis_log13/analyse.py`. Zeilenindizes in JSON sind nullbasiert.
