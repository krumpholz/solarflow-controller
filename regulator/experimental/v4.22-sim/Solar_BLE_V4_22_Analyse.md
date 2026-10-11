# Solar-Mittennachführung und BLE-Diagnose – V4.22-SIM

Stand: 11.10.2026. Testversion; kein Feldtest dieser Revision. Der angehängte aktuelle Flow und die bereits geprüften richtigen Logs sind die Grundlage.

## Ergebnis

V4.21 besitzt eine langsame Mittennachführung beim nächtlichen Entladen. Beim Laden bedeutet HOLD dagegen nur: zweimal irgendwo innerhalb des effektiven Solarfensters. Auch ein dauerhaft exportseitiger Wert wird damit festgehalten. Die neue Version ergänzt eine kleine, zeitlich getrennte Lade-Mittennachführung. Sie verändert weder die Solar-Fensterverschiebung noch die vorhandenen P/I-Parameter, großen Rampen, Entladefreigaben oder die Nachtführung.

Unter konstanten synthetischen Bedingungen erreichen Low-, Normal-, High- und Very-High-PV die jeweilige Mitte innerhalb ±2 W und halten anschließend den Sollwert. Bei wechselnder PV ist die Verbesserung kleiner; die Ruhe der gemessenen Nacht ist damit noch nicht im Feld nachgewiesen.

## Tatsächlich gültige Mitte

Das Ziel wird jedes Mal aus den **effektiven** Grenzen berechnet:

`Ziel = (p_o_s_in_charge_eff + p_o_max_charge_eff) / 2`.

Bei den bisherigen Einstellungen aus den Logs ergibt sich:

| Solarleistung | Effektives Ladefenster | Ziel |
| --- | --- | --- |
| unter 720 W | −5 … +15 W | +5 W |
| 720 bis unter 1050 W | −23 … −3 W | −13 W |
| ab 1050 W | −27 … −7 W | −17 W |

Negativ bedeutet Export. Somit ist leichter Export bei hoher Sonne bereits der richtige Zielwert; problematisch ist zusätzlicher Export gegenüber dieser verschobenen Mitte. Die Funktionen verwenden die aktuellen Flow-Grenzen, keine fest einprogrammierten +5/−13/−17 W. Im exportierten Ausschnitt fehlt die externe Einstellung der Fenster; die Tabelle beschreibt die bisherigen Log-Einstellungen.

## Neue Feinführung

Maximal 3 W je Korrektur, mindestens 6 s seit jeder tatsächlichen Änderung des Lade-Sollwerts; innerhalb ±2 W um die Mitte wird gehalten. Die Feinführung greift erst nach drei ruhigen, frischen Messzyklen, bei bestätigtem AC-Lademodus und ausreichender Batterie-Nachführung. Ruhig bedeutet je Tick höchstens 15 W Solaränderung, 6 W Zähleränderung und 15 W Änderung der abgeleiteten Hausleistung. Letztere ist nur eine Bilanzgröße, kein unabhängiger Hauslastsensor.

Innerhalb des Fensters wird bestätigtes HOLD nachgeführt. Außerhalb ist sie nur bis 30 W Abstand zur Mitte und bei einem stehengebliebenen Sollwert zulässig. Sobald die normale Regelung bereits korrigiert, bleibt deren Reaktion wirksam. Unbestätigte aktive High-PV-Begrenzung, PV-Fall-Nachlauf, Batteriewert aus der Rückfallebene, frische Klassenwechsel, SOC-Maximalsperre und große Last-/Solaränderungen verhindern die Feinführung. Unterhalb der bisherigen HOLD-Mindestleistung von 20 W und an der Leistungsgrenze arbeitet die normale Regelung.

Der vorhandene Integrator bleibt gespeichert bzw. wird durch die bestehenden Regeln abgebaut. Während einer feinen Mittenkorrektur wird er nicht zusätzlich auf den Ausgang angewandt (`iEff=0`). `chargeCenterTrim` zeigt Freigabe, tatsächliche Anwendung, Ziel, Schritt, Wartezeit, Stabilitätszähler und Trackingfehler getrennt. `controlSet` unterscheidet `center_trim_charge`, `center_wait_charge` und `hold_charge_center`.

## Parameterbewertung

