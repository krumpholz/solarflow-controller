# Log10: Lastabfall bei Normal-PV, V4.25-Kandidat

## Bewertung

**V4.24 ist tatsächlich installiert.** Der Log ist für große Lastabfälle bei Normal-PV geeignet, enthält jedoch keinen High-/Very-High-PV-Test. PV379–404W bleibt durchgehend unter720W. Die neue High-PV-Regelung wurde damit noch nicht live validiert.

V4.25 erweitert den bereits vorhandenen schnellen Entladeabbau ausschließlich für **großen frischen Lastabfall mit bestätigtem PV-Überschuss ohne Batterieentladung**. Die allgemeine Regelverstärkung und die Umschaltbestätigung bleiben erhalten. Der Gewinn ist klein; die anfängliche Exportspitze verschwindet nicht. Ein physikalisches Optimum ist nicht nachgewiesen.

## Daten und Diagnose

Original: regler_event_log_10.jsonl, SHA-256`f4a0c764b0f8cc3ee7e73ce6d0150da2c601b96130b53cdb5e6ec9167030a5c8`.

- 586 Punkte,12.10.2026 12:49:21–13:09:21 MESZ.543 Entlade-/43 Ladepunkte. Entladung durchgehend erlaubt.
- Zeitspanne1198,955s; integrierte beobachtete Intervalle1150,978s, rund19,18min.13 fehlende Zyklen in11 Unterbrechungen,keine große Pause. Keine Energieintegration über Lücken. Jede Lücke setzt die bedingte Simulation neu auf.
- Kern-Snapshots und Batterie frisch,alle Snapshot-Anlagen passend. Alle acht BLE-Beobachter vorhanden/gültig,BLE bereit,kein HTTP.63HA-Aufrufe/63Abschlüsse,keine Fehler,median117ms,max318ms. HA-Abschluss belegt keine Gerätebestätigung.
- Vollständiger V4.24-Replay:586/586 identisch bei Stellwerten,Richtung,Modus,HOLD,Integrator und Feinregelungsanwendung. Konfiguration stimmt vollständig mit dem gelieferten TXT-Code überein.
- Eine Snapshot-Altersprüfung lag exakt bei1800ms. Das spätere Statusdatum lag6ms danach. Der Replay verwendet den protokollierten Prüfzeitpunkt, um diesen akzeptierten Grenzfall korrekt nachzurechnen; kein pauschales Aufweiten der Frischegrenze.
- Nach der Lücke bei Zeile542 wird der vor dem Tick liegende Anti-Flip-Zähler aus dem geloggten Nachzustand rekonstruiert. Ohne diese Rekonstruktion würde die Offline-Ausführung fälschlich einen Tick zu früh Laden anfordern.

## Ruhiger Betrieb und Fenster

| Bereich | Netzmittel | Im geltenden Fenster | Bemerkung |
|---|---:|---:|---|
| Vor Lastabfall,538 Punkte |+4,08W|76,08%|Ziel Entladen+7,5W, Fenster0…+15W|
| Nach Ausschluss größerer Störungen/Lücken |+4,27W|79,52%|MAE zur Mitte5,52W; keine reine Nachtregelung|
| Später beruhigtes Laden,20 Punkte |+5,99W|100%|Ziel+5W, Fenster−5…+15W|

Die Entladeregelung bei rund400W PV ist weniger ruhig als die zuvor optimierte Nachtregelung. Das Mittel liegt auf der Exportseite der Entladefenstermitte. Das ist eine reale Einschränkung und kein High-PV-Offseteffekt. Die ruhige Ladephase ist nur etwa38s lang und reicht für eine belastbare zusätzliche Ladeparameteroptimierung nicht aus.

Ruhig-Kriterium:40s seit Episodenbeginn/|dLoadEst|>40W/|dSolar|>30W. Es wird weder anhand günstiger Netzwerte noch konstantem Sollwert selektiert.

![Verlauf](sandbox:/workspace/scratch/4dde54cbfaec/results_regler_log10/Log10_Regelverhalten.png)

## Großer Lastabfall

Bei Zeile538 sinkt die bilanzierte Hauslast von1977W auf84W, also−1893W; PV bleibt403W. Noch gemessene Batterieentladung1569W führt zu Netz−1888W. Der Regler erkennt die Störung im ersten betroffenen Tick und reduziert das Entladesoll1560→53W. Die schnelle Abwärtsrampe ist also nicht der Engpass.

Die53W entstehen aus der normalen PV-Entladeverstärkung0,8:

`1569 + 0,8 × (−1888 − 7,5) ≈ 52,6W`.

