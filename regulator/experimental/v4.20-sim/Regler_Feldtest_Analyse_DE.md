# Feldtest V4.19-SIM, angepasstes Anlagenmodell und Optimierungsgrenze

Ausgewertet: `regler_event_log_1(1).jsonl`, 10.10.2026, 23:11:34 bis 23:31:31 Europe/Berlin. Vergleichsbasis: ausschließlich das zuvor bestätigte richtige V4.18-Log `regler_event_log(20261010-190744).jsonl`. Das verworfene erste Log wird nicht verwendet.

## Ergebnis

**Die Mittenregelung funktioniert an der Anlage. Eine globale natürliche Optimierungsgrenze ist nicht erreicht oder nachgewiesen.** Im ruhigen Betrieb ist der verbleibende Fehler bereits klein; bei Lastanstiegen begrenzt weiterhin die gewählte Regelstrategie die Rückkehr ins Fenster. Die erste Spitze eines unbekannten Lastsprungs und ein Teil der Verzögerung bleiben mit diesen Mess- und Stellwegen unvermeidbar.

Das Modell wurde um getrennte Empfangszeiten, richtungsabhängige begrenzte Stellbewegung, eine lastabhängige Batterietelemetriekennlinie und unterschiedliche Verzögerungen je beobachtetem großen Stellereignis ergänzt. Die neue Testvariante V4.20-SIM erhöht ausschließlich die äußere Fein-Schrittgrenze von 6 auf 15 W. Sie wurde im Modell geprüft, aber noch nicht an der Anlage getestet. An der realen Steuerung erfolgte hier keine Änderung.

## 1. Prüfbasis und tatsächliche Änderungen

- 583 gültige Zeilen über 1197,043 s; durchgehend V4.19-SIM, `REGEL_ENTLADEN`, PV = 0 W.
- Sollfenster unverändert 0 bis +15 W, Mitte +7,5 W. Das Ladefenster −5 bis +15 W mit Mitte +5 W wurde nicht betrieben.
- Alle geloggten Batteriewerte sind frisch; alle geloggten Snapshots bestehen die Zyklusprüfung. 15 Zeitlücken über 3 s, Maximum 5,494 s. Innerhalb dieser Lücken ist keine Änderung der letzten Stellanforderung erkennbar.
- Exakte Codeprüfung: alle 583 Lade-/Entladeausgänge, Modi und HOLD-Zustände werden reproduziert. Die separat geloggte Stellzeitbasis wird berücksichtigt: bei 121 Punkten liegt sie 1 ms vor dem später geschriebenen Statuszeitstempel. Das ist relevant an der 6-s-Grenze.
- 434 HOLD-Punkte: kein HOLD außerhalb der Mitte ±2 W. 47 aktive Feinänderungen, 6 Tracking-Wartepunkte und 6 Punkte mit schneller Exportkorrektur. Insgesamt 58 Änderungen der Entladeanforderung; das ist keine Messung der HTTP-Schreibanzahl.
- Die HTTP-/ACK-Felder sind weiterhin vollständig leer. Genaue Sende-, Annahme- und Anwendungszeiten der erzeugten Anforderungen sind damit unbekannt.

## 2. Gemessene Regelqualität

| Kennzahl | Gesamtes neues Log | Ruhiger Nachlauf ab 23:19:55 |
|---|---:|---:|
| Mittlere Netzleistung | +9,87 W | +7,72 W |
| Mittlere absolute Abweichung von +7,5 W | 27,73 W | 0,79 W |
| Streuung um den jeweiligen Mittelwert | 180,83 W | 0,99 W |
| Zeit im Fenster | 91,67 % | 100,00 % |
| Zeit in Mitte ±2 W | 80,16 % | 97,43 % |

Der Nachlauf umfasst 696,238 s beziehungsweise rund 11 Minuten 36 Sekunden. Er ist eine lange beobachtete ruhige Phase, kein separater Nachweis eines konstanten unabhängigen Hauslastsignals. Davor liegt der Mittelwert vor dem ersten Lastsprung bei +7,44 W, zwischen den Lastzyklen bei +7,18 W und im späteren 2-kW-Plateau bei +6,75 W.

Das Gesamtmittel von +9,87 W liegt noch oberhalb der Mitte; die großen Lastanstiege verursachen den Hauptteil dieser zusätzlichen Importlast. Die ruhige Mittenregelung liegt dagegen nahe dem Ziel. Import-/Exportenergie des Logs: etwa 7,26/3,98 Wh. Zeitanteile und Energie verwenden den letzten Messwert bis zum nächsten Punkt; bei Lücken und Sprüngen besteht Interpolationsunsicherheit.

