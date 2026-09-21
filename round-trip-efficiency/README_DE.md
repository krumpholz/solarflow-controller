# SOC-korrigierte Batterie-Wirkungsgradschätzung über sieben Tage

[English](README.md) | **Deutsch**

Dieser Node-RED-Auswertungsflow schätzt den energetischen Batteriewirkungsgrad anhand täglicher Lade-/Entladeenergiezähler und des Ladezustands (SOC). Er sendet keine Steuerbefehle an die Batterie.

**Stand:** geprüfte Implementierung mit automatisierten Tests in einer simulierten Umgebung. Noch nicht in einer laufenden Home-Assistant-/Node-RED-Anlage validiert. Das Ergebnis ist eine Schätzung und keine zertifizierte Messung des vollständigen Lade-/Entladewirkungsgrads (Round-Trip Efficiency).

## Dateien

| Datei | Inhalt |
| --- | --- |
| [flow.json](flow.json) | Importierbarer Flow mit Auslöser, zusammengehörigen Abfragen, Berechnung, Diagnose und HA-Sensor |
| [battery-efficiency.js](battery-efficiency.js) | Code der Berechnungsfunktion; zwei Ausgänge |
| [prepare-cycle.js](prepare-cycle.js) | SOC-Momentaufnahme, Zyklus-ID und Überwachung fehlender Antworten; zwei Ausgänge |
| [function node - Round-Trip Efficiency.txt](function%20node%20-%20Round-Trip%20Efficiency.txt) | Identische Kopie der Berechnungsfunktion unter dem bisherigen Downloadpfad |
| [tests/efficiency.test.cjs](tests/efficiency.test.cjs) | Automatisierte Regressionstests |
| [VALIDATION_DE.md](VALIDATION_DE.md) | Prüfumfang und noch ausstehende Prüfungen in der Anlage |

**Den vollständigen Flow aktualisieren.** Nur den Code der bisherigen Function-Node auszutauschen reicht nicht: Die neue Berechnung benötigt die Zyklusinformationen des Vorbereitungsknotens und hat zwei Ausgänge.

## Änderungen gegenüber dem bereitgestellten Flow

Der ursprüngliche Export enthielt zwei unabhängige Current-State-Knoten, die Berechnungsfunktion, einen HA-Sensor und Konfigurationsknoten. Ein regelmäßiger Auslöser und der Knoten, der `flow.batt_level` schreibt, waren nicht enthalten.

- Beide Energieabfragen gehören jetzt zu einem nummerierten Messzyklus. Unvollständige, doppelte oder verspätete Antworten vermischen nicht unbemerkt verschiedene Zyklen.
- Unbekannte, nicht verfügbare, leere, boolesche, nicht endliche und negative Energiewerte werden verworfen. Ein SOC-Wert `null` wird nicht als null Prozent behandelt.
- Vorhandene kWh-Historie der Version 2 wird einmalig übernommen, einschließlich Live-Tagesstand oder Snapshot. Die erste zusammengehörige Messung bildet den Ausgangspunkt für NEUE Intervalle; die übernommene Historie bleibt in derselben Bilanz gesondert gekennzeichnet.
- Energie- und SOC-Differenzen beziehen sich auf dieselben akzeptierten Intervallgrenzen. Der zeitlich nachlaufende Zehn-Minuten-Median entfällt.
- Summen und zugehöriger Ausgangspunkt werden gemeinsam in einem automatisch dauerhaft gespeicherten Zustandsobjekt abgelegt.
- Nach einer Lücke oder Rücksetzung beginnt ein neuer Abschnitt. Nicht erfasste Energie und zugehörige SOC-Änderung werden beide ausgeschlossen.
- Schätzwerte außerhalb des gültigen Bereichs erscheinen in der Diagnose. Der HA-Sensor wird auf Unknown beziehungsweise Unbekannt gesetzt, statt auf 0 % oder 100 % begrenzt zu werden.
- Codekommentare, Knotennamen und Statusmeldungen sind englisch. Die Dokumentation ist deutsch und englisch verfügbar. Bestehende deutsche Entitäts-IDs und kompatible Kontextschlüssel bleiben erhalten, damit ihre Verweise weiter funktionieren.

