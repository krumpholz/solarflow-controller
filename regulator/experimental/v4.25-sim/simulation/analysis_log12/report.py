from pathlib import Path
import json,datetime
from zoneinfo import ZoneInfo
root=Path(__file__).resolve().parents[1];out=root/'results_regler_log12';r=json.loads((out/'Log12_Validierung.json').read_text());f=r['acceptanceFit'];a=r['audit'];m=r['measured']
text=f'''# Log12: V4.25, Lastsprünge und Ladeaufnahme bei fast voller Batterie

Stand: 12.10.2026. Positive Netzleistung ist Import, negative Export. Alle Zeilenindizes sind nullbasiert.

**Entscheidung:** V4.25 bleibt unverändert. Das Simulationsmodell erhält eine optionale, zeitabhängige Ladeaufnahmegrenze. Der große Export während der Abregelphase ist überwiegend eine Anlagengrenze; kleine Importabweichungen außerhalb dieser Phase sind weiterhin ein Reglerproblem. Ein physikalisches Gesamtoptimum ist nicht erreicht bzw. nicht nachgewiesen.

## Datengrundlage und Diagnose

- 685 Datensätze, ausschließlich V4.25-SIM; 14:26:33–14:50:43 MESZ, 24:09 Minuten Wandzeit.
- 527 Lade- und 158 Entladepunkte; PV 432–1.511 W; beobachteter SOC 97/98 %.
- Vollständiger Code-Replay: alle 685 aufgezeichneten Ausgangswerte, Richtungen, Modi, HOLD-, Trim- und Integratorwerte stimmen mit dem bereitgestellten V4.25-Code überein. Keine Konfigurationsabweichung. An Lücken wird der Zustand aus der Diagnose rekonstruiert.
- Alle vorhandenen Kernmessungen und Batterie-Messungen frisch, Snapshots konsistent, BLE-Diagnosebeobachter vollständig und gültig, keine HTTP-Reste.
- 270 HA-Aufrufe mit 270 Abschlussereignissen; Median 112 ms, Maximum 1.176 ms, keine protokollierten Fehler. HA-Abschluss oder übereinstimmender Grenzwert sind keine korrelierte BLE-Gerätebestätigung.
- **35 Reglerzyklen fehlen in 20 Lücken**, größte Lücke 24,005 s. Ausgewertet werden nur zusammenhängend beobachtete Intervalle: 22,26 Minuten. Energien schließen Lücken aus. Gerade beim großen Lastabfall fehlt ein Zyklus.

## Lastsprünge und V4.25

Der Log enthält mehrere Ereignisse: Lastanstieg um etwa 1.947 W (Zeile 375), weiterer Anstieg um 1.983 W (396), Teilabfälle um 902/740 W (406/407) und großer Abfall um 1.932 W (529). Bei der großen Hauslast von rund 4 kW erreicht die Entladeanforderung 2.400 W; verbleibender Import bei begrenzter Entladeleistung ist gesondert zu betrachten.

Beim großen Lastabfall sinkt die Hauslast von 2.049 auf 117 W. PV beträgt dann 504 W, die Batterie entlädt noch mit 1.485 W, der Zähler zeigt −1.872 W. **V4.25 aktiviert `discharge_export_fast` und setzt sofort 0 W Entladeanforderung.**

| Zeit seit erkanntem Abfall | Batterie | Netz | Anforderung |
|---|---:|---:|---|
| 0 s | −1.485 W | −1.872 W | Entladen 0 W |
| +2,001 s | −1.501 W | −1.860 W | Entladen 0 W |
| +6,043 s | −17 W | −355 W | Entladen 0 W |
| +10,044 s | −17 W | −374 W | Laden 60 W |
| +16,045 s | +84 W | −351 W | Laden 240 W |

Wegen der Messlücke zwischen +2 und +6 s ist der genaue Zeitpunkt des Entladeendes unbekannt. Die erste Exportspitze entsteht vor einer möglichen Stellreaktion; die anschließende Richtungsklärung und Laderampe tragen zum weiteren Export bei.

**Keine nachgewiesene Verbesserung gegenüber V4.24 in genau diesem Log:** Der Vergleich beider vollständigen Codes mit denselben aufgezeichneten Eingängen liefert identische Ausgangsleistungen, Richtungen und Modi. V4.24 hätte auch bei diesem Abfall bereits 0 W berechnet. Nachgewiesen sind die korrekte Aktivierung des neuen Zweigs und fehlende Abweichungen bei den übrigen beobachteten Situationen, nicht eine Energieeinsparung durch V4.25.

## Ladebegrenzung getrennt von Reglerfehlern

Ab etwa Zeile 179 fällt die reale Ladeleistung trotz unveränderter Anforderung von 1.235 W kontinuierlich auf etwa 158 W. Die zurückgelesene Einstellung liegt ebenfalls bei 1.235 W. Die Begrenzung passt zum beschriebenen fast vollen Akku; der Log enthält aber keine autoritative BMS-Ladefreigabe in Watt, Zellspannungen oder Temperaturen, die den internen Grund zweifelsfrei bestimmen.

In dieser Phase (179–374) entstehen **67,56 Wh Export**, rund **78,3 %** des gesamten auf beobachteten Intervallen erfassten Exports von 86,24 Wh. Der Zähler erreicht −1.212 W. Diese Energie ist nicht pauschal als Reglerfehler zu bewerten. Mehr P-Verstärkung oder eine größere Aufwärtsrampe können nicht mehr Ladeaufnahme erzwingen.

Der vorhandene Export-Monotonieschutz hält den angeforderten Wert hier bei 1.235 W, obwohl die Berechnung von der sinkenden Batterieleistung ausgeht. Es entsteht keine endlose Erhöhung bis 2.400 W. Das SOC-Maximum-Flag bleibt im gesamten Log false: **ein fehlendes `batt_max` schließt eine reale Ladebegrenzung nicht aus.**

Nach der Entladephase sind wieder etwa 1.289 W Ladeaufnahme möglich. Bei beobachtetem SOC 98 % kommen sowohl etwa 158 W als auch etwa 1.293 W vor. Eine feste Zuordnung „98 % = 158 W Ladegrenze“ wäre deshalb falsch. Am Logende fällt die Aufnahme erneut trotz wachsender bzw. konstanter Anforderung; die kurze Restdauer reicht nicht zur unabhängigen Identifikation einer zweiten vollständigen Abregelkurve.

## Modell V12

Die bisherige Totzeit-, Rampen- und Stellreaktionsdynamik bleibt erhalten. Hinzu kommt eine optionale Aufnahmehülle auf der AC-Batterieleistung:

`B_actual(t) = min(B_nominal(t), C(t))`

`C(t) = C_floor + (C_initial − C_floor) · exp(−(t − t0) / tau)`

Für die erste klare Abregelphase:

| Größe | Ergebnis |
|---|---:|
| Anfangswert, Zeile 180 | 1.174 W |
| Angepasster Grenzwert C_floor | {f['floor_W']:.2f} W |
| Zeitkonstante tau | {f['tau_s']:.2f} s |
| Anpassung | erste 120 s, {len(f['trainRows'])} Punkte |
| Prüfung auf späteren, nicht angepassten Punkten | {len(f['testRows'])} Punkte |
| RMSE der Aufnahmehülle, spätere Punkte | {f['holdout']['rmse_W']:.2f} W |
| Mittlerer Absolutfehler, spätere Punkte | {f['holdout']['mae_W']:.2f} W |
| Größter Absolutfehler, spätere Punkte | {f['holdout']['max_abs_W']:.2f} W |

Die Hülle läuft durch Messlücken zeitlich weiter und wird im Prüfabschnitt nicht erneut auf die gemessene Batterie gesetzt. Die Vergleichsberechnung der alten Stellreaktion setzt dagegen an Lücken neu an; deren Fehler von rund 1.036 W zeigt den fehlenden Begrenzungsmechanismus, ist aber kein fairer allgemeiner Modellgütevergleich. Der neue, streng fortgeschriebene Hüllenfehler von 9,55 W ist die maßgebliche lokale Prüfung.

Mit der Hülle ergibt die gemessene PV-/Hauslastbilanz im Prüfabschnitt etwa **47,45 Wh durch die Aufnahmegrenze bedingten Export**, gegenüber **47,95 Wh gemessenem Export**. Das ist eine modellabhängige Erklärung dieser Phase, kein unabhängig gemessenes physikalisches Minimum. Hauslast-/Netz-/Batteriewerte sind bilanziell gekoppelt; eine gute Netzrekonstruktion ist daher kein zweiter unabhängiger Modellnachweis.

`acceptance_model.py` liefert die ausführbare Begrenzung sowie einen kausalen Verdachtsindikator: hohe SOC-Anzeige, frische Messung, bestätigter Lademodus, ausreichend lange stabile Anforderung, anhaltend große Abweichung zur realen Aufnahme und Export. Er erkennt hier erstmals Zeile 185. Das ist ein Diagnosevorschlag, **kein neuer installierter Node und keine sichere BMS-Erkennung**; Lücken setzen seine Bestätigungszeit zurück.

Aktivierung, Anfangswert und Freigabe der Hülle bleiben externe Szenarioparameter. Eine autonome Vorhersage allein aus SOC ist nicht identifiziert. Änderungen der vorherigen Entladung ändern den Batteriezustand: Die gemessene Abregelkurve darf in solchen Gegenversuchen nicht unverändert als sichere Zukunft übernommen werden. Das Modul ist deshalb standardmäßig optional, nicht global aktiv. Negative Batterieleistung wird nicht durch die Ladehülle begrenzt.

## Verbleibender High-PV-Reglerfehler

Das asymmetrische Ladefenster bleibt −5…+15 W; bei High/VeryHigh ist das gewünschte Betriebsziel −5 W. Keine Fensterverschiebung wird unterstellt.

Vor der klaren Ladebegrenzung liegen 42 als ruhig klassifizierte Punkte vor (zusammen 76,0 s nach Abzug der Lücken). Mittelwert **+1,55 W**, originales Fenster **84,2 %**, importfreie Zeit aber nur **31,6 %**. Die Importenergie ist mit 0,080 Wh klein, das Ziel „Import sehr zuverlässig vermeiden“ ist dennoch nicht erreicht. Die Auswahl verlangt 40 s ohne Lücke und ohne größere Last-/PV-Änderung; sie ist keine langfristige stationäre Validierung.

Ein konkreter Mechanismus ist im Code und Log sichtbar: In Zeile 90 misst die Batterie 1.291 W bei 1.271 W Anforderung, Netz +9 W. Die Istwertbasis plus P-Korrektur ergibt `1291 + 1,3 × (−5 − 9) = 1272,8 W`. Der Monotonieschutz begrenzt auf die bisherige Anforderung 1.271 W – es erfolgt keine weitere Absenkung. Der Ladeintegrator ist auf nichtnegative Werte begrenzt und steht hier bei 0; er kann keinen negativen Korrekturanteil aufbauen. Die spezielle High-PV-Feinführung ist bei positivem Import nicht freigegeben. Damit kann eine reale Abweichung zwischen Batterieleistung und Anforderung einen kleinen Import bestehen lassen.

Eine größere Import-I-Obergrenze allein behebt die fehlende negative Korrekturrichtung nicht. Sinnvolle nächste Kandidaten sind eine gezielte Feinabsenkung bei stabilem kleinen Import oder eine abgesicherte Korrektur der Soll-/Istwertbasis. Sie benötigen Gegenprüfung bei PV-Abfällen, Messrauschen und Freigabe nach Ladebegrenzung. **Daraus wird in dieser Prüfung keine unvalidierte V4.26 erzeugt.**

Ein kurzer Abschnitt nach der Rückkehr zum Laden (586–609, 46 s beobachtet) erreicht −5,35 W Mittelwert und 91,3 % importfreie Zeit. Er zeigt, dass die gewünschte Lage möglich ist, aber nicht zuverlässig über alle Zustände gehalten wird. Dynamische PV-Anstiege werden zusätzlich von der vorsichtigen 20-W-Aufwärtsrampe begrenzt; eine pauschale Beschleunigung wäre keine belastbar geprüfte Lösung.

## Konsequenz für die Anlage

V4.25 weiterverwenden; für diesen Log ist kein Codeaustausch erforderlich. Modell V12 trennt künftig aktive Regelung, vermutete Aufnahmebegrenzung und Übergänge. Für präzisere Diagnose wären – sofern der BLE-Controller diese tatsächlich liefern kann – BMS-erlaubte Ladeleistung/-strom, Zellspannungsmaximum, Temperatur und Begrenzungsgrund nützlich. Ohne diese Werte muss der Zustand als „Ladebegrenzung vermutet“ bezeichnet werden.

Es gibt hier zwei unterschiedliche Grenzen: Bei gesättigter Ladeaufnahme ist erheblicher Export physikalisch plausibel unvermeidbar, solange weder PV abgeregelt noch weitere Last zugeschaltet wird. Bei aufnahmefähiger Batterie besteht dagegen nachweisbar weiterer Optimierungsbedarf in der High-PV-Feinregelung. Aus diesem Log folgt daher ausdrücklich kein allgemeines physikalisches Optimum.

## Dateien und Reproduktion

Das Paket enthält Auswertung, Modell V12, ausführbares Aufnahme-Modul, Diagramm, Replay-Ergebnisse und benötigte Abhängigkeiten. Der Rohlog ist nicht dupliziert; für Reproduktion als `upload/regler_event_log_12.jsonl` im entpackten Paket ablegen. Python benötigt NumPy, SciPy und Matplotlib, Replay benötigt Node.js.

Ausführen: `node analysis_log12/replay.cjs`, `node analysis_log12/compare.cjs`, `python analysis_log12/analyse.py`, `python analysis_log12/report.py`.

V4.25-Quellcode wird nur als unveränderte Referenz beigelegt. SHA256: `70935e53246a01031ad4d93a2959d8b7580b6b267873f43bbcbf62100aed22f0`.
'''
(out/'Log12_Analyse_V25_Ladebegrenzung.md').write_text(text)