![Gemessener Feldtest](Regler_Feldtest.svg)

## 3. Lastsprünge: Fortschritt und verbleibender Engpass

Die folgende Ausregelzeit bezeichnet den Beginn von drei aufeinanderfolgenden Punkten im ursprünglichen Fenster, bezogen auf den ersten sichtbaren Lastsprung.

| Ereignis im neuen Log | V4.19-SIM gemessen | V4.18 im früheren Log |
|---|---:|---:|
| Anstieg ~1 kW, 23:12:55 | 28,16 s | 14 s |
| Abfall ~1 kW, 23:14:57 | 6,00 s | 18 s |
| Anstieg ~1,9 kW, 23:17:13 | 34,01 s | 28 s |
| Abfall ~1,9 kW, 23:19:29 | 6,00 s | 18 s |

**Die Rückkehr nach Lastanstiegen ist in diesen Messungen nicht schneller geworden.** Die Lastabfälle werden dagegen deutlich schneller korrigiert. Die beiden Logs unterscheiden sich in Grundlast, genauer Lastentwicklung, zeitlicher Abtastlage und Dauer. Die Tabelle ist eine beobachtete Gegenüberstellung, kein kontrollierter Nachweis einer kausalen Prozentverbesserung.

Beim 1-kW-Anstieg reduziert die Grobregelung den Import nach knapp 4 s bereits von +990 auf +171 W. Nach 10 s bleiben jedoch etwa +30 W. Dann übernimmt die Feinführung: maximal 6 W je frühestens 6 s knapp außerhalb des Fensters. Sie benötigt weitere Schritte bis +13 W nach 28 s. Beim 2-kW-Anstieg liegt der Zähler nach 20 s bei +24 W; die äußere Feinführung bringt ihn erst nach weiteren 14 s auf +14 W. Dieser langsame Nachlauf ist durch die Regelparameter verursacht, nicht durch eine nachgewiesene minimale Stellzeit der Anlage.

Der 2-kW-Anstieg wird zunächst nur teilweise sichtbar: +1.516 W, im folgenden Punkt +1.937 W. Ob das ein realer zweistufiger Einschaltverlauf oder eine interne Zähler-/Abtastwirkung ist, lässt sich aus dem Log nicht entscheiden.

Im 1-kW-Plateau entsteht später ein zusätzlicher kleiner Lastabfall: der Zähler fällt von +4 auf −21 W, während die Anforderung nur um 2 W zurückgenommen wird. Die abgeleitete Hausleistung sinkt dabei um ungefähr 28 W. Das spricht für eine weitere Verbraucheränderung; die gesamte negative Spitze darf nicht als reines Reglerüberschwingen bewertet werden. Die begrenzte Feinführung beseitigt diese Abweichung langsam.

## 4. Modellanpassung an die Anlage

### Empfangszeit statt nur Reglerzeit

Die beiden Modellpfade werden an `snapshot.rxTsByTopic.p_zaehler` und `p_batterie` ausgewertet. Erst danach wird der Regler am geloggten Stellzeitpunkt aufgerufen. Der Median des Snapshot-Alters beträgt 829 ms; der größte akzeptierte Wert beträgt 1.799 ms. Das bisherige Modell bündelte diese Altersanteile in feste Gesamtverzögerungen. Die Empfangszeiten sind keine garantierten internen Messzeitpunkte der Geräte; interne Mittelung und Alter bleiben Teil der effektiven Dynamik.

### Getrennte Antwortpfade und Befehlsreihenfolge

Netzwirkung und gemeldete Batterieleistung besitzen getrennte, richtungsabhängige verzögerte PT1-Pfade mit begrenzter Änderungsrate. Die Zustandsbewegung wird analytisch fortgeschrieben und überschwingt bei festem Ziel nicht. Eine FIFO-Zeitfolge verhindert, dass ein älterer modellierter Befehl nach einer jüngeren Anforderung wieder wirksam wird. Die tatsächliche Schreibwarteschlange ist mangels HTTP-Daten nicht identifiziert; andere Zustellstrategien bleiben möglich.

Der Regler erhält ganzzahlige Messwerte entsprechend der Auflösung des Logs. Kleine Batterierestfehler werden nur in nachweislich beruhigten Stellphasen als begrenztes Messrauschen verwendet. Große Modellfehler an Stellereignissen werden nicht als beliebige äußere Störung in neue Kandidaten hineinkopiert.

### Lastabhängige Telemetriekennlinie

