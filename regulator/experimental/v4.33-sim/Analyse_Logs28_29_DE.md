# V4.33-SIM-IDLE3: Live-Validierung mit Logs28 und29

Auswertung vom28.10.2026. **Ruhekompensation und Entladeübernahme funktionieren. Aus diesen Logs folgt kein Änderungsbedarf an Code oder Parametern.** PackState bleibt Entladen; ein interner Standby-/Ladezustandswechsel ist nicht belegt.

## Datengrundlage und Qualität

| Merkmal | Log28 | Log29 |
|---|---:|---:|
| Zeitraum MEZ |15:52:54–16:12:51|16:13:07–16:33:06|
| Datensätze |599|600|
| Ausgeführte Regelaufrufe |597|598|
| Snapshot-Abbrüche |2|2|
| Ruhekompensations-Aufrufe |597|510|
| Normale Entlade-Aufrufe |0|88|

Die Aufrufsequenzen sind innerhalb beider Dateien kontinuierlich; beide erfassen ungefähr20 Minuten. Zwischen den getrennten Aufzeichnungen liegt eine Loggerpause, die nicht als Mess- oder Reglerausfall interpretiert wird. Alle Datensätze tragen `behaviorVersion=4.33-SIM-IDLE3`.

Vier Snapshots werden wegen Zyklusabweichung und Alter verworfen, Alter2736–2816ms bei1800ms-Reglergrenze. Sie zeigen korrekt keine neuen Stellanforderungen und nur Diagnose mit zuletzt vorbereitetem18W-Auftrag. Danach werden Einschwingen/Proben neu begonnen und die Kompensation gehalten. Keine aufgezeichneten Laufzeitfehler; kein Grund, die bestehende Snapshot-Grenze hierfür aufzuweichen.

## Ruhekompensation

| Merkmal | Log28 | Log29, nur Ruhephase |
|---|---:|---:|
| Gültige Batteriemessungen |597|510|
| Davon genau0W |597 (100%)|484 (94,90%)|
| Min./Max. Batterie |0/0W|−3/+3W|
| Mittlere Batterie |0W|+0,0275W|
| Kompensationsauftrag |18W konstant|15–18W, Mittel17,818W|
| PV-Leistung |8–23W|6–24W|
| SOC-Rückmeldung |59% konstant|59% konstant|

**Log28:** Kein künstliches Abschalten nach zehn Minuten, keine driftende Leistung und keine Stellwertpendelung. Aufgezeichnete Batterieleistung durchgehend0W bei18W Ladeanforderung.

**Log29:** Fünf tatsächliche Korrekturen:

| Zeit MEZ | Änderung | Verwendeter Median |
|---|---|---:|
|16:19:37|18→15W|+3W|
|16:19:51|15→18W|−3W|
|16:28:02|18→17W|+1,5W|
|16:29:52|17→16W|+1,5W|
|16:30:06|16→17W|−0,5W|

Die einmalige3W-Gegenkorrektur zeigt, dass eine kurzzeitige positive Abweichung nicht zwingend einen dauerhaften neuen Eigenbedarf bedeutet. Sie erzeugt hier aber keine fortlaufende Schwingung: die Batterie bleibt insgesamt innerhalb±3W, der mittlere Fehler praktisch0. Die späteren1W-Änderungen entsprechen Medianbildung und ganzzahliger Stellauflösung. Aus diesem begrenzten Verlauf ist weder ein zusätzlicher Totbereich noch ein anderer Verstärkungsfaktor als Verbesserung belegt. Insbesondere keine neue Toleranz hinzufügen, solange ausdrücklich0W ohne Reserve gewünscht sind.

Über benachbarte gültige Ruheintervalle integriert ergeben sich in Log28 exakt0Wh am Modbus-Batteriemesspunkt und in Log29 ungefähr+0,0078Wh netto; dort etwa0,0194Wh positiv und0,0117Wh negativ. Verworfene Intervalle und Modusübergänge werden nicht überbrückt. Das ist eine Messpunktbilanz, keine Bestimmung interner DC-Verluste. Angeforderte Ladeenergie während derselben Intervalle etwa5,945Wh und5,021Wh; das sind Sollwertintegrale, keine unabhängig gemessene Netzenergie.

## Normale Entladung hat sofort Vorrang