| Parametergruppe | Bewertung / Entscheidung |
| --- | --- |
| Lade-P Import: 1,02 / 1,00 / 1,04 | Für Last- und PV-Abbau beibehalten; eine größere Verstärkung löst fehlende HOLD-Mittenführung nicht. |
| Lade-P Export: Low 0,93; Normal 1,00; High 0,98; Very High 0,94 | Beibehalten. Große Änderungen bei noch nicht wirksamer Stellreaktion können nachschwingen. |
| Lade-I-Grenzen: Import 2 W; Export 12/13/8/6 W | Beibehalten. Während HOLD erfolgt bisher Abbau statt weiterer Zentrierung; deshalb eigener kleiner Schritt zur Mitte. |
| Lade-Rampe +60 W/Tick; Abbau 130/360/480 W/Tick | Beibehalten. Vorherige Versuche mit schnellerem Aufbau waren nicht über alle Logs robust. |
| Unbestätigter High-/Very-High-Aufbau 45/30 W/Tick | Beibehalten. Verhindert Nachladen in einen bereits zusammengebrochenen Solarüberschuss; begrenzt zugleich schnelle Überschussaufnahme. |
| Solar-Offsets 18/22 W und Seitenhysterese 10/14 W | Unverändert. Das neue Ziel berücksichtigt genau diese Offsets. |
| Neue Solar-Feinführung 3 W / ≥6 s | Aus sechs Varianten ausgewählt; kleine Korrektur, danach Reaktion abwarten. Die 2-W-Varianten waren bei der hier gewählten Freigabe weniger übertragbar. |

Die sieben bisherigen Lade-Parametersätze bleiben in einer gemeinsamen Auswahl erhalten. Weitere Zusammenlegung der numerisch unterschiedlichen Export-/Import-Fälle ist mit diesen Daten nicht begründet. Import-I ist bereits gemeinsam, weil die drei Wertepaare identisch sind.

## BLE-Steuerpfad und Diagnose

Geprüft wurde zusätzlich der öffentlich bereitgestellte [ESPHome BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble/tree/e8608d3ed147adec388f0d8c221b8ee07e16ad9c), einschließlich `set_action` und Empfang der Eigenschaften. Die Leistungsgrenzen und der AC-Sollmodus sind `optimistic: false`; ihre Zustände werden aus empfangenen Geräte-Eigenschaften veröffentlicht. Das ist ein sinnvoller Rücklesewert, aber kein nach Message-ID korreliertes Schreib-ACK. Das BLESPP-ACK dient dem Verbindungsaufbau.

Der Regler schreibt über HA-number → RBE → `number.set_value` → ESPHome → BLE. Die 500-ms-Verzögerung gehört nur zur Richtung. Die Leistungssollwerte besitzen diesen zusätzlichen Delay nicht. Richtungswechsel werden im vorhandenen Umschaltknoten dreimal über aufeinanderfolgende Takte gesendet, anschließend gegebenenfalls nach 6 s erneut. Diese Logik wird erhalten; die reine Diagnose zählt die tatsächlich weitergegebenen HA-Anfragen.

`batteryHttp` und `batteryHttpEvents` werden vollständig aus dem ausgehenden Status entfernt. Der neue Block `batteryBle` enthält:

- Vom Regler verlangte Richtung sowie Lade-/Entladegrenze und zugehörigen Zyklus.
- BLE-Bereitschaft sowie SOC, Batterie-/Packzustand, AC-Modus und Batterieleistung als beobachtete HA-Zustände.
- Rückgelesene Input-/Output-Limits der bereits vorhandenen Geräte-number-Entities, Vergleich mit aktuellem Reglerwunsch und letzter protokollierter HA-Anfrage.
- HA-Anfrage nach RBE, Dienstabschluss und Fehler, jeweils mit eigener Zeit und Zykluszuordnung. Abgeschlossene HA-Aufrufe werden ausdrücklich nicht als BLE-ACK ausgegeben.
- Echten `last_updated`- bzw. optional `last_reported`-Zeitstempel getrennt vom 2-s-Abfragezeitpunkt. Ein unveränderter HA-Zustand kann einen alten Zeitstempel haben, obwohl BLE funktioniert.
- Zeit einer nach einer HA-Anfrage beobachteten passenden Rückmeldung, sofern erkennbar; ansonsten `null`. Gleichheit und Zeitfolge beweisen keine eindeutige Zuordnung zu einem Schreibvorgang.

