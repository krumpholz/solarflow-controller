# SOC-korrigierter Batterie-Wirkungsgrad über sieben Tage

[English](README.md) | **Deutsch**

Node-RED-Auswertung für den Batterie-Wirkungsgrad. Der Flow liest Tagesenergiezähler und Ladezustand (SOC), berechnet eine Energiebilanz und veröffentlicht einen Prozentwert in Home Assistant. Er sendet keine Steuerbefehle an die Batterie.

**Berechnungsrevision: 3.3.**

## Was wird automatisch angelegt?

| Bestandteil | Wird beim Import dieses Flows angelegt? |
| --- | --- |
| Eingabesensoren für tägliche Lade-/Entladeenergie | **Nein.** Sie müssen in Home Assistant vorhanden sein; Einrichtung siehe unten. |
| Batterieleistungs- oder SOC-Messung | **Nein.** Eine Geräteintegration oder ein Messgerät muss echte Messwerte liefern. |
| `flow.batt_level` und optional `flow.batt_level_ts` | **Nein.** Eine externe SOC-Erfassung auf demselben Flow-Tab schreibt diese Werte. |
| Kontextspeicher `memoryOnly` und `file` | **Nein.** Vor dem Deploy in Node-RED konfigurieren. |
| Ergebnissensor für den Wirkungsgrad | Der enthaltene HA-Sensor-Knoten kann ihn nach Server-/Entitätskonfiguration und Deploy anlegen, wenn die Begleitintegration installiert ist. |

Das Einfügen nur des JavaScript-Codes in eine Function-Node erzeugt keine HA-Entitäten und liefert auch nicht die benötigten Messzyklusinformationen. Neue Nutzer importieren den vollständigen Flow. Bei einer bereits vorhandenen Installation mit Revision 3.2 genügt der Austausch der Berechnungsfunktion.

## Abhängigkeiten und externe Eingaben