Ohne Batterieentladung besteht bereits PV-Überschuss: `Z + Batterieentladung = −1888 +1569 = −319W`. Eine positive Entladeanforderung ist in dieser Lage unnötig. V4.25 verwendet für genau diesen bestätigten Fall die vorhandene schnelle Exportkorrektur mit Verstärkung1,0; daraus entsteht0W Entladesoll.

| Zeit ab erster betroffener Messung | Gemessener V4.24-Verlauf |
|---:|---|
|0s|Netz−1888W,Entladesoll53W|
|2,002s|Netz−1887W,Batterie unverändert−1569W|
|4,001s|Netz−668W,Batterietelemetrie noch−1569W|
|6,001s|Netz−377W,Batterie−99W,Entladesoll0W|
|6…10s|Ein Messzyklus fehlt; keine interpolierte Aussage|
|12,003s|Laderichtung bestätigt,erstes Ladesoll60W|
|20,044s|Ladesoll300W|
|30,044s|Netz+3W; erste von mindestens drei Folgeproben im Ladefenster|

Der scheinbare Lastanstieg um1219W bei+4s und erneute Abfall um1179W bei+6s sind mit der versetzt aktualisierten Netz-/Batterieleistung vereinbar. Die abgeleitete Hauslast ist kein unabhängiger Hauszähler. Diese zwei Deltas werden deshalb nicht als zwei sicher nachgewiesene zusätzliche Lastschaltungen behandelt.

In den **beobachteten** Erholungsintervallen fallen3,5276Wh Export an. Darin ist das fehlende Intervall nicht enthalten. Die erste Spitze ist bei unbekanntem abruptem Lastabfall kausal nicht im Voraus vermeidbar. Ihre Dauer sowie Umschalt- und Ladeaufbauzeiten können grundsätzlich optimierbar sein; sie wurden hier nicht als physikalisch optimal bewiesen.

## Modellprüfung und Grenzen

Das bisherige Entlade-Batteriemodell wird ohne hinzugefügten Residual geprüft: RMSE18,83W über aktive Entladepunkte,MAE3,68W; ruhige TeilmengeRMSE3,35W. Der Einzel-Maximalfehler407,79W betrifft den großen Übergang. Damit ist das Modell im ruhigen Zustand brauchbar, bei diesem Lastsprung zeitlich zu ungenau für eine harte Optimierung der Umschaltzeiten.

Ein Offsetfit aus den ersten zehn Minuten verbessert deren RMSE4,13→2,23W. Auf den späteren Prüfpunkten verschlechtert sich jedoch die MAE3,73→5,66W, RMSE27,28→27,72W. **Dieser Fit wird nicht übernommen.** Nur Modellvalidierung und neue Gültigkeitsgrenzen werden in ModellV10 ergänzt; vorhandene Kennlinien bleiben erhalten.

Die Lade-Ruhephase passt zum alten Lademodell (RMSE1,18W),der dynamische Abschnitt hat dagegenRMSE13,55W. Das belegt keine vollständige Identifikation des Richtungswechsels. Die physikalische AC-Modusreaktion ist nicht separat kalibriert. Standby-Batterierückmeldung und gemischte Lade-/Entladeübergänge bleiben außerhalb der hier optimierten Entladesimulation.

## Simulation und Optimierungsentscheidung

Geschlossene Simulation mit vollständiger Funktion und sieben vorhandenen Entlademodellen, jeweils mit festem Batterie-Residual und ohne Residual. Netzstörung wird für jedes Modell einmal ausV4.24 rekonstruiert und bleibt für alle Kandidaten identisch. Die perfekteV4.24-Reproduktion ist dadurch eine Replay-Prüfung, keine unabhängige Netzpfadvalidierung. Der Eingangslog liefert keinen unabhängigen Hauszähler.

Simuliert wird nur die gemessene Entladephase bis Zeile542. Ein vorgezogener Richtungswechsel oder ein schnelleres späteres Einschwingen wird **nicht** behauptet. Eingänge/Empfangszeiten sind getrennt; Vorhandene outputLimit-Anfragezeitpunkte werden zyklusbezogen übernommen. Zusätzliche virtuelle Stelländerungen verwenden den gemessenen Regler→Anfrage-Median0,089s (60Leistungsaufrufe,0,083…1,549s). Gleiche Transportzeiten über Reglerkandidaten sind eine Annahme, keine Gerätebestätigung und nicht die HA-Ausführungsdauer. Die HA-Ausführungsdauer aus der Diagnose wird nicht als physikalische Stellverzögerung eingesetzt.

Die zusätzliche sichere Regel benötigt:

- aktiven Entlade-Regelzweig;
- frische Batterie und gültiges Batteriedelta;
- Lastabfall >500W/Takt;
- starken Export unter−150W;
- Bilanz ohne Entladung unter−40W: `p_zaehler + battDisNow < −40`;
- bereits bestehende Bestätigung über passende Batterienachführung oder Export-Zähler.

Anschließend benutzt sie die bereits vorhandene schnelle Exportkorrektur. Bei fortbestehendem Bedarf,fehlenden/frischen Daten oder kleiner Störung bleibt die bestehende Entladeregelung maßgeblich. Die bisherige Nachtregelung war bereits durch denselben Schnellzweig abgedeckt.

Nominales Modell: beobachtete Abbauphase(6,001s integrierte Intervalle) Export2,4689→2,4394Wh, Einsparung0,0294Wh. Über sieben Modelle Einsparung0.0000…0.0294Wh, Mittel0.0233Wh; im langsameren alten Nachtmodell innerhalb dieser kurzen Auswertedauer kein messbarer Gewinn. Die erste Spitze bleibt−1888W. Auf späteres Laden wird diese Prognose nicht fortgeschrieben.

![Bedingte Simulation](sandbox:/workspace/scratch/4dde54cbfaec/results_regler_log10/Log10_Simulation_Lastabfall.png)

Allgemeine PV-Entladeverstärkungen0,65/0,75/0,85/0,9/1,0 wurden ebenfalls gegen0,8 geprüft. Sie zeigen keine robuste Verbesserung über Modelle und Residualvarianten; vor allem stärkere Werte verschlechtern die ruhige Regelung deutlich. Die Parameter bleiben deshalb unverändert.

Ein zunächst breiter Schnellzweig auch für Teil-Lastabfälle wurde verworfen:35synthetische Fälle über sieben Modelle ergaben zusätzliche Importenergie. Der endgültige Zweig fordert deshalb echten PV-Überschuss ohne Entladung. Bei diesen35 Gegenfällen mit **fortbestehendem Entladebedarf** entstehen nun exakt die gleichen Ergebnisse wieV4.24. Dies prüft die Abgrenzung, nicht die Aktivierung des neuen Zweigs. Aktivierung ist durch den neuen Feldlog,alle sieben bedingten Modellvarianten und den vollständigen Function-Replay abgedeckt.

## Code und Validierung

V4.25-SIM ist ein kleiner, noch nicht live gemessener Kandidat. Vollständiger Code SHA-256`70935e53246a01031ad4d93a2959d8b7580b6b267873f43bbcbf62100aed22f0`.

- Vollständiger gemessener Log10-Replay: V4.24 exakt586/586.
- V4.25 auf denselben eingefrorenen Messwerten: ausschließlich drei Entladesollwerte53→0W geändert (Zeilen538–540). Kein anderer Stellwert,Richtungsentscheid,Modus,HOLD oder Ziel geändert. Das ist eine Code-Isolationsprüfung, keine geschlossene Live-Prognose.
- Log8:1.186 Punkte,keine Stellwert-/Modus-/HOLD-/Zielunterschiede zwischenV4.24 undV4.25 auf gleichen Eingängen.
- Log9:1.191 Punkte,keine entsprechenden Unterschiede. Damit bleiben die zuvor geprüften High-PV-Einstellungen erhalten.
- Einzelnode-Import enthält genau eine Function mit vier unverdrahteten Ausgängen; Funktion entspricht exaktJS/TXT. Alle Funktionen offline ausführbar,ZIP-Inhalt CRC-geprüft.

## Live-Test

Nur den Inhalt der bestehenden Regler-Function durchTXT ersetzen, bestehende Verdrahtung behalten. Alternativ Einzelnode importieren und alten Regler ersetzen. Ausgänge:1 Richtung,2 Laden W,3 Entladen W,4 Status. Keine parallelen Regler.

Diagnosenodes benötigen keinen Austausch. Im nächsten Log`version=4.25-SIM` prüfen; beim entsprechenden Lastabfall sollte`controlSet.active=discharge_export_fast` und Entladesoll0W erscheinen. Nacht-,Normal- undHigh-PV-Parameter sowie asymmetrische Fenster unverändert.

Nächste Messung: ähnlicher großer Lastabfall bei Normal-PV; zusätzlich ein Teil-Lastabfall mit verbleibendem Entladebedarf. Der bisher fehlende High-PV-Livetest ab720W,idealerweise auch≥1050W,bleibt separat offen. Analyse und Code wurden nicht an der Anlage installiert oder auf GitHub veröffentlicht.