Nach mindestens 8 s unveränderter Anforderung ergeben sich im neuen Log etwa folgende mediane Abweichungen `Batterietelemetrie − Anforderung`:

| Leistungsbereich | Neuer Feldtest | Früheres richtiges Log |
|---|---:|---:|
| unter 250 W | +3 W, 384 Punkte | +3 W, 342 Punkte |
| 700 bis 1.200 W | +6 W, 6 Punkte | +5 W, 37 Punkte |
| 1.700 bis 2.200 W | −3 W, 8 Punkte | −5 W, 13 Punkte |

Ein einziger konstanter Offset oder Verstärkungsfaktor beschreibt diese Werte nicht ausreichend. Für den neuen Nachtbetrieb wird im beobachteten Bereich eine glatte Kennlinie verwendet: `B_soll = u + 1,535 + 11,034·(u/1000) − 6,697·(u/1000)²`. Die Abweichung ist begrenzt; Null bleibt Null. Die sehr wenigen beruhigten Punkte bei hoher Last begrenzen die Übertragbarkeit. Diese Kennlinie beschreibt die gemeldete Leistung und beweist weder einen Zählerfehler noch eine physikalische Verlustkennlinie.

### Variable effektive Verzögerungen

Die großen Zählerreaktionen benötigen in der neuen Anpassung unterschiedliche Verzögerungsanteile vor der Stellbewegung: beim 1-kW-Anstieg etwa 1,00 s, beim 2-kW-Anstieg 1,23 s, beim 1-kW-Abfall 3,24 s und beim 2-kW-Abfall 2,64 s. Hinzu kommen Stellbewegung und das jeweilige Messalter. Diese Werte sind episodebezogene effektive Anpassungen, keine getrennt nachgewiesenen Hardwareparameter.

Ein am ersten Lastzyklus kalibriertes Modell mit fixer Rücknahmeverzögerung erzeugt beim zweiten Abfall kurz eine rekonstruierte Hauslast von etwa 1.595 W statt der benachbarten ungefähr 105 W. Das ist ein Modellartefakt. Mit variablen Verzögerungen liegt die rekonstruierte äußere Last im neuen Log zwischen 98 und 2.032 W. Ein unabhängiger Hauslastsensor fehlt weiterhin: diese Plausibilität ersetzt keine vollständige Identifikation der Strecke.

## 5. Wie gut passt das neue Modell?

| Prüfung | Fehler |
|---|---:|
| Bisheriges Batteriemodell auf dem neuen Log, ohne Anpassung | RMSE 41,75 W; MAE 4,81 W |
| Neuer fester Antwortpfad, nur mit erstem neuen Lastzyklus angepasst | Kalibrier-RMSE 1,21 W |
| Derselbe erste-Zyklus-Pfad auf den folgenden neuen Daten | RMSE 12,74 W; größte Abweichung 184,69 W |
| Vollständig angepasster neuer Telemetriepfad mit Kennlinie und Ereignisverzögerungen | Anpassungs-RMSE 1,18 W; MAE 0,73 W |
| V4.19-SIM geschlossen im nominal angepassten Modell gegen den gemessenen Zähler | RMSE 1,15 W; MAE 0,82 W |

Die vollständige Anpassung verwendet auch den zweiten Lastzyklus und die Kennlinienpunkte des ganzen Logs. **Die letzten beiden Zeilen sind Anpassungsgüte, keine unabhängige Validierung zukünftiger Stelländerungen.** Die 12,74-W-Prüfung zeigt, dass ein starr am ersten Zyklus angepasstes Modell weiterhin wesentliche Streckenunsicherheit besitzt. Der simulierte ruhige Nachlaufmittelwert beträgt +6,98 W gegenüber gemessenen +7,72 W; selbst ein insgesamt guter Verlauf beweist keine Subwatt-Prognosegenauigkeit.

Die acht Modellfälle je Log umfassen die episodebezogene Anpassung, zusätzliche Verzögerung +0,5 s beziehungsweise −0,4 s, 30 % langsamere und 20 % schnellere Stellbewegung, den anderen Nacht-Telemetriepfad sowie schnellere/langsamere große Zählerreaktionen. Je Kandidat ergeben sich 16 Paarvergleiche über beide richtigen Logs. Das sind Sensitivitätsfälle; sie sind weder Wahrscheinlichkeiten noch Konfidenzintervalle. Änderungen der echten Zustellreihenfolge, sehr kurze unbekannte Lastpulse und andere Betriebszustände können außerhalb dieser Fälle liegen.

![Modell und nächste Testvariante](Regler_Modellvergleich.svg)