## Einbau und Aktualisierung

1. Sichere den bestehenden Flow und seinen persistenten Kontext. Deaktiviere die alte Wirkungsgradberechnung, bevor du die neue aktivierst. Behalte den ursprünglichen Flow-Tab und seinen Kontext: Daraus wird die Historie übernommen.
2. Prüfe die unten beschriebenen Kontextspeicher. Sind sie bereits vorhanden, **vor der Migration nicht neu starten**: Der aktuelle Live-Tagesstand liegt in `memoryOnly`. Ist ein Neustart erforderlich, sichere den heutigen Stand zuerst mit dem bisherigen Snapshot-Schalter und warte, bis der Dateispeicher geschrieben wurde. Andernfalls lassen sich nur ein vorhandener Snapshot und abgeschlossene Tage aus dem Ringpuffer wiederherstellen.
3. Importiere `flow.json` **auf den bestehenden Flow-Tab, auf dem `flow.batt_level` bereitgestellt wird**. Ein neuer Tab besitzt einen anderen Flow-Kontext. Wähle in beiden Current-State-Knoten und in der Entitätskonfiguration deinen vorhandenen Home-Assistant-Server. Alte und neue Berechnung dürfen nicht gleichzeitig denselben Sensor beschreiben.
4. Prüfe `CFG.capacityKWh`: Die eingetragenen **8,640 kWh** stammen aus der ursprünglichen Anlage und sind kein allgemeingültiger Standardwert. Im JavaScript-Code steht dafür `8.640` mit Dezimalpunkt. Prüfe auch `maxPowerKW` und die Auflösung der Energiezähler.
5. Prüfe beide Energie-Entitäts-IDs in den Current-State-Knoten und in `CFG`. Erforderlich sind täglich aufsummierte Energiezähler in **kWh**, die um lokale Mitternacht zurückgesetzt werden. Die Berechnung prüft zusätzlich das Attribut `unit_of_measurement`. Die Current-State-Knoten verwenden den Zustandstyp String, damit ungültige Ausgangswerte erkennbar bleiben.
6. Der externe SOC-Knoten muss `batt_level` im Speicher `memoryOnly` mit einer endlichen Prozentzahl zwischen 0 und 100 versorgen. Teile diesen Wert nur dann durch zehn, wenn der ursprüngliche Messwert tatsächlich in Zehntelprozent vorliegt.
7. Ergänze möglichst `batt_level_ts` wie unten beschrieben und aktiviere `requireSocTimestamp`. Standardmäßig bleibt der Zeitstempel optional, damit die bisherige Schnittstelle weiter verwendet werden kann.
8. Die Zeitzone der Node-RED-Laufzeit muss zur Zeitzone der täglichen Zählerrücksetzung passen, beispielsweise `Europe/Berlin`. Eine Änderung der Laufzeit-Zeitzone erfordert einen Neustart. Beachte davor die Sicherung des Live-Tagesstands aus Schritt 2.
9. Übernimm die Änderungen mit Deploy und prüfe die Diagnoseausgabe. Der enthaltene Inject-Knoten löst alle fünf Sekunden aus. Ohne Vorgeschichte liefert die erste vollständige Messung Unknown. Mit gültiger übernommener Historie kann sofort deren Schätzwert angezeigt werden. Neue Intervalle werden ab der nächsten akzeptierten Messung ergänzt.
10. Prüfe den Namen und die Entität des HA-Sensors sowie vorhandene Dashboards. Der exportierte Anzeigename lautet jetzt `Battery Efficiency Estimate`. Behalte bei Bedarf die bisherige Entitätszuordnung bei.

Der bereitgestellte Export nennt `node-red-contrib-home-assistant-websocket` **0.80.3**. Der HA-Sensor-Knoten benötigt außerdem die zugehörige Node-RED-Integration in Home Assistant. Die Versionsangabe stammt aus dem Ausgangsexport; sie bedeutet nicht, dass bereits ein vollständiger Kompatibilitätstest in dieser Laufzeit durchgeführt wurde.

### Kontextspeicher

Ergänze diese Konfiguration in der Node-RED-Datei `settings.js`. Andere bereits verwendete Speicher müssen erhalten bleiben:

