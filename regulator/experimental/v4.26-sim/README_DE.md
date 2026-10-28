# V4.26-SIM-ZERO1: 0-W-Ruhelage auf Laden

28.10.2026. **Neue Testfassung auf Basis V4.25-SIM-DIAG1.** Bei finalen Sollwerten 0 W Laden und 0 W Entladen fordert der aktive Regler AC-Modus **1 = Laden** an. Damit bleibt das Gerät in diesem Fall nicht allein wegen der internen Entladerichtung im AC-Modus Entladen. Die Hardwarewirkung bei 0 W ist noch live zu bestätigen.

## Downloads und Einbau

- [Vollständiger Function-Code als TXT](Regler_V4_26_SIM_ZERO1.txt)
- [Identischer JavaScript-Code](Regler_V4_26_SIM_ZERO1.js)
- [Import eines einzelnen Function-Nodes](NodeRED_Regler_V4_26_SIM_ZERO1_Import.json)
- [Differenzprüfung mit Logs 15–23](validation/ZeroIdle_Regression.json)
- [Anlagenbeobachtung und offene Hardwarefrage](validation/ZeroIdle_Observation.json)

**Nur den Regler-Function-Code ersetzen.** Beim direkten Einkopieren bleiben die vier vorhandenen Ausgänge und deren Verbindungen bestehen. Beim Import den Function-Node auf denselben Flow-Tab setzen, die bisherigen Verbindungen übernehmen und den alten Regler deaktivieren oder entfernen; nur einen Regler betreiben.

| Ausgang in Node-RED | Anschluss |
|---|---|
| 1, oben | Vorhandener Pfad „AC Richtung Umschalten“ / „AC-Mode Soll / Ist“ |
| 2 | Ladeleistung |
| 3 | Entladeleistung |
| 4, unten | Zusatzdiagnose und Logger |

Messwerterfassung, Zusatzdiagnose, Logger und AC-Richtungsnode benötigen für diesen Einbaupfad keinen Codeaustausch. Die vorliegende Richtungsfunktion verarbeitet weiterhin 1/2; ihre bestehende Dreierserie und Bestätigung bleiben zuständig für die Ansteuerung. Der Regler schreibt nicht unmittelbar an HA oder BLE.

## Neues Verhalten

| Finale Anforderung | AC-Sollrichtung |
|---|---|
| Laden > 0 W | 1 = Laden |
| Entladen > 0 W | 2 = Entladen |
| Laden = 0 W und Entladen = 0 W, aktiver Regler | **1 = Laden** |
| OFF | Keine Richtungsnachricht, beide Leistungen 0 W |
| Ungültiger Snapshot / Laufzeitfehler | Keine Stellnachrichten; Diagnose auf Ausgang 4 |

Die Prüfung erfolgt **nach Runden und SOC-/Leistungs-Failsafes**. Eine durch Entladesperre oder Mindest-SOC auf null begrenzte Anforderung kann somit ebenfalls in die Lade-Ruhelage wechseln. Bei voller Batterie bleibt die Ladeleistung null; eine Lade-Sollrichtung ist keine positive Ladeanforderung.

Die Änderung betrifft die ausgegebene Hardware-Richtung. `flow.richtung`, die interne Richtungswahl, AntiFlip und Integratoren werden dafür nicht umgeschrieben. Deshalb darf die Diagnose gleichzeitig `mode=REGEL_ENTLADEN` und `batteryDirection.payload=1` zeigen: Der logische Regler ist weiter für möglichen Entladebedarf bereit, die Hardware wird bei 0 W geparkt. Sobald die normale Rechnung wieder eine positive Entladeleistung liefert, wird wieder AC-Modus 2 angefordert. Bei häufigem Wechsel zwischen exakt null und kleiner positiver Entladung können dadurch zusätzliche Hardware-Richtungswechsel entstehen; dieser Übergang gehört in die Live-Prüfung.

## Kein positiver Ladeimpuls in dieser Fassung