Node-RED und `node-red-contrib-home-assistant-websocket` installieren und mit dem eigenen Home-Assistant-Server verbinden. Für den Ergebnissensor zusätzlich die [Node-RED-Begleitintegration](https://github.com/zachowj/hass-node-red) in HA installieren und einrichten. Der Export nennt Websocket-Paketversion 0.80.3; das ist die Version des Ausgangsexports, keine allgemeine Kompatibilitätsgarantie. Node-RED-Add-on und HA-Begleitintegration sind verschiedene Komponenten. Siehe [Voraussetzungen des HA-Sensor-Knotens](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html).

Bei Installation über HACS nach `hass-node-red` suchen, herunterladen, HA neu starten und anschließend unter **Einstellungen → Geräte & Dienste → Integration hinzufügen** die Integration **Node-RED Companion** einrichten. Für manuelle Installation die oben verlinkte Projektanleitung verwenden.

| Externe Eingabe | Benötigter Wert / Ablage | Bereitgestellt durch |
| --- | --- | --- |
| `sensor.batterie_lade_energie_pro_tag` | Nichtnegative kumulierte **Ladeenergie des Tages**, Einheit exakt `kWh`; Rücksetzung um lokale Mitternacht | HA-Geräteintegration oder Helfer |
| `sensor.batterie_entlade_energie_pro_tag` | Nichtnegative kumulierte **Entladeenergie des Tages**, Einheit exakt `kWh`; Rücksetzung um lokale Mitternacht | HA-Geräteintegration oder Helfer |
| `batt_level` | Zahl oder numerischer Text, 0–100 **Prozent**, Flow-Kontext, Speicher `memoryOnly` | Externe SOC-Erfassung |
| `batt_level_ts` | Optionaler numerischer Unix-Zeitstempel in **Millisekunden**, gleicher Flow/Speicher | Externe SOC-Erfassung; Pflicht bei `requireSocTimestamp: true` |
| `CFG.capacityKWh` | Tatsächliche Batteriekapazität in kWh | Nutzereinstellung in der Berechnungsfunktion |
| `CFG.maxPowerKW` | Maximale Lade-/Entladeleistung in kW; beide Richtungen prüfen | Nutzereinstellung |
| Laufzeit-Zeitzone | Gleiche lokale Zeitzone wie die HA-Tagesrücksetzung | Node-RED-/HA-Konfiguration |

Die Energie-IDs sind aus Kompatibilitätsgründen beibehaltene Beispiele. Bei anderen IDs **beide Current-State-Knoten und `CFG.chargeEntity` / `CFG.dischargeEntity`** anpassen. Nur den Anzeigenamen zu ändern genügt nicht. SOC, Kapazität und beide Zähler müssen dasselbe Batteriesystem und dieselbe Messgrenze beschreiben. PV-Erzeugung und Haus-/Netzverbrauch ersetzen die Batterie-Lade-/Entladeenergie nicht.

Es werden **keine globalen Kontextvariablen benötigt**. `batt_min_s`, `batt_max_s`, Reglerbetriebsart, Preissperren und Batterie-Steuervariablen sind keine Eingaben dieser Berechnung. Die `_eff`-Zyklusinformationen erzeugt der Vorbereitungsknoten intern. Den persistenten Berechnungszustand nicht manuell vorbefüllen.

## Die beiden Tagesenergiesensoren in Home Assistant vorbereiten

### A. Tägliche Batterieenergie ist bereits vorhanden

Vorhandene Sensoren verwenden, wenn Richtung, Einheit `kWh`, Mitternachtsrücksetzung und Messgrenze passen. Unter **Entwicklerwerkzeuge → Zustände** echte Zustände und Attribute kontrollieren, einschließlich Verfügbarkeit und gegebenenfalls `last_reset`. Falls nötig, Wh vorgelagert korrekt in kWh umrechnen; die Einheit nicht lediglich umbenennen.

### B. Getrennte kumulierte Gesamtzähler für Laden und Entladen sind vorhanden

Unter **Einstellungen → Geräte & Dienste → Helfer → Helfer erstellen** zwei **Verbrauchszähler (Utility Meter)** erstellen. Jeweiligen kumulierten kWh-Eingang auswählen, Rücksetzung täglich, kein Zeitversatz, keine Tarife, Nettoverbrauch aus und Deltawerte aus. Für monoton steigende Gesamtzähler „periodisch zurücksetzend“ deaktivieren; bei tatsächlich zurücksetzenden Quellen passend konfigurieren. „Immer verfügbar“ ausgeschaltet lassen, damit Ausfälle nicht absichtlich verdeckt werden. Erzeugte Entitäts-IDs kontrollieren und im Flow zuordnen. Der erste Helfertag enthält nur Energie seit der Einrichtung. Siehe [Verbrauchszähler](https://www.home-assistant.io/integrations/utility_meter/).

### C. Es gibt nur Batterieleistung in Watt

Die vorzeichenbehaftete Batterieleistung vor der Integration in zwei nichtnegative Signale aufteilen: Bei **positiv = Laden** gilt Ladeleistung `max(P, 0)` und Entladeleistung `max(-P, 0)`. Bei umgekehrter Gerätekonvention die Vorzeichen entsprechend ändern. Vorzeichenbehaftete Nettoleistung nicht als zwei getrennte Energiezähler behandeln.

Für jede Richtung einen **Integral-Helfer** erstellen. Bei W als Eingang Präfix `k`, Zeiteinheit `h`, Genauigkeit 3 Nachkommastellen und maximales Teilintervall 60 Sekunden wählen. Für gehaltene, stufenförmige Leistungssignale `left` verwenden; bei anderem Abtastverhalten die Methode prüfen. Daraus entstehen zwei kumulierte kWh-Gesamtzähler. Anschließend daraus die täglichen Verbrauchszähler aus Abschnitt B erstellen. Siehe [Integral-Helfer](https://www.home-assistant.io/integrations/integration/).

Ein optionales vollständiges YAML-Beispiel liegt unter [examples/home-assistant-energy.yaml](examples/home-assistant-energy.yaml). Darin ist `sensor.batterie_power` ein **Platzhalter für deinen echten vorzeichenbehafteten W-Messwert**. Ersetzen und jede erzeugte Entitäts-ID prüfen: Bereits belegte Namen können zusätzliche Suffixe verursachen. Nachgelagerte `source`-Verweise dann anpassen. Die Abschnitte `template`, `sensor` und `utility_meter` mit vorhandener Konfiguration zusammenführen; Hauptschlüssel nicht doppelt anlegen. HA-Konfiguration vor Anwenden/Neustart prüfen. Keine doppelten Helfer erstellen, wenn passende Eingabesensoren bereits existieren. Die Verfügbarkeitsbedingung im Template verhindert, dass eine nicht verfügbare Quelle als echte Null-Watt-Messung dargestellt wird; siehe [Template-Sensoren](https://www.home-assistant.io/integrations/template/).

Das Beispiel erzeugt kein physisches Messgerät, keine SOC-Quelle und keine fehlende Vergangenheit. Ein eingefrorener, weiterhin numerischer Leistungssensor kann trotzdem falsche integrierte Energie liefern. Die Quellenfunktion muss vorgelagert überwacht werden. Softwareintegration ist eine Näherung und kann Ausfälle nicht zuverlässig rekonstruieren; Zähler mit den Energieaufzeichnungen des Geräts vergleichen. Beide Richtungen an derselben AC- oder DC-Messgrenze erfassen, einschließlich der vorgesehenen Hilfsverbräuche.

## SOC auf demselben Node-RED-Tab bereitstellen

Die echte Batterie-SOC-Integration oder den Messwertempfänger verwenden und einen geprüften Prozentwert an eine externe Function-Node auf **demselben Tab** wie diesen Flow übergeben. Der Schreibknoten ist nicht enthalten, weil die Quelle anlagenspezifisch ist. Dieses Beispiel erwartet in `msg.payload` den neu empfangenen SOC, kein vollständiges HA-Ereignisobjekt:

```js
const raw = msg.payload;
const soc = (typeof raw === "number" ||
    (typeof raw === "string" && raw.trim() !== "")) ? Number(raw) : NaN;
if (!Number.isFinite(soc) || soc < 0 || soc > 100) {
    flow.set("batt_level", null, "memoryOnly");
    flow.set("batt_level_ts", null, "memoryOnly");
    return null;
}
flow.set("batt_level", soc, "memoryOnly");
flow.set("batt_level_ts", Date.now(), "memoryOnly");
return msg;
```

Den Zeitstempel nur beim Eingang einer echten aktuellen Messung setzen; für verzögert eintreffende Nachrichten stattdessen einen verlässlichen Quellenzeitstempel verwenden. Wiederholtes Lesen eines alten HA-Zustands macht ihn nicht frisch. Ein Ereignis nur bei Zustandsänderung bleibt bei konstantem SOC möglicherweise aus und beweist allein keine regelmäßige Quellenaktualisierung. Ist die Aktualität nicht nachweisbar, nur `batt_level` bereitstellen, einen alten `batt_level_ts` entfernen und `requireSocTimestamp: false` beibehalten. Die Diagnose meldet dann ausdrücklich ungeprüfte Aktualität. Bei vorhandenem Zeitstempel werden Werte älter als `maxSocAgeMs` (120 Sekunden) oder aus der Zukunft auch im optionalen Modus abgelehnt. Zehntelprozent nur umrechnen, wenn dies tatsächlich die Quelleneinheit ist. Nach einem Node-RED-Neustart die Speicherwerte neu aus der Quelle befüllen.

`soc_freshness_verified` prüft Vorhandensein und zulässiges Alter des übergebenen Zeitstempels; die Berechnung kann dessen Erzeugung im externen Schreibknoten nicht überprüfen. Wird `batt_level_ts` nach einer Current-State-Abfrage mit `Date.now()` gesetzt, bestätigt `true` nur eine kürzliche Abfrage, keine frische BLE-/Gerätemessung. Für Geräteaktualität ist ein verlässlicher Quellenbeobachtungszeitstempel erforderlich.

## Kontextspeicher und Einbau

Benannte Speicher in Node-RED `settings.js` konfigurieren und mit vorhandenen Einstellungen zusammenführen. Das Node-RED-Benutzerverzeichnis muss dauerhaft gespeichert sein. Nach Änderungen an diesen Einstellungen Node-RED neu starten.

```js
contextStorage: {
    default: "memoryOnly",
    memoryOnly: { module: "memory" },
    file: { module: "localfilesystem", config: { cache: true, flushInterval: 30 } }
}
```

Die Funktionen benötigen synchronen Zugriff mit Cache. Schreibvorgänge auf den Datenträger werden gebündelt; bei abruptem Stromausfall können noch nicht geschriebene Änderungen fehlen. Das ist keine Garantie gegen Datenverlust auf dem Datenträger. Siehe [Node-RED-Dateikontext](https://nodered.org/docs/api/context/store/localfilesystem).

1. Beide kWh-Tageszähler, SOC-Schreibknoten und Kontextspeicher wie oben vorbereiten.
2. **Eine** Sprachversion importieren: [flow_DE.json](flow_DE.json) oder [flow.json](flow.json), auf den Tab des SOC-Schreibknotens. Beide Exporte teilen IDs/Kontextschlüssel und dürfen nicht gleichzeitig laufen.
3. Eigenen HA-Server in beiden Current-State-Knoten und in der Konfiguration der Ausgabeentität auswählen. Importierten Serverplatzhalter ersetzen oder entfernen; Verbindung passend zum Add-on oder eigenständigen Betrieb konfigurieren. Zugangsdaten nicht veröffentlichen.
4. Beide Eingabe-IDs in Knoten und Code abgleichen. Die Current-State-Ausgaben müssen das HA-Entitätsobjekt in `msg.data` und den Zustand als Text in `msg.payload` behalten; `_eff` nicht überschreiben.
5. Kapazität und Leistung passend zur Hardware einstellen. **8,640 kWh und 2,4 kW sind Beispielvorgaben, keine automatische Geräteerkennung.** Verzögerungs-/Auflösungseinstellungen unten prüfen.
6. Node-RED-Zeitzone an HA angleichen, beispielsweise `Europe/Berlin`, wenn passend. Enthaltenen Fünf-Sekunden-Auslöser und Verdrahtung mit zwei Ausgängen beibehalten.
7. Deployen, Diagnose-Debug-Knoten aktivieren und Ergebnissensor in HA kontrollieren. Anzeigename: `Lade Entlade Effizenz` (DE) / `Battery Efficiency Estimate` (EN). Die tatsächliche Entitäts-ID vergibt HA; sie kann abweichen oder einen Suffix erhalten. Bei Updates vorhandene Zuordnungen weiterverwenden.

Current-State-Knoten lesen vorhandene Entitäten. Nur der HA-Sensor-Knoten veröffentlicht die Ergebnisentität und benötigt die eingerichtete Begleitintegration. Der reine Austausch des JavaScript-Codes einer bestehenden Berechnung legt keinen weiteren Sensor an.

## Berechnung, Teilpuffer und Einordnung

Das erste vollständige gültige Messpaar speichert einen Ausgangspunkt und gibt Unbekannt aus. Spätere akzeptierte Messpaare liefern:

```text
Ladeenergie = aktueller Ladezähler - vorheriger akzeptierter Ladezähler
Entladeenergie = aktueller Entladezähler - vorheriger akzeptierter Entladezähler
Speicheränderung = capacity_kWh * (aktueller SOC - vorheriger akzeptierter SOC) / 100
Wirkungsgrad (%) = 100 * (Summe Entladeenergie + Summe Speicheränderung) / Summe Ladeenergie
Verluste (kWh) = Summe Ladeenergie - Summe Entladeenergie - Summe Speicheränderung
```

Das Fenster umfasst **heute und die vorherigen sechs lokalen Kalendertage**. Neue Nutzer beginnen leer: Persönliche Werte oder alte v2-Puffer werden nicht importiert. Ein Prozentwert erscheint, sobald mindestens 0,1 kWh berücksichtigte Ladeenergie vorliegt, das aktuelle Intervall akzeptiert ist, SOC-Daten gültig sind und das Ergebnis endlich zwischen 0 und 100 % liegt. **Ein vollständig gefüllter Siebentagepuffer ist nicht erforderlich.** Frühere Energie des Starttages bleibt ausgeschlossen, weil die zugehörige SOC-Ausgangsmessung fehlt. Beispiel: 1,0 kWh Laden, 0,7 kWh Entladen, +0,1 kWh Speicheränderung ergeben 80 %.

Im Status stehen Prozentwert, verwendete Tage und erfasste Stunden ohne nachgestelltes „geschätzt“. Verwendete Tage sind keine vollständig gemessenen Tage. `window_complete` bleibt false, weil Mitternachtsintervalle und Ausfälle ausgeschlossen sein können; es ist keine garantiert vollständige 168-Stunden-Messung. Ungültige Ergebnisse werden Unbekannt, niemals auf 0 oder 100 % begrenzt. Beide Ausgänge enthalten das Ergebnis; der zweite dient der Diagnose. Laut Dokumentation setzt der HA-Sensor bei null den Zustand auf Unbekannt; mit den installierten Versionen kontrollieren.

Der SOC ist nur eine Schätzung der gespeicherten Energie. Die Formel setzt annähernd lineare SOC-Energie-Zuordnung und passende Kapazität voraus. Ein Prozentpunkt bei 8,640 kWh entspricht 0,0864 kWh; die Startgrenze 0,1 kWh ist keine Genauigkeitsgarantie. BMS-Neukalibrierungen, Auflösung, Quellenzeitversatz und fehlende Intervalle können kurze Fenster deutlich beeinflussen. Große erkannte SOC-Sprünge werden bestätigt und mit dem zugehörigen Energieintervall ausgeschlossen; kleinere oder allmähliche Neukalibrierungen können unerkannt bleiben. Separate Lade-/Entladewirkungsgrade werden nicht gemessen; ungleicher Anfangs-/End-SOC entspricht keinem vollständigen AC-zu-AC-Zyklustest.

## Verzögerungen, Rücksetzungen und Neustarts

| Parameter | Vorgabe | Bedeutung |
| --- | --- | --- |
| `maxPowerKW` | 2.4 | Physikalische Leistungsbasis für beide Richtungen |
| `powerSafetyFactor` | 1.20 | 20 % Plausibilitätsreserve; keine Geräteleistungseinstellung |
| `maxReportingDelayMs` | 120000 | Tolerierte Meldeverzögerung |
| `counterStepKWh` | 0.1 | Vorsichtige Auflösungstoleranz; tatsächliche Quellauflösung prüfen |
| `maxIntervalMs` | 120000 | Maximale Lücke zwischen gültigen abgefragten Messpaaren |
| `maxSocAgeMs` | 120000 | Höchstalter eines vorhandenen SOC-Zeitstempels |
| `requireSocTimestamp` | false | Erst mit zuverlässigem Zeitstempel-Schreibknoten aktivieren |

Jede Energierichtung hat eine begrenzte Toleranz: `2,4 × 1,20 × 120 / 3600 + 0,1 = 0,196 kWh`. Akzeptierte Zuwächse verbrauchen sie; verstrichene Zeit füllt sie mit 2,88 kW bis höchstens 0,196 kWh auf. Sie bleibt bei normalen Neustarts erhalten und wird nicht bei jeder Abfrage neu gewährt. HA-Abfragen garantieren keine frischen Gerätemessungen; die 120-Sekunden-Toleranz muss zur tatsächlichen Quelle passen.

| Ereignis | Verhalten |
| --- | --- |
| Energiezuwachs über verfügbarer Toleranz oder Abnahme ohne Rücksetzungsnachweis | Unbekannt; letzten akzeptierten Ausgangspunkt behalten und gesamte Differenz zurückstellen. Spätere Übernahme bei plausibler Erholung möglich. Ein dauerhafter Sprung über der maximalen Toleranz wird durch Warten nicht gültig. |
| Echte Abfragelücke länger als 120 Sekunden | Historie behalten, Energie und SOC-Änderung über die Lücke ausschließen, neuen Ausgangspunkt setzen. |
| Mitternacht oder bestätigte Zählerrücksetzung | Grenzintervall ausschließen; beide Zähler und SOC gemeinsam neu als Ausgangspunkt setzen. |
| Überhöhter SOC-Sprung | Zurückstellen; drei aufeinanderfolgende übereinstimmende Kandidatenpaare setzen einen neuen Ausgangspunkt unter Ausschluss des Sprungintervalls. |
| Node-RED-Neustart am selben Tag mit kürzlich gültigem Messpaar | Nach Rückkehr der Eingaben aus dauerhaftem Zustand weiterrechnen. |
| Kapazität, Eingabe-Entitätszuordnung oder Laufzeit-Zeitzone geändert | Vorherigen Zustand archivieren und neu beginnen. |

Ein vorhandenes `last_reset` muss zum aktuellen lokalen Tag gehören. Ohne dieses Attribut müssen beide Tageszähler um Mitternacht Rücksetzungsnachweise liefern. Ungemeldete Rücksetzungen innerhalb eines Tages sind nicht immer erkennbar. Ein reiner HA-Neustart löscht den Node-RED-Kontext nicht; ein längerer Datenausfall löst trotzdem die Lückenbehandlung aus. Der Vorbereitungsknoten meldet nach 15 Sekunden fehlende abgeschlossene Messzyklen, solange Node-RED läuft. Das Tageszählerverfahren schließt bewusst Teile der Energie an Grenzen und bei Ausfällen aus.

## Dauerhafter Zustand und Update bestehender Installationen

| Kontextschlüssel | Speicher | Aufgabe |
| --- | --- | --- |
| `batt_eff_state_v3` | `file` | Tagessummen, letztes akzeptiertes Messpaar, dauerhafte Energietoleranz |
| `batt_eff_previous_state_v3` | `file` | Letztes Archiv nach Konfigurationsänderung |
| `sum_batt_la_7d`, `sum_batt_ela_7d` | `file` | Berücksichtigte Energiesummen in kWh |
| `la_ela_es` | `file` | Aktueller Prozentwert oder null |
| `batt_eff_last_completed_v3` | `memoryOnly` | Interner Überwachungszeitstempel |

Dies sind interne Ausgaben, keine benötigten externen Variablen. Die Summen können von den Roh-Tageszählern abweichen, weil unbeobachtete/ausgeschlossene Intervalle nicht mitgezählt werden.

Revision 3.3 hat **keine automatische v2-Übernahme** und liest die alten Ring-/Live-/Snapshot-Schlüssel nicht. Ein vorhandener v3-Zustand bleibt bei gleichem Tab/Speicher und unveränderter Kapazität, IDs und Zeitzone erhalten. Die kompatible Auswertung bereits mit `legacy` markierter v3-Datensätze bleibt bis zu deren regulärem Herausfallen bestehen: SOC-Korrektur anhand der historischen Fenstergrenzen, bestehende Übernahmemetadaten und Unsicherheitskennzeichnung bleiben erhalten. Es wird nichts erneut importiert. Neue Nutzer erhalten aus dieser Veröffentlichung keine solchen Datensätze.

Für ein vorhandenes 3.2-System Flow/Kontext sichern und nur den Inhalt der Berechnungsfunktion „Batterie Wirkungsgrad“ durch [battery-efficiency_DE.js](battery-efficiency_DE.js) oder [battery-efficiency.js](battery-efficiency.js) ersetzen. Eigene CFG-Werte beibehalten und geänderten Knoten deployen. Zustand nicht löschen und für dieses Update keinen zweiten Flow importieren. Schema `version: 3` bleibt kompatibel; die Diagnose zeigt `calculation_revision: "3.3"`.

## Dateien

Funktionsquellen: [Berechnung](battery-efficiency.js), [Vorbereitung](prepare-cycle.js); deutsche Gegenstücke tragen `_DE`. Der vorhandene [Textdownload](function%20node%20-%20Round-Trip%20Efficiency.txt) entspricht der englischen Berechnung. `build-german-flow.py` erzeugt die deutsche Oberfläche aus dem identischen ausführbaren Rechenkern. Der Flow enthält keine persönlichen Energieverlaufsdaten.