Der Ereignispuffer umfasst maximal 200 Einträge; ausgelassene Diagnoseereignisse werden gezählt. Es entsteht keine neue Befehlswarteschlange. Die Diagnose fügt keine zusätzlichen Geräteschreibbefehle hinzu. Die zwei neuen Current-State-Abfragen lesen bereits vorhandene HA-Zustände.

Die alte HTTP-Retry-/Queue-Kontextsammlung wird nicht mehr gelesen. Die bisherige Snapshot-Ringdiagnose kann weiterlaufen. Der Snapshot-Builder speichert zusätzlich die letzte akzeptierte Diagnose; der Regler kopiert sie bereits in seinem eigenen Aufruf und prüft Zyklus und alle vier verwendeten Leistungswerte. Ein fehlender/unpassender Snapshot wird niemals durch einen beliebigen älteren Arrayeintrag ersetzt. `snapshotAttachment.matched=false` bzw. `snapshot=null` macht einen Fehler sichtbar. `snapshot_age_ms` bezieht sich auf die Reglerzeit. Der Zusatzlogger bietet denselben geprüften Fallback auch beim getrennten Einbau mit einem älteren Regler.

Ein nachgeschalteter, hier nicht enthaltener JSONL-Logger muss das übergebene `snapshot` übernehmen und darf es nicht erneut mit einem alten Ringpuffereintrag überschreiben. Die bereitgestellte Auswahl enthält Links zu externen Nodes und einen weiteren externen Draht; deren Zielcode wurde nicht geliefert. Diese vorhandenen Verbindungen bleiben unverändert.

Eine bekannte Konsequenz des vorhandenen Steuerpfads wird jetzt sichtbar: ESPHome verwirft Schreibvorgänge bei fehlender Bereitschaft. Ein erfolgreicher HA-Aufruf kann daher trotzdem ohne Geräteschreiben enden. Ein anschließendes identisches Leistungssoll kann durch RBE unterdrückt werden. Der Vergleich mit den rückgelesenen Limits dient dazu, diesen Fall zu erkennen. Eine neue automatische BLE-Wiederholungslogik wird mit dieser reinen Diagnoseergänzung nicht eingeführt.

## Simulation und Grenzen

Die wirksamen Batterie-/Zähler-Verzögerungen, PT1-Zeiten, Raten und das Standby-Telemetrieniveau des validierten Modells V4 bleiben erhalten. Die Topologie des neuen BLE-Pfads wird dokumentiert. Ohne neue gemessene HA-/BLE-/Rücklesezeiten lassen sich seine Teilverzögerungen nicht seriös neu aufteilen. Eine synthetische Testzeit oder ein HA-Dienstabschluss wird nicht zur vermeintlichen Anlagenmessung.

Verglichen wurden 3 Tageslogs × 6 Modelle × 6 Varianten = 108 Läufe. Modelle: nominal, Verzögerungen −0,4/+0,5 s, alternative Batterie-Gain-/Ratenfits und zusätzlich um 1,5 s verlängerte Verzögerungen. Der externe Nettoverlauf wird aus dem jeweiligen alten Log mit dem Modell rekonstruiert und zwischen Varianten gleich gehalten. Dies ist eine bedingte Vergleichssimulation, keine unabhängige Vorhersage von Hauslast oder Sonne. Eingangsdaten für alle Varianten sind identisch; gemessene Anlagenwerte werden von simulierten Werten getrennt.

Die folgenden nominalen Werte beziehen sich auf die Abschnitte außerhalb der definierten großen Hauslasten. Zielabweichung ist der zeitgewichtete mittlere Absolutfehler zur jeweiligen Solarfenstermitte:

| Datensatz | MAE zur Mitte: V4.21 → V4.22 | Anteil innerhalb ±2 W | Anteil im Fenster |
| --- | --- | --- | --- |
| Log 2, wechselnde PV | 27.47 → 26.29 W | 5.4 → 7.0 % | 20.7 → 29.7 % |
| Log 3, starke PV-Sprünge | 81.16 → 80.85 W | 3.8 → 7.5 % | 27.0 → 27.0 % |
| Log 4, geringere Hauslast | 17.34 → 14.38 W | 7.0 → 30.8 % | 44.8 → 55.7 % |

