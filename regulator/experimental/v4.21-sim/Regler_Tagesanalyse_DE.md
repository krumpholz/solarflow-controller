# Tagesanalyse: PV-Höhe, Energiesparmodus und gemeinsame Regelfälle

Grundlage: `regler_event_log_2.jsonl`, 11.10.2026, 09:51:07 bis 10:11:05 Europe/Berlin. Es handelt sich um einen Ausschnitt von knapp 20 Minuten, nicht um einen vollständigen Tag.

## Ergebnis

Die Entladesperre wird auf der Sollwertseite eingehalten: **alle 579 Punkte haben `b_entladen=false` und 0 W Entladeanforderung**. Der große Lastsprung darf deshalb nicht wie der Nachtversuch auf vollständige Deckung durch die Batterie bewertet werden. Die von dir angegebene Begründung ist der Energiesparmodus bei günstigem Strompreis; der Strompreis selbst steht nicht im Log und wurde hier nicht geprüft.

Der Tagesausschnitt ist abseits dieses Lastimpulses eher exportlastig: mittlere Netzleistung −11,87 W statt normaler Lademitte +5 W. Die PV liegt nur zwischen 134 und 846 W. Fast alles ist Low-/Normal-PV; oberhalb 720 W gibt es nur vier Punkte beziehungsweise acht Sekunden, oberhalb 1.050 W keinen Punkt. Aussagen über starke Mittagserzeugung wären damit nicht gedeckt.

Die sieben Lade-Parameterzweige wurden in einer gemeinsamen Auswahl zusammengefasst. Ihre Zahlenwerte bleiben erhalten; die identischen Import-I-Parameter besitzen nun eine gemeinsame Konfiguration. Die separate Testvariante **V4.21-SIM** vermeidet außerdem einen nutzlosen Wechsel in die gesperrte Entladerichtung, solange PV vorhanden und Laden bereits die aktive Richtung ist. P-/I-Werte und PV-Fensterverschiebungen werden nicht neu abgestimmt. V4.21 wurde hier nicht an der Anlage eingesetzt.

## 1. Code- und Datenprüfung

- Tatsächliche Version im Log: **V4.19-SIM**, nicht V4.20. Alle PV-Werte liegen über der 50-W-Grenze der Nachtoptimierung. Die Änderung 6 → 15 W der V4.20-Nachtfeinführung ist hier nie aktiv; das Tageslog validiert diese Änderung nicht.
- 579 vollständige JSON-Zeilen, 1198,313 s. 564 Punkte `REGEL_LADEN`, 15 Punkte `REGEL_ENTLADEN` mit `discharge_blocked`.
- Regler an, Netzladen aus, Entladen gesperrt, SOC-Minimum/-Maximum nicht aktiv; diese Zustände bleiben konstant.
- Alle Batteriewerte sind als frisch markiert, alle geloggten Snapshots akzeptiert. Median des Snapshot-Alters 864 ms, Maximum 1.239 ms. 19 Lücken über 3 s, Maximum 6,003 s; keine dazwischen erkennbaren Änderungen der letzten Ladeanforderung.
- Ausführung des vollständigen V4.19-Codes reproduziert sämtliche Lade-/Entladeausgänge, Richtungsausgänge, Modi, HOLD-Zustände, Parametersatznamen und Integratoren ohne Abweichung. Der erste I-Zustand wurde auf den Zustand vor dem ersten geloggten Regelschritt zurückgerechnet; bei 145 Zeilen wird die abweichende Stellzeitbasis berücksichtigt.
- HTTP-/ACK-Protokoll weiterhin leer. Sollausgaben sind keine bestätigten Schreib- oder Anwendungszeiten.
- `p_haus` ist in jeder Zeile exakt `p_solar + p_zaehler − p_batterie`. Es ist keine unabhängige Hauslastmessung. Aus diesen vier Werten können Streckenverzögerung, Zählerzeitlage und echte kleine Hauslaständerungen nicht eindeutig getrennt werden.

## 2. PV-Höhe und asymmetrische Zielbereiche