In Log29 wird `b_entladen` um **16:30:12** vonfalse auftrue geändert. Im selben Regeltakt:

- Ruhekompensation `tracking`→`inactive`;
- Ladeanforderung17→0W;
- normale Entladeanforderung68W;
- gewünschter AC-Modus2.

AC-Modus Ist2 ist im nächsten Datensatz, ungefähr2s später, erfasst. Erste negative Modbus-Leistung−9W nach rund4s; nach6s bereits−71W. Das ist eine Geräte-/Messreaktion nach unmittelbarer Reglerübernahme, kein Warten auf PackState.

Nach30s Einschwingzeit liegt der Zähler im Mittel bei **+6,904W**, Ziel7,5W im Fenster0…15W. **71 von73 Messungen (97,26%)** liegen im Fenster; die zwei übrigen Werte zeigen nur−2W Export. Keine relevante Überschwingung in diesem Abschnitt. Positiver normaler PV-Ladebetrieb ist in diesen beiden Logs nicht enthalten; dessen Vorrang ist softwaregetestet, hier aber nicht zusätzlich live geprüft.

## SOC, PackState und Effizienz

Alle1195 gültigen PackState-Werte sind2/Entladen, auch bei gemessenen0W und Ladeanforderung18W. Der Zustand ist deshalb weiterhin keine verlässliche Abbruchbedingung für die Null-Nachregelung. Er wird unverändert geloggt und nicht künstlich umbenannt.

SOC bleibt in beiden Logs bei59%. Das ist mit dem gewünschten Ruheverhalten vereinbar. Die ganzzahlige Anzeige ist aber für diese Zeitspanne zu grob: die bisher diskutierten18W entsprächen in20min nur6Wh bzw.0,069Prozentpunkten bei8,64kWh. Selbst ein kleiner weiterer interner Verlust könnte bei unveränderter59%-Anzeige vorhanden sein. Ein alter `haUpdatedTs` allein beweist keinen eingefrorenen Sensor: Home Assistant kann einen unveränderten Wert mit altem Änderungszeitpunkt liefern.

Die Kompensation korrigiert den vorhandenen Modbus-Messpunkt. Sie beweist keine interne Abschaltung und keinen besseren intrinsischen Wandlungswirkungsgrad. Eine Effizienz von60/70/80% lässt sich aus diesen kurzen Ruhephasen ohne vollständige Lade-/Entladezyklen und vergleichbare Anfangs-/Endenergie nicht bestimmen. Dafür längere SOC-/Energiebilanzen getrennt für Ladebetrieb, Entladebetrieb und gesperrte Ruhephasen auswerten.

## Code-/Modellprüfung

[Reproduzierbare Replay-Auswertung](validation/Logs28_29_Replay.json) und [Messwerte/Kennzahlen](validation/Logs28_29_Metrics.json). Das Replay führt denselben veröffentlichten Reglercode mit aufgezeichneten Eingängen aus. Die ersten teilweise gefüllten Probenfenster werden aus den Diagnosefeldern rekonstruiert; Trim- und Nachregelzeitpunkte werden aus den beobachteten Zeitphasen verwendet. Keine an die Ergebnisse angepasste physikalische Kennlinie.

**1195/1195 ausgeführte Aufrufe:** Ladeleistung, Entladeleistung, Aktuatorrichtung und Betriebsanzeige exakt reproduziert. Vier Diagnose-Abbrüche unverändert ohne Stellnachrichten. Alle fünf Nachregeländerungen und alle88 normalen Entlade-Aufrufe werden reproduziert.

Der lokale Ruhebedarf liegt hier ungefähr17–18W und wird nachgeregelt; eine universelle feste18W-Konstante wird nicht eingeführt. Die Logs prüfen keine normale Ladekennlinie oder breite Lastsprungdynamik. Deshalb **AnlagenmodellV16 und ReglerV4.33-SIM-IDLE3 unverändert lassen**. Der erreichte Zustand ist eine live bestätigte Null-Nachregelung am Messpunkt, kein Nachweis eines physikalischen Gesamtoptimums.

```sh
node tests/private-logs28-29.cjs /pfad/zum/simulationsordner
```

Das Skript benötigt die privaten Logs28/29 und die vorhandenen Simulationshilfen. Rohlogs werden nicht veröffentlicht.