## 6. Weitere Optimierung: eng begrenzt, noch nicht natürlich abgeschlossen

In einer Suche wurden 38 Kombinationen für P, Aufwärtsrampe, starke Importkorrektur und Feinführung geprüft. Danach wurden 29 Varianten der äußeren Feinführung verglichen. Eine einfache Erhöhung auf P = 1,00 und bis 2.400 W pro Takt kann in mehreren Modellfällen zusätzliche negative Nachlaufspitzen von mehr als 200 W erzeugen. Beim Kandidaten P = 1,00 / 2.400 W steigt die Exportenergie im schlechtesten Paar um 2,17 Wh; die zusätzliche negative Spitze beträgt 243 W. Diese aggressiven Änderungen werden nicht empfohlen.

Die ausgewählte **V4.20-SIM ändert nur `centerTrimMaxOutsideStepW` von 6 auf 15 W**. Normaler P = 0,80, Aufwärtsrampe 1.200 W/Takt, innerer Feinschritt 2 W, 6-s-Wartezeit, ±2-W-HOLD, 30-W-äußerer Arbeitsbereich, Fenster, SOC-Sperren und Richtungslogik bleiben gleich. Die äußere Feinführung erweitert das Sollfenster nicht: sie führt außerhalb weiter zur Mitte und meldet dort kein HOLD.

Die Auswahl verlangt kleinere Gesamt-MAE in allen 16 Paaren, höchstens +0,02 Wh zusätzliche Exportenergie, höchstens 10 W zusätzliche negative Nachlaufspitze nach Lastanstiegen und höchstens 0,25 W Verschlechterung des späteren Mittenmittelwerts. Ein absoluter ±2-W-Mittelwert im gesamten späteren Abschnitt wäre als Kriterium ungeeignet, weil dieser Abschnitt auch kleine reale Lastwechsel enthält und einzelne Basismodellfälle bereits darüber liegen.

Die ausgewählte Variante reduziert tatsächlich die Exportenergie in allen 16 Fällen. Im schlechtesten Fall wird die negative Nachlaufspitze aber um 9 W größer; der spätere Mittelwert verschlechtert sich maximal um 0,085 W. **Auch die kleine Änderung garantiert somit nicht, dass jede einzelne Spitze kleiner wird.** Sie ist ein vorsichtiger nächster Anlagentest, kein bewiesenes globales Optimum.

| Kennzahl im selben nominalen neuen Modell | V4.19-SIM simuliert | V4.20-SIM simuliert |
|---|---:|---:|
| Mittlere absolute Mittenabweichung | 27,84 W | 27,42 W |
| Zeit im Fenster | 91,67 % | 93,68 % |
| Importenergie | 7,09 Wh | 7,05 Wh |
| Exportenergie | 3,99 Wh | 3,95 Wh |
| 1-kW-Anstieg: drei Fensterpunkte beginnen | 28,16 s | 22,16 s |
| 2-kW-Anstieg: drei Fensterpunkte beginnen | 32,01 s | 26,01 s |
| Beide großen Lastabfälle | etwa 6 s | etwa 6 s |

Der Gewinn der Gesamt-MAE beträgt nominal nur 1,5 %. Der größere Nutzen liegt im kürzeren kleinen Importnachlauf. Die deutlich größeren ersten Lastimpulse bleiben erhalten. Die simulierten 32,01 s sind nicht die gemessenen 34,01 s; kleine Mess-/Kennlinienfehler verschieben die Grenze zwischen Grob- und Feinführung und damit ganze Regeltakte.

## 7. Ist die natürliche Optimierungsgrenze erreicht?

**Ruhiger Betrieb: nahe an einer sinnvollen praktischen Grenze.** Das Zählerlog besitzt 1-W-Auflösung. Schon ein ideal ruhiger ganzzahliger Messwert kann von der Halb-Watt-Mitte +7,5 W mindestens 0,5 W abweichen. Gemessen werden im langen ruhigen Abschnitt 0,79 W mittlere absolute Abweichung und 0,99 W Streuung. Die verbleibende Differenz enthält echte kleine Laständerungen, Messrauschen, Abtastung und die gewünschte ruhige HOLD-Zone. Häufigeres Nachstellen kann theoretisch noch Einzelwerte verbessern, jagt aber auch diese Schwankungen; eine strengere ±1-W-Zone zeigt in den untersuchten Fällen keine überall bessere Gesamtregelung. 0,5 W ist nur die Quantisierungs-Unterkante eines idealen einzelnen Messwerts, kein bewiesenes Anlagenoptimum.