| PV-Bereich | Ladefenster | Effektive Mitte | Verwendung im Ausschnitt |
|---|---|---:|---|
| unter 280 W, Low-PV | −5 bis +15 W | +5 W | 205 Punkte |
| 280 bis unter 720 W, Normal-PV | −5 bis +15 W | +5 W | 370 Punkte, davon 29 im großen Lastimpuls |
| 720 bis unter 1.050 W, High-PV | −23 bis −3 W | −13 W | 4 Punkte, 8,001 s |
| ab 1.050 W, Very-High-PV | −27 bis −7 W | −17 W | kein Punkt |

Die 18-/22-W-Fensterverschiebungen gelten ausschließlich beim Laden. Entladen besitzt weiterhin 0 bis +15 W mit Mitte +7,5 W, darf hier aber nicht aktiv decken. Für die Tagesqualität wird die effektive Lademitte verwendet. Der Energiesparbetrieb hat bei fehlendem Überschuss zusätzlich die Untergrenze Ladeleistung = 0 W; dort ist die Fenstermitte nicht immer erreichbar.

Die 280-W-Schwelle wird einmal durchlaufen. Die 720-W-Schwelle wird in zwei kurzen Wolkenlücken viermal gekreuzt. Damit fehlt insbesondere ein längerer stationärer High-PV-Test. Die maximale geloggte PV-Änderung beträgt +121 beziehungsweise −163 W zwischen zwei Punkten.

## 3. Gemessene Qualität, mit richtiger Bewertung der Entladesperre

| Teilbereich | Punkte | Dauer | Mittlerer Zählerwert | MAE zur effektiven Lademitte | Zeit im effektiven Fenster |
|---|---:|---:|---:|---:|---:|
| 134 bis <280 W | 205 | 416,1 s | -6,85 W | 12,92 W | 35,09 % |
| 280 bis <720 W, ohne große Last | 341 | 714,2 s | -13,25 W | 30,59 W | 31,93 % |
| 720 bis 846 W | 4 | 8,0 s | -149,01 W | 155,01 W | 0,00 % |

Gesamtes Log: Mittel +16,85 W, 31,22 % Fensterzeit, etwa 11,10 Wh Import und 5,49 Wh Export. Dieses positive Gesamtmittel wird stark vom gewollt ungedeckten Lastimpuls beeinflusst.

Ohne den rund 60-s-Lastimpuls: Mittel -11,87 W, MAE 25,01 W, Fensterzeit 32,86 %. Der unmittelbar anschließende Neustart des Ladens ist hier bewusst enthalten. Diese Zahlen beschreiben laufende PV-Änderungen und weitere Schwankungen, keinen konstanten ruhigen Prüfstand.

124 HOLD-Punkte halten den gesamten Ladebereich, nicht nur die Mitte ±2 W. Ihr Mittel ist zwar +4,81 W, ihre mittlere absolute Mittenabweichung aber 5,66 W; nur 14,32 % ihrer Zeit liegen in Mitte ±2 W. **Die enge Nacht-Mittenregelung ist somit nicht auf den Ladebetrieb übertragen.** Die acht High-PV-Sekunden können den langen negativen Mittelwert der übrigen Phasen nicht erklären.

![Messdaten des Tagesausschnitts](Regler_Tag_Messdaten.svg)

## 4. Der große Lastsprung unter Energiesparbetrieb

Um 10:01:05 steigt die abgeleitete Hausleistung um etwa 969 W. Die PV ändert sich dabei nur um +3 W und die Batterietelemetrie zunächst gar nicht. Der Lastimpuls ist deshalb deutlich belastbarer erkennbar als die kleinen bilanzbasierten Schwankungen bei schnellen PV-Änderungen.

| Zeit ab erstem sichtbaren Anstieg | Netz | Positive Batterieladung | Ladeanforderung |
|---|---:|---:|---:|
| 0 s | +948 W | 320 W | 214 W |
| 2 s | +934 W | 323 W | 84 W |
| 4 s | +856 W | 330 W | 0 W |
| etwa 6 s | +728 W | 229 W | 0 W |
| etwa 8,4 s | +601 W | 131 W | 0 W |
| etwa 10 s | +555 W | 0 W nach Begrenzung der negativen Telemetrie | 0 W |