Die Nutzerbeobachtung beschreibt ungefähr −24 W Restentladung bei Entladeanforderung 0 W, die nach einer kleinen Ladeanforderung um 6 W endet. Das passt zu einem richtungs- bzw. zustandsabhängigen Nullbetrieb. Der vorgelegte Verlauf enthält aber keine getrennt auswertbaren Kurven für beide Leistungssollwerte und den AC-Modus. Er isoliert daher nicht, ob **Laderichtung mit 0 W** bereits genügt oder tatsächlich eine **positive Ladeanforderung** nötig ist.

Zuerst wird der reine Richtungswechsel mit 0/0 W geprüft. **Es wird kein 5-W-Impuls erzeugt**, auch nicht bei Lade-/Entladesperre oder vollem Akku. `pulseEnabled=false` und `pulseW=0` sind Diagnoseangaben, kein Schalter zum Aktivieren einer versteckten Impulsfunktion. Falls bei bestätigter Laderichtung und weiterhin 0/0 W die negative Batterieleistung bestehen bleibt, wäre ein begrenzter 5–6-W-Impuls über ein bis zwei Takte der nächste separat zu prüfende Schritt. Dafür müssten insbesondere Ladefreigabe, Abbruch bei neuem Lastbedarf und einmalige Auslösung berücksichtigt werden.

## Diagnose und Live-Prüfung

Neue Felder: `behaviorVersion=4.26-SIM-ZERO1` und `zeroPowerIdle` mit Aktivität, logischer Richtung, angefordertem/gemeldetem AC-Modus, frischer Batterieleistung und ausgeschaltetem Impuls. `directionConfirmed=true` bestätigt nur den gemeldeten AC-Modus 1; es beweist noch keine Leistungsnull.

Für den nächsten 20-Minuten-Log sind folgende Übergänge wichtig:

1. Aus Entladen kommend erreichen beide Sollleistungen null; Ausgang 1 fordert Laden an.
2. Gemeldeter AC-Modus wird 1; prüfen, ob die etwa −24 W Restleistung danach ohne positiven Ladeimpuls auf null gehen.
3. Ein anschließender Lastanstieg fordert regulär wieder Entladung an.

Die Diagnose läuft weiterhin bei jedem empfangenen Reglertrigger einschließlich Abbrüchen. Derselbe Diagnose-Context-Key erhält die vorhandenen Ablaufzähler. Versionsfelder lauten `version=4.26-SIM` und `diagnosticVersion=4.26-SIM-DIAG1`.

## Prüfung und Grenzen

Zehn gezielte Offline-Testgruppen bestanden: Nullbetrieb, positive Leistungen, Wiederaufnahme der Entladung, SOC-/Freigabesfälle, OFF, Netzladen, Snapshot-Abbrüche, Laufzeitfehler, Abschaltbarkeit und Importdatei.

Differenzprüfung an **5.390 Datensätzen** aus Logs 15–23: **5.324 ausgeführte Aufrufe**, **66 dokumentierte Abbrüche**. Leistungsnachrichten und interne Regelzustände stimmen überall mit V4.25-SIM-DIAG1 überein. Bei **95 Aufrufen** ändert sich ausschließlich die Sollrichtung bei finalen 0/0 W von 2 auf 1. Der alte Nachtlog bleibt bei den Leistungswerten gleich. Unbekannte Lücken in Log 15 werden segmentweise initialisiert; sonst bleibt der Zustand erhalten.

Das ist keine geschlossene Prognose der geänderten Anlage: Die zukünftigen Messwerte können sich durch den Richtungswechsel ändern. Ob die Firmware bei AC-Modus 1 und 0 W die beobachtete Restentladung beendet, ist noch nicht unabhängig gemessen. Modell V16 wird deshalb nicht mit erfundenen Nullpunktparametern überschrieben.

Reproduktion, Node.js mit `structuredClone`:

```sh
node --test tests/zero-idle.test.cjs
node tests/regression.cjs ../v4.25-sim/simulation
```

Für die Differenzprüfung müssen die privaten Logs im dortigen `upload/` liegen. Rückkehr durch erneutes Einfügen von V4.25-SIM-DIAG1; alternativ stellt `zeroPowerPreferCharge=false` in dieser Fassung die alte Richtungsausgabe wieder her.