```js
contextStorage: {
    default: "memoryOnly",
    memoryOnly: { module: "memory" },
    file: { module: "localfilesystem", config: { cache: true, flushInterval: 30 } }
}
```

Die Funktionen greifen synchron auf den Kontext zu. Deshalb muss beim Dateispeicher der Cache aktiviert sein. Jedes akzeptierte Messpaar aktualisiert den zwischengespeicherten persistenten Zustand; der Speicher bündelt die Schreibvorgänge auf den Datenträger. Im neuen Betrieb ist kein manueller Snapshot-Schalter erforderlich. Bei plötzlichem Stromausfall können noch nicht geschriebene Daten trotzdem verloren gehen. Siehe die [Node-RED-Dokumentation zu localfilesystem](https://nodered.org/docs/api/context/store/localfilesystem).

### SOC-Zeitstempel

Aktualisiere im **tatsächlichen SOC-Erfassungsknoten** nach der Prüfung eines neu eingegangenen Messwerts beide Werte gemeinsam:

```js
// socPercent muss bereits als Zahl im Bereich 0..100 geprüft sein.
flow.set("batt_level", socPercent, "memoryOnly");
flow.set("batt_level_ts", Date.now(), "memoryOnly");
```

Erneuere den Zeitstempel nur, wenn eine echte Messung eingeht. Einen alten zwischengespeicherten SOC alle fünf Sekunden auszulesen macht ihn nicht aktuell. Der Vorbereitungsknoten kopiert beide Werte einmal in den gemeinsamen Abfragezyklus.

Mit Zeitstempel verwirft die Berechnung SOC-Werte, die älter als 15 Sekunden sind oder aus der Zukunft stammen. Ohne Zeitstempel meldet sie ausdrücklich `soc_freshness_verified: false`. Mit `requireSocTimestamp: true` werden Werte ohne überprüfbaren Zeitstempel vollständig abgelehnt. Der optionale Zeitstempel-Schreibknoten ist nicht enthalten, weil der ursprüngliche SOC-Erfassungsflow nicht bereitgestellt wurde.

Current State liefert den zuletzt in HA bekannten Entitätszustand, nicht zwangsläufig eine frische Gerätemessung. Gemeinsame Abfragezyklen koordinieren die Abfragen, machen die zugrunde liegenden Messungen aber nicht physikalisch gleichzeitig. Unveränderte Energiezähler können korrekt sein; deshalb dient `last_updated` allein nicht als Altersgrenze. Verfügbarkeit der Quelle und korrekte Energieintegration müssen vorgelagert geprüft werden. Siehe die [Current-State-Dokumentation](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/current-state.html).

## Berechnung und Einordnung

Für jedes akzeptierte NEUE Intervall gilt:

```text
Ladeenergie          = aktueller Tages-Ladezähler - vorheriger Zählerstand
Entladeenergie       = aktueller Tages-Entladezähler - vorheriger Zählerstand
Speicherenergieänderung = capacity_kWh * (aktueller SOC - vorheriger SOC) / 100
```

Für heute und die vorherigen sechs **lokalen Kalendertage** summiert der Flow akzeptierte neue Intervalle und ausdrücklich gekennzeichnete übernommene Altdaten:

```text
Geschätzter Wirkungsgrad (%) = 100 * (Summe Entladeenergie + Summe Speicherenergieänderung) / Summe Ladeenergie
Geschätzte Verluste (kWh)    = Summe Ladeenergie - Summe Entladeenergie - Summe Speicherenergieänderung
```

Das ist eine SOC-korrigierte Schätzung aus der Energiebilanz. Sie setzt voraus, dass die gespeicherte Energie annähernd proportional zum SOC ist und die eingestellte Kapazität zur gemessenen Batterie passt. Separate Lade- und Entladewirkungsgrade werden nicht ermittelt. Bei unterschiedlichen Anfangs- und End-SOC ist das Ergebnis nicht mit einem vollständigen AC-zu-AC-Zyklustest gleichzusetzen. Prüfe, ob die verwendeten Zähler AC-Energie, DC-Energie und gegebenenfalls Hilfsverbräuche erfassen; aus dem bereitgestellten Flow gehen diese Messgrenzen nicht hervor.

Betriebliche SOC-Grenzen sind keine physikalischen Gültigkeitsgrenzen der Messung: Ein tatsächlicher SOC unterhalb eines eingestellten Minimums kann trotzdem korrekt sein. `batt_min_s` und `batt_max_s` werden deshalb nicht mehr zum Verwerfen oder Begrenzen des SOC verwendet. In der bisherigen Formel kürzten sich diese Grenzen bei der Kapazitätskorrektur bereits rechnerisch heraus.

SOC-Werte sind in Stufen aufgelöst und können vom BMS neu kalibriert werden. Bei 8,640 kWh entspricht ein Prozentpunkt in diesem Modell 0,0864 kWh. Die Mindestladeenergie von 0,1 kWh ist nur eine rechnerische Untergrenze und keine Genauigkeitsgarantie. Bei geringem Energiedurchsatz können Schätzwerte schwanken oder außerhalb des gültigen Bereichs liegen. Längere Messzeiträume reduzieren im Allgemeinen den relativen Einfluss der SOC-Auflösung an den Intervallgrenzen. Lücken und wiederholtes Festlegen neuer Ausgangspunkte erhöhen jedoch die Unsicherheit.

## Lücken, Rücksetzungen und Neustarts

| Situation | Verhalten |
| --- | --- |
| Keine v3-Historie vorhanden | Vorhandenen v2-kWh-Ringpuffer und Live-Tagesstand/Snapshot einmalig übernehmen; anschließend einen Ausgangspunkt für neue Intervalle festlegen. Ohne Altdaten mit aktuellen Zählern und SOC beginnen. |
| Neustart am selben Tag; letzte gespeicherte Messung höchstens 120 Sekunden alt | Vom zusammengehörigen gespeicherten Ausgangspunkt fortsetzen, einschließlich der Zählerzuwächse seit dieser Messung. |
| Längere Lücke | Bisherige gemessene Summen behalten; Energie und SOC-Änderung der Lücke ausschließen; neuen Ausgangspunkt festlegen. |
| Lokale Mitternacht | Vorherige Messintervalle behalten; das Intervall über die Tagesrücksetzung ausschließen; mit einem neuen zusammengehörigen Messpaar beginnen. |
| Zählerstand fällt oder Rücksetzungszeitstempel ändert sich | Das Intervall ausschließen und beide Zähler zusammen mit dem SOC neu als Ausgangspunkt übernehmen. |
| Unplausibel großer Energiezuwachs | Intervall ausschließen und neuen Ausgangspunkt setzen; einen Zählersprung nicht als physikalische Energie zählen. |
| SOC-Sprung über Toleranz plus zeitabhängigen Leistungszuschlag | Verwerfen, ohne den Ausgangspunkt der Energiebilanz zu verändern. Drei aufeinanderfolgende, übereinstimmende Kandidatenpaare lösen eine neue Ausgangsmessung aus; das Sprungintervall bleibt ausgeschlossen. |
| Kapazität, Entitäts-IDs oder Laufzeit-Zeitzone ändern sich | Vorherigen v3-Zustand unter einem Archivschlüssel erhalten und einen neuen Ausgangspunkt festlegen. |

Wenn `last_reset` vorhanden ist, muss es den aktuellen lokalen Tag bezeichnen. Ohne dieses Attribut muss beim Tageswechsel für beide Zähler eine Rücksetzung erkennbar sein. Erfolgt die Rücksetzung während eines Ausfalls und ist der Zähler danach bereits über den vorherigen Wert gestiegen, kann der Flow die Rücksetzung nicht herleiten. Er wartet, statt eine durchgehende Messung anzunehmen. Verlässliche Rücksetzungsinformationen sind daher vorzuziehen. Eine nicht gemeldete Rücksetzung innerhalb eines Tages, nach der der Zähler bereits wieder über dem alten Wert liegt, ist nicht immer erkennbar.

Mit den vorhandenen Tageszählern werden Lücken um Mitternacht und unvollständig erfasste Anfangstage bewusst berücksichtigt. `window_complete` ist immer false; `covered_hours` beschreibt die einbezogenen Messintervalle. Es handelt sich weder um garantiert sieben vollständige Tage noch um eine gleitende 168-Stunden-Messung. `excluded_gap_hours` summiert erkannte Zeitlücken beim Festlegen eines neuen Ausgangspunkts. Zeiten vor der ersten Ausgangsmessung sind darin nicht enthalten; der Wert ist keine prozentuale Vollständigkeitsangabe. Für eine vollständigere Erfassung über Mitternacht hinweg wären durchlaufende Gesamtenergiezähler erforderlich.

## Ausgänge und dauerhaft gespeicherte Daten

Die Berechnungsfunktion besitzt zwei Ausgänge:

1. HA-Zustandsnachricht: `msg.payload` enthält einen plausiblen Schätzwert mit einer Nachkommastelle oder `null` (Unknown/Unbekannt), wenn Daten ungültig sind, der Energiedurchsatz nicht ausreicht, ein neuer Ausgangspunkt gesetzt wird oder der Schätzwert außerhalb des gültigen Bereichs liegt. Der HA-Sensor enthält zusätzlich Qualitäts- und Zeitstempelattribute.
2. Diagnosenachricht: dieselben Daten sowie `msg.result` mit unverändertem rechnerischem Wirkungsgrad, Energiesummen, geschätzten Verlusten, Zeitabdeckung, Prüfung der Rücksetzungs-/SOC-Zeitstempel und täglichen Intervallsummen. Aktiviere bei der Inbetriebnahme den enthaltenen Debug-Knoten.

Ein unvollständiges Messpaar liefert normalerweise zunächst keine Ausgabe, solange die zweite Antwort aussteht. Fehlende Antworten werden durch spätere Zyklen und die 15-Sekunden-Überwachung erkannt. Diese Überwachung setzt voraus, dass Node-RED und sein Inject-Knoten weiterlaufen; bei gestopptem Node-RED kann sie nicht arbeiten. `timestamp` bezeichnet bei einer Fehlermeldung den Diagnosezeitpunkt und belegt keine aktuelle Messung.

Laut Dokumentation setzt der HA-Sensor einen null-Zustand auf Unknown. Prüfe dieses Verhalten mit deiner installierten Integration bei der Inbetriebnahme. Siehe die [Sensor-Dokumentation](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html).

| Kontextschlüssel | Speicher | Bedeutung |
| --- | --- | --- |
| `batt_eff_state_v3` | `file` | Versionierte tägliche Intervallsummen und zugehörige letzte Messung |
| `batt_eff_legacy_backup_v3` | `file` | Vor der Migration gesicherter Original-Ringpuffer, Live-Tagesstand und Snapshot, einschließlich älterer Tage |
| `batt_eff_previous_state_v3` | `file` | Zuletzt nach einer Konfigurationsänderung archivierter Zustand |
| `sum_batt_la_7d` | `file` | Übernommene Ladehistorie plus einbezogene neue Intervalle, kWh |
| `sum_batt_ela_7d` | `file` | Übernommene Entladehistorie plus einbezogene neue Intervalle, kWh |
| `la_ela_es` | `file` | Aktueller plausibler Schätzwert oder null |
| `batt_eff_last_completed_v3` | `memoryOnly` | Abschlusszeitstempel für die Überwachung fehlender Messungen |

Die beiden kompatiblen Energiesummen enthalten **übernommene Historie plus einbezogene neue Intervallenergie**, nicht ungeprüft die vollständigen aktuellen Tageszählerstände. Vorhandene Auswertungen müssen diese Änderung berücksichtigen. Bei einem Eingabefehler behalten die Energiesummen ihre zuletzt akzeptierten Werte; der Wirkungsgrad wird als ungültig markiert.

### Automatische Übernahme des vorhandenen Puffers

Beim ersten gültigen Messpaar liest die Funktion `batt_eff_ring_7d` aus `file`, `batt_eff_today_live` aus `memoryOnly` und `batt_eff_today_live_snapshot` aus `file`. Vor der Umwandlung legt sie eine eigene Sicherung unter `batt_eff_legacy_backup_v3` an. **Die ursprünglichen Schlüssel werden weder verändert noch gelöscht.** Alle ursprünglichen Speicherplätze bleiben in dieser Sicherung erhalten. Die aktive Berechnung umfasst heute und die sechs vorherigen Kalendertage, also dasselbe Datumsfenster wie zuvor.

Liegt ein Datum mehrfach vor, hat der Live-Speicher Vorrang. Ein abgeschlossener Tag aus dem Ringpuffer hat Vorrang vor einem älteren Snapshot. Die Migration kopiert die aufgezeichneten Lade-/Entladesummen und berechnet die SOC-Korrektur jedes übernommenen Tages aus dessen gespeichertem Anfangs-/End-SOC und der eingestellten Kapazität. Frühere Messwertauflösung, bereits gefilterte SOC-Werte oder null-Werte, die der alte Code schon in eine numerische Null umgewandelt hat, lassen sich nachträglich nicht reparieren. Verwende dieselbe Kapazität wie in der bisherigen Anlage.

Ein gespeicherter Alttag enthält keine verlässlichen Messzeitstempel. Seine Dauer wird daher nicht in `covered_hours` gezählt. Die Übergangslücke zwischen seinen gespeicherten Zählerständen und dem ersten neuen Messpaar wird nicht stillschweigend geschätzt. Ein veralteter Snapshot erhält somit die aufgezeichnete Historie, kann aber den danach nicht gespeicherten Rest nicht wiederherstellen. Fehlen sowohl der heutige Live-Stand als auch sein Snapshot, werden abgeschlossene Ringpuffertage trotzdem übernommen; der frühere SOC-Ausgangspunkt des heutigen Tages lässt sich jedoch nicht rekonstruieren.

Die neue Schätzung summiert die SOC-Korrekturen der Alttage einzeln. Die alte Berechnung verwendete dagegen den ersten und letzten SOC über das gesamte Fenster. Beide Verfahren sind nur dann gleich, wenn benachbarte gespeicherte SOC-Grenzen übereinstimmen. **Die Energiehistorie bleibt erhalten; ein numerisch identischer Wirkungsgradwert ist nicht garantiert.** Unsicherheiten der übernommenen Daten bleiben über `legacy_days_in_window` und `legacy_migration` erkennbar. Der angezeigte Wert bleibt eine Schätzung.

Bei fehlenden oder ungültigen SOC-Grenzen bleibt die Tagesenergie erhalten. Der Wirkungsgrad wird jedoch als Unknown mit `legacy_soc_boundaries_missing` ausgegeben, solange dieser Tag im aktiven Fenster liegt. Ungültige Energiewerte, nicht unterstützte Einheiten oder ungültige Datumsangaben stoppen die Migration, statt Historie durch null zu ersetzen. Prüfe die Fehlermeldung und Originaldaten vor einer Korrektur.

Auch eine bereits laufende v3-Installation kann noch nicht enthaltene Alttage übernehmen. Überschneidet sich der heutige Tag, wird ein eingefrorener älterer Teil nur dann ergänzt, wenn die lückenlose v3-Bilanz für beide Energierichtungen nachweist, dass keine Doppelzählung entsteht. Andernfalls bleibt der Originaldatensatz in der Sicherung erhalten und das Datum erscheint in `legacy_migration.overlappingDates`. Für die Rekonstruktion seines historischen Anteils muss dieser Konflikt gesondert geprüft werden.

Die erfolgte Migration wird zusammen mit den übernommenen Summen im persistenten Zustand vermerkt. Dadurch werden Daten nach einem Neustart nicht erneut importiert. Nach einer Konfigurationsrücksetzung erfolgt keine erneute Übernahme, weil Änderungen an Kapazität, Zeitzone oder Entitätszuordnung die bisherigen Annahmen ungültig machen können. Das normale Herausfallen alter Tage aus dem Sieben-Tage-Fenster bleibt bestehen. Mehrere Instanzen auf demselben Flow-Tab benötigen unterschiedliche Kontextschlüssel.

## Lizenz und Unabhängigkeit des Projekts

MIT; siehe [LICENSE](../LICENSE). Dies ist ein unabhängiges Community-Projekt ohne Verbindung zu oder Unterstützung durch Zendure. Siehe [Marken- und Projekthinweise](../NOTICE_DE.md) sowie [Haftungs- und Betriebshinweise](../DISCLAIMER_DE.md).