Am ersten Punkt wären nach Abzug der bereits laufenden 320-W-Ladung noch ungefähr 628 W Netzbezug übrig. Dieser Teil kann durch einen Ladestopp nicht verschwinden. Er müsste durch Entladung gedeckt werden, die der Energiesparmodus gerade verbietet. Die Richtungsschnellerkennung respektiert die Sperre; es gibt keinen Entladekick und keine positive Entladeanforderung.

Der zusätzliche Bedarf der auslaufenden Ladung beträgt im Lastabschnitt aus der positiven Batterietelemetrie ungefähr 0,75 Wh; die verbleibende Netzbezugsenergie ungefähr 8,61 Wh. Das ist eine momentane Telemetrieaufteilung mit Zeitinterpolation, keine unabhängig gemessene AC-Verlustrechnung. Ein Teil der ersten Ladungsenergie ist bereits in der Anlage unterwegs und kann auch mit sofortiger Sollwertsenkung nicht rückwirkend verhindert werden.

Die 130-W-Abwärtsrampe begrenzt die Ladeanforderung auf 214 → 84 → 0 W. Zwischen Sollwert 0 nach 4 s und nicht mehr positiver Telemetrie nach ungefähr 10 s liegen weitere rund 6 s. Eine pauschale P-Erhöhung beseitigt diese Wartezeit nicht, denn der PI-Rohwert ist schon beim ersten Sprung auf 0 begrenzt. Ob eine Ereignisrampe den Ladestopp weiter verkürzen kann, muss mit bestätigten Stellzeiten separat geprüft werden.

Während des Stillstands zeigt die Batterietelemetrie etwa −18 bis −19 W, auch schon bei AC-Mode 1 und 0-W-Sollwerten. Das beweist keine angeforderte Hauslastentladung. Geräte-Eigenbedarf, Mess-/Definitionsoffset und geringe reale Batterieleistung sind mit diesen Daten nicht eindeutig trennbar.

## 5. Unnötiger Richtungswechsel und Lade-Neustart

Obwohl `b_entladen=false`, fordert die normale Richtungslogik nach langem Import trotzdem Entladen an. Der Rohwechsel ist um 10:01:23 bestätigt; nach der zusätzlichen AntiFlip-Bestätigung wechselt die wirksame Richtung um 10:01:41 auf 2. Danach liefert der Leistungszweig korrekt weiterhin 0 W, weil Entladen gesperrt ist. **Die Sperre schützt die Leistung, verhindert aber noch nicht den nutzlosen Richtungswechsel.**

Nach dem Lastabfall um 10:02:05 steht wieder PV-Überschuss bereit, der Zähler liegt bei −403 W. Die interne Ladebestätigung und AntiFlip müssen zunächst wieder durchlaufen werden. Erst nach 8,284 s folgt die erste Ladeanforderung von 60 W; drei aufeinanderfolgende Fensterpunkte beginnen nach 26,004 s.

Die V4.21-Testkorrektur hält bei vorhandener PV und bereits aktiver Laderichtung diese Richtung, solange die Entladung gesperrt ist. Bei Lastüberschuss reduziert der unveränderte Ladezweig die Ladeleistung weiterhin auf 0 W. Bei wieder verfügbarem PV-Überschuss beginnt die normale 60-W-Aufwärtsrampe sofort. Bei bereits aktiver Entladerichtung, PV unter/gleich 50 W, Netzladen, OFF und freigegebener Entladung bleiben die bisherigen Entscheidungen erhalten. Eine Entladefreigabe durch diese Änderung findet nicht statt.

## 6. PV-Sprünge und Tagesmodell

Die beiden großen Wolkenlücken erreichen 753/831/846 W und kurz 734 W. Im ersten Fall beginnt die High-PV-Begrenzung mit zwei unbestätigten 45-W-Schritten. Danach wird Import erkannt. Beim Rückfall 846 → 683 W bleibt der vorhandene Fall-Schutz über die PV-Klassengrenze aktiv. Der Guard war 15 Punkte aktiv, elfmal im Fall-Nachlauf und viermal mit tatsächlich beschleunigter Abwärtsrampe; seine Erhöhungsbegrenzung griff zweimal. Ein stabiler High-PV-Zustand wurde nie bestätigt.