Im ersten Solarabschnitt des Logs 4 (9 min 36 s) sinkt die simulierte MAE von 13,48 auf 10,82 W; der Mittenanteil steigt von 4,5 auf 27,1 %. Die gesamte Sollwertbewegung sinkt von 962 auf 598 W, während die Anzahl der Änderungen ähnlich bleibt (120 → 121). Das bedeutet kleinere Stellbewegungen; es bedeutet noch keine Nachtgüte bei wechselnder Sonne. Gemessen war dort mit V4.21 zuvor eine MAE von 12,41 W bei einem mittleren Zählerwert von −4,53 W und einem Ziel von +5 W.

Die gewählte Version verbessert die MAE in allen 18 Log-/Modellkombinationen. Der Vorteil auf Log 3 ist bei einzelnen Modellen sehr klein (rund 0,06 W); hier dominieren große PV-Impulse. Größte positive Peak-Zunahme außerhalb der großen Lasten: 4 W auf Log 2, 0 W auf Log 3 und 2 W auf Log 4. Die jeweiligen größten negativen Peaks dieser Abschnitte bleiben gleich. Innerhalb kürzerer Teilabschnitte können einzelne Peaks dennoch anders ausfallen. Eine allgemeine Überschwingfreiheit ist nicht nachgewiesen.

Die Entladesperre bleibt in allen 108 Läufen wirksam, alle Sollwerte liegen zwischen 0 und 2400 W. Import bei gesperrter Entladung und unzureichender PV ist weiter vorgesehen; dieser Zustand wird nicht durch eine Mittenkorrektur „weggeregelt“. Eine Leistungsgrenzenangabe von 2400 W ist keine Kalibrierung der Strecke bei 2400 W.

## Prüfung

8 synthetische Tests prüfen konstante Solarfenster, beide Fehlerseiten, langsame Strecke und kleine Messvariation, PV-/Klassenwechsel, Lastsprung, OFF/SOC/Freshness/AC-Modus, Snapshotzuordnung und -Kopie sowie HA/BLE-Diagnose, Fehler und begrenzte Puffer. Zusätzlich wurden 1.767 Tages-Eingangspunkte durchgespielt; der angehängte V4.21 ist zum veröffentlichten V4.21 funktional gleich. Bei deaktivierter Solar-Feinführung bleibt der bisherige Regelkern gleich. 1.188 Punkte entsprechen exakt den V4.21-Feldlogs. Auf den 1.108 richtigen Nacht-Eingangspunkten verändert die aktivierte Solarergänzung den bisherigen Regelkern nicht.

In zusätzlich 90 Läufen wurde eine Nachführung trotz laufender kleiner Sollwertänderungen geprüft und verworfen: einzelne Modellfälle verschlechtern sich, zusätzliche Importspitzen erreichen 20–21 W.

Diese Prüfungen sind Code- und Modellprüfungen. Es wurde kein Node-RED-Deploy und kein Feldtest von V4.22 durchgeführt. Der vollständige bereitgestellte Ausschnitt enthält 103 statt 92 Nodes: 21 bestehende Nodes werden gezielt angepasst und 11 reine Diagnosenodes ergänzt. Unveränderte Nodes, HA-Konfigurationen, Sensoridentitäten, bestehende externe Links und Mess-/Ausgangsreihenfolgen sind erhalten.

## Ist die natürliche Optimierungsgrenze erreicht?

Das ist nicht nachgewiesen. Schon die fehlende Lade-Mittennachführung lässt sich verbessern. Bei ruhiger Sonne erscheint ein Verlauf nahe der Mitte möglich; bei schnellen PV-Änderungen begrenzen Messzeitversatz, Stellverzögerung und die beabsichtigten Schutzrampen die erreichbare Ruhe. Ein präzises universelles P/I-Optimum lässt sich aus den vorhandenen Daten nicht bestimmen. Für den nächsten Modellschritt liefert der BLE-Logger erstmals die Trennung von Reglerwunsch, HA-Aufruf, Geräte-Rücklesewert und Anlagenmessung.

Nächster Anlagentest: V4.22 zusammen mit der Diagnose einsetzen und wieder etwa 20 Minuten mit ruhiger Solarphase, einem Lastsprung und einem Lastabfall aufzeichnen. Entscheidend sind Zielabweichung relativ zum eigenen effektiven Fenster, häufige kleine Stellwechsel, PV-Fall-Nachlauf sowie bleibende Differenzen zwischen Soll und Geräte-Rücklesewert. Während gesperrter Entladung bleibt größerer Lastimport erwartetes Verhalten.

Vollständiger Controller SHA-256: `7bdcd6123f7faba80144088a2f4140193d529f3d29f9d5f03eb384c0bda0d1f7`.