**Lastsprünge: keine natürliche Grenze nachgewiesen.** Die ersten unbekannten Änderungen kommen vor einer Reaktion an. Danach sind Messalter, Befehlszustellung und getrennte Batterietelemetrie unvermeidbare Verzögerungen mit dem vorhandenen Aufbau. Ein Teil des langen Nachlaufs entsteht jedoch durch die 6-W-/6-s-Begrenzung und kann noch reduziert werden. Ein idealisierter Referenzregler mit Kenntnis der tatsächlich am Zähler wirkenden Batterieleistung erreicht im nominalen Modell 22,69 statt 27,84 W Gesamt-MAE. Das ist ein Vergleich mit zusätzlicher Information, keine mathematische Untergrenze und keine Zusage einer mit den heutigen Eingangssignalen erreichbaren Verbesserung um denselben Prozentsatz.

**Identifikationsgrenze: derzeit wichtiger als eine behauptete absolute Leistungsgrenze.** Ohne tatsächliche Send-/Anwendungszeiten und unabhängige Lastinformation können mehrere Modelle dieselben Messpunkte erklären, aber neue Befehlsfolgen unterschiedlich prognostizieren. Genauere Befehls- und Zeitdaten ermöglichen einen belastbareren Beobachter der bereits wirksamen und noch ausstehenden Batterieleistung. Größere allgemeine P-/I-Anteile ersetzen diese Information nicht.

## 8. Nächster Anlagentest

1. V4.19-Node exportieren. Optional die vollständige V4.20-SIM-Testdatei einsetzen; vier Ausgänge und vorhandene Verdrahtung beibehalten. Diese Änderung wurde hier nicht an der Anlage angewendet.
2. Wieder denselben Nachtlastablauf mit etwa 1 kW und 2 kW durchführen und dazwischen ausregeln lassen. Erst danach den ruhigen Betrieb mindestens 30 Minuten erfassen.
3. Rückkehrzeit ins unveränderte Fenster, zusätzliche Gegenspitzen und Fehlerenergie vergleichen. Ziel bleibt +7,5 W, nicht 0 W. Ein kürzerer Nachlauf darf nicht durch deutlich größere Exportspitzen erkauft werden.
4. Den vorhandenen Schreibpfad so protokollieren, dass reale Sende-/Antwort-/Anwendungszeit und Wert erkennbar sind. Die jetzigen leeren HTTP-/ACK-Felder helfen dafür noch nicht. Hierfür wird die tatsächliche Schreib-Node-Logik benötigt; aus dem Reglerlog allein lässt sie sich nicht rekonstruieren.
5. Ladebetrieb, PV-Sprünge, Richtungswechsel und SOC-Grenzen separat prüfen. Dieses zweite Nachtlog validiert sie weiterhin nicht.

## 9. Dateien und Reproduktion

`Regler_V4_20_SIM.js` und die bytegleiche `.txt` enthalten den vollständigen Function-Inhalt mit vier Ausgängen. 9 neue Prüfgruppen bestehen: Originalwiedergabe; Gleichheit der vollständigen Testdatei mit dem Kandidaten in allen 16 Fällen; Verhalten außerhalb der PV-Optimierung; OFF/SOC/Entladesperre; alte/ungültige Snapshots und Batterie-Hold; volle Batterie/Netzladung; negatives asymmetrisches Fenster; begrenzte Modellbewegung; kurze Lastpulse und Ausgangsbegrenzung bei 2,6 kW. Der Überlastfall ist ein Begrenzungstest, kein validierter Streckenbetrieb oberhalb der beobachteten 2 kW.

Das private ZIP enthält beide richtigen Logs, die Originalfunktion, V4.19 und V4.20, Modellparameter, Kennlinien-/Vergleichsdaten und ausführbare Skripte. `python reproduce.py` reproduziert die Prüfungen, Simulationen, Suche und diesen Bericht mit gespeicherten Fits. `python reproduce.py --fit` wiederholt zusätzlich die Kalibrierung. Voraussetzungen: Python mit numpy/scipy/matplotlib sowie Node.js. Rohlogs und Anlagenexporte gehören nicht in das öffentliche Repository.

SHA-256 neuer Feldtest: `350bf24dfeb71d4e9dfd0b81a03fdbe345879339270b609ac5f91f69fe31987d`

SHA-256 V4.19-Code: `27554da439a3cfe9437a84f6e3557a732ce47807c12c394a7cccd41fe7fa8b08`

SHA-256 V4.20-Testcode: `e656293385f95c33ca30a7e79bb56138f94f625fe2c98687bf365c362f3e3a33`