Die Tagesstrecke wird getrennt von der Nachtstrecke modelliert. Ladetelemetrie enthält einen deutlich anderen stationären Offset: in HOLD liegt `Batterietelemetrie − Ladeanforderung` median bei −14 W. Der vollständige affine Fit lautet näherungsweise `B = 1,01313 · Ladeanforderung − 19,27 W`. Er beschreibt auch den negativen Standbywert. Der Offset ist ein effektiver Modellwert, keine eindeutig identifizierte Verlustleistung und keine hier eingeführte neue Reglerkorrektur.

Für den Zähler werden begrenzte Lade-Stellantwort und relative PV-Zeitlage getrennt angepasst. Die beste vollständige Anpassung besitzt eine effektive PV-Phase von ungefähr −1,52 s: Der Zählerbeitrag liegt im Modell zeitlich vor dem gemeldeten PV-Signal. Das ist eine Hypothese über Register-/Messzeitlage und innere Glättung. Die fast gleichen Empfangszeiten des Snapshots beweisen keine gleichen internen Messzeitpunkte. Die negative Phase nutzt im Offline-Modell den späteren PV-Verlauf zur Rekonstruktion; **der simulierte und neue echte Regler erhalten ausschließlich den zum jeweiligen Zeitpunkt gemeldeten PV-Wert, keinen zukünftigen Wert.**

Die Fit-Grundlast von etwa 87 W ist ein Modell-Intercept unter fest gewählter Zählerverstärkung; sie ist keine unabhängig verifizierte Hauslast. Ohne diese relative PV-Anpassung erreicht die rekonstruierte ruhige Hausleistung in Einzelpunkten unplausible −8 bis +269 W. Mit der vollständigen Anpassung liegt sie ungefähr zwischen 53 und 145 W. Das macht das Modell plausibler, beweist aber noch keine eindeutige physikalische Zerlegung.

| Modellprüfung | Fehler |
|---|---:|
| Batteriemodell mit ersten 260 Punkten angepasst | Kalibrier-RMSE 2,06 W |
| Dasselbe Batteriemodell auf den folgenden Punkten | RMSE 10,91 W |
| Batteriemodell auf vollständigem Log angepasst | Anpassungs-RMSE 7,46 W |
| Zählermodell ohne relative PV-Phase, vollständiger Fit | Anpassungs-RMSE 15,37 W |
| Zählermodell mit PV-Phase, vollständiger Fit | Anpassungs-RMSE 6,74 W |
| Zählermodell aus ersten 260 Punkten auf spätere Punkte außerhalb des Lastimpulses | RMSE 11,56 W |
| Geschlossene Basissimulation gegen gemessenen Zähler | RMSE 18,97 W; MAE 12,10 W |

Die vollständigen Fits verwenden alle Ereignisse und sind keine unabhängige Zukunftsprüfung. Die zeitlich späteren Prüfwerte enthalten echte kleine Lastwechsel und können diese nicht von Modellfehlern trennen. Mehrere Dynamikwerte liegen nahe den Suchgrenzen; die frühe Kalibrierung liefert andere Stellraten und Zeitkonstanten. Der nominale geschlossene Vergleich erreicht nur 18,01 % Fensterzeit gegenüber gemessenen 31,22 %. Er ist deutlich ungenauer als beim Nachtlog; kleine P-/I-Vorteile dürfen daraus nicht als sichere Anlagenverbesserung abgeleitet werden.

Die Gegenversuche halten die nominal rekonstruierte äußere Nettolast `Zähler − modellierte Lade-Netzwirkung` für alle Kandidaten fest. So wird ein Last-/PV-Sprung nicht doppelt über den abgeleiteten `p_haus` in einen neuen Regler kopiert. Zehn Fälle prüfen Verzögerungen ±0,4/0,5 s, langsamere/schnellere Antwort, früh kalibrierte Pfade, einen alternativ ohne PV-Phasenanpassung kalibrierten Zählerpfad und ±3 W Telemetrieoffset. Das sind Sensitivitäten ohne Wahrscheinlichkeits- oder Konfidenzaussage. Die Befehlszustellung wird FIFO angenommen; echte ACK-/Anwendungsdaten fehlen weiterhin.

![Tagesmodell und simulierte Testvariante](Regler_Tag_Modell.svg)

## 7. Welche Fälle lassen sich zusammenlegen?

| Bestandteil | Bewertung | Umsetzung |
|---|---|---|
| Sieben Lade-Parameter-Auswahlzweige | Ja, strukturell | Eine Tabelle nach PV-Klasse und Import-/Exportseite; alle bisherigen Zahlen und Statusnamen bleiben erhalten |
| I-Parameter der drei Lade-Importzweige | Ja, bereits exakt identisch | Gemeinsame Konfiguration: Gain 0,0014; Maximum 2 W; Mindestfehler 8 W; Abbau 0,35 |
| P der drei Importzweige | Noch getrennt | 1,02 / 1,00 / 1,04 bleiben erhalten; High-/Very-High-PV zu schwach beobachtet |
| Low-/Normal-PV-Exportwerte | Im Prinzip möglich, aktuell nicht belastbar vorteilhaft | Kein gemeinsamer neuer P-/I-Satz übernommen |
| High-/Very-High-PV-Fenster und Schutz | Beibehalten | Nur vier High-PV-Punkte und kein Very-High-PV-Punkt; unterschiedliche Zielmitten und Guard-Werte |
| Entladen gesperrt während aktiver Laderichtung mit PV | Mit Laden/Standby zusammenführen | Kein neu angeforderter Wechsel auf die gesperrte Entladerichtung; positive Hauslast bleibt absichtlich aus dem Netz gedeckt |
| Netzladen, OFF, SOC-Sperren, aktives Entladen | Weiterhin eigene Betriebsbedingungen | Unterschiedliche Freigaben und Ziele; nicht als gleicher Regelzustand behandeln |

Der gemeinsame Auswahlschritt ist gegenüber V4.20 über alle vier Nachrichten in 1687 Punkten der drei richtigen Logs exakt gleich. Zusätzlich bestehen 2304 Kombinationen um PV-/Fenstergrenzen, beide Richtungen und frische/gehaltene Batteriedaten. Das ist eine Codeäquivalenzprüfung; es validiert keine zuvor nicht betriebenen PV-Hardwarebereiche.

Ein zusätzlicher Versuch vereinheitlicht Low-/Normal-PV-Export auf gemeinsames I = 0,007 / 12 W / 7 W / 0,84 und folgende P-Werte. Er wird gegen dieselbe Basis ohne Richtungsfix verglichen:

| Gemeinsamer P | Schlechteste MAE-Änderung im erlaubten Zielbereich | Schlechteste Exportenergie-Änderung |
|---|---:|---:|
| 0.96 | 1,84 W | +0,129 Wh |
| 0.98 | 3,81 W | +0,247 Wh |
| 1.0 | 3,73 W | +0,309 Wh |

Keiner dieser drei Parameterkandidaten verbessert alle zehn Fälle. Diese begrenzte Suche beweist nicht, dass jede denkbare Zusammenlegung schlechter wäre. Sie reicht aber nicht aus, um neue gemeinsame Regelwerte als Verbesserung auszuliefern.

## 8. V4.21-SIM: Nutzen und Grenzen der kleinen Verhaltensänderung

Für die Modellbewertung wird die Lademitte auf den mit erlaubter Ladeleistung 0…2.400 W erreichbaren Netzbereich projiziert. Wenn Hausbedarf über PV liegt und Entladen gesperrt ist, wird Ladeleistung 0 zum erlaubten Ziel. Die große verbotene Entladeanforderung ist dadurch kein Optimierungsziel. Dieses stationäre Ziel berücksichtigt noch keine unvermeidbare Stellverzögerung.

| Im selben nominalen Tagesmodell | Basis V4.20, im Tagesbereich wie V4.19 | V4.21-SIM |
|---|---:|---:|
| MAE zum erlaubten stationären Ziel | 30,74 W | 28,07 W |
| Gesamte Importenergie | 12,664 Wh | 12,632 Wh |
| Gesamte Exportenergie | 5,789 Wh | 4,943 Wh |
| Richtungswechsel | 2 | 0 |
| Erste Ladeanforderung nach Lastabfall | 8,28 s | 0 s, am ersten verfügbaren Regeltakt |
| Drei folgende Fensterpunkte beginnen | 28,00 s | 26,00 s |

Alle zehn Fälle zeigen geringere MAE zum erlaubten Ziel und weniger Exportenergie; die Exportreduktion liegt etwa zwischen 0,78 und 0,88 Wh. **Nicht jede Ausregelzeit wird kürzer:** in einem Fall wird sie 36 statt 28 s. Die Importenergie kann in einem Fall um bis zu 0,346 Wh steigen, die positive Nachlaufspitze nach dem Lastabfall um bis zu 20 W. Die sofortige Ladeanforderung verhindert keine reale Stellverzögerung und garantiert kein kleineres Überschwingen in jedem Fall.

Die Änderung ist deshalb eine nächste Testvariante mit nachvollziehbarer Betriebslogik, keine vollständige Tagesoptimierung. Die bisherige Lade-HOLD-Logik, die ursprünglichen P-/I-Werte, 60-W-Aufwärtsrampe, 130-W-Normal-Abwärtsrampe, High-PV-Fenster und Schutz bleiben erhalten. Die V4.20-Nachtänderung ist als Basis enthalten; sie wird durch dieses Tageslog weiterhin nicht an der Anlage bestätigt.

## 9. Optimierungsgrenze und nächster Test

Der erlaubte Netzbezug bei hoher Hauslast und gesperrter Entladung ist eine Betriebsstrategie-Grenze. Durch stärkeren P-/I-Einsatz darf diese Vorgabe nicht umgangen werden. Nach Ladestopp ist dort keine vollständige Deckung durch den Regler gewollt.

Im laufenden Tages-Ladebetrieb ist die natürliche Optimierungsgrenze noch nicht nachgewiesen. Die mittlere Mittenabweichung ohne den großen Lastimpuls ist rund 25 W, die Lade-HOLD-Zone hält noch das ganze Fenster, und ein unnötiger Richtungszyklus verzögert den Wiederbeginn. Gleichzeitig setzen schnelle PV-Änderungen, rund 0,86 s Snapshot-Alter, interne Messzeitlagen und verzögerte Stellantwort echte Grenzen. Die ruhige Nachtgrenze von unter 1 W ist kein erreichbares Tagesversprechen bei diesem PV-Verlauf.

Für den nächsten Test V4.19 sichern und den vollständigen V4.21-Function-Inhalt mit weiterhin vier Ausgängen einsetzen. Im Energiesparmodus denselben ungefähr 1-kW-Lastimpuls wiederholen, danach die PV-Ladewiederaufnahme beobachten. Weiterhin müssen alle Entladeanforderungen 0 W bleiben. Lade-/Import-/Exportenergie und Gegenspitzen erfassen, statt nur den positiven Gesamtmittelwert zu vergleichen. Für High-/Very-High-PV werden längere Abschnitte ab 720 beziehungsweise 1.050 W benötigt. Reale HTTP-Sende-/ACK-/Anwendungszeiten sind der wichtigste nächste Datengewinn für eine belastbarere Tagesabstimmung.

## 10. Dateien und Reproduktion

- `Regler_V4_21_SIM.js` und die bytegleiche `.txt`: vollständiger Function-Inhalt.
- `Regler_Tagesmodell_V3.json`: skalare Kalibrierwerte und Modellgrenzen.
- `Regler_Tag_Ergebnisse.json`: gemessene und simulierte Ergebnisse.
- `Regler_Tag_Simulation_Paket.zip`: privates Paket mit den drei richtigen Logs, vollständigen Basis-/Testdateien und ausführbarer Auswertung. `python reproduce.py` verwendet gespeicherte Fits; `python reproduce.py --fit` kalibriert neu. Es erfolgen keine Geräte-/Netzwerkzugriffe.
- 10 Prüfgruppen bestanden: Tageswiedergabe, vollständige Nachrichtenäquivalenz, PV-/Fenstergrenzen, erlaubte Entladung, Energiesparsequenz, SOC/OFF, Snapshot/Netzladen, asymmetrisches Fenster, Übereinstimmung der isolierten Verhaltensänderung, begrenzte Modell-/Ausgangsantwort. Die zusätzlichen Überlastfälle sind Begrenzungstests, keine Feldvalidierung.

SHA-256 Tageslog: `9eb9d72d86ef2123f2c9985dae9f66767f7335c3c4f644c95d0fc9682ebc8f64`

SHA-256 V4.21-Code: `2d1863b93df594604811a0b9c2a9eed2d250a671db452418dad061fce35069bc`
