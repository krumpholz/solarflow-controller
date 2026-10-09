# Batterie-Wirkungsgrad und gleitender 7-Tage-Mittelwert – Release v5.1.0

Release **v5.1.0** verwendet Berechnungsrevision **5.1**, Energie-Pufferschema **4** und ergänztes Mittelwert-Pufferschema **1**. Bestehende Energie- und V5-Mittelwertpuffer werden weiterverwendet. Ausgangsreihenfolge: Mittelwert / bisheriger Wert / Diagnose. Nur ohne vorhandenen Mittelwertpuffer beginnt eine neue Mittelwerthistorie.

[English](README.md) | **Deutsch**

Gleitende 168-Stunden-Energiebilanz aus dem vorzeichenbehafteten Leistungswert des Snapshot-Builders `1.3-SOLAR-G-ESP-BATT-FALLBACK`. Keine Tageszähler als Eingabe erforderlich. Drei Funktionsausgänge: **7-Tage-Mittelwert, bisheriger Wirkungsgrad, Diagnose**, in dieser Reihenfolge. Die bestehende Fassung mit Tageszählern bleibt unter [Release v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency) verfügbar.

## Bestehende Installation umstellen

1. Alten Flow exportieren und Node-RED-Kontext sichern. Flow-Tab, Kontextspeicher und eingestellte Batteriekapazität beibehalten. Nur eine Berechnung darf den Wirkungsgradzustand schreiben.
2. Den **gesamten** Berechnungscode durch [battery-efficiency_DE.js](battery-efficiency_DE.js) ersetzen. **Drei Ausgänge**, `capacityKWh` und `maxPowerKW` einstellen; Vorgaben sind 8,640 kWh und 2,4 kW. Revision 5.1 verlangt standardmäßig einen SOC-Zeitstempel (`requireSocTimestamp: true`).
3. **SOC erfassen und Messzyklus starten** durch [prepare-cycle_DE.js](prepare-cycle_DE.js) ersetzen und **zwei Ausgänge** einstellen. Ausgang 1 **direkt** mit der Berechnung verbinden. Beide Tageszähler-Abfragen aus diesem Pfad entfernen. Die Vorbereitung übernimmt `batt_level_ts` unverändert und erneuert diesen Zeitstempel nicht.
4. Den **vorhandenen gemeinsamen Timer** nutzen: SOC samt Zeitstempel schreiben, etwa **eine Sekunde später** die Vorbereitung aufrufen. Dann muss der Leistungs-Snapshot vollständig vorliegen. Eine feste Verzögerung garantiert keine erfolgreichen Abfragen; die Snapshot-Prüfungen bleiben aktiv. Der importierte Inject-Knoten dient nur als manueller Testknopf: **keine Wiederholung und kein Startimpuls**. Den vorhandenen periodischen Auslöser auch bei fehlenden neuen SOC- oder Leistungsmessungen weiterlaufen lassen.
5. Berechnungsausgang **1** an **Mittelwert für HA aufbereiten** und die Automatik anschließen; Ausgang **2** an **Wirkungsgrad für HA aufbereiten**; Ausgang **3** an die Diagnose. Beide Aufbereitungen verwenden [prepare-sensor_DE.js](prepare-sensor_DE.js) und führen zu normalen HA-API-Knoten. Die Automatik vor der Sensor-Aufbereitung abzweigen, weil diese `msg.payload` in eine API-Anfrage umwandelt.
6. Warnungsausgang **2** der SOC-Vorbereitung standardmäßig **nur an die Diagnose** anschließen. Optional zusätzlich an **Wirkungsgrad für HA aufbereiten**, um den bisherigen Sensor auf unbekannt zu setzen. Keine Verbindung zur Mittelwert-Aufbereitung oder zum Mittelwert-API-Knoten. Der Watchdog setzt nur `la_ela_es` zurück; `la_ela_es_mean_7d` verwaltet allein die Berechnung.
7. Companion-Knoten `ha-sensor` / `ha-entity-config` durch den normalen API-Pfad aus [flow_DE.json](flow_DE.json) ersetzen. In beiden API-Knoten den vorhandenen HA-Server auswählen. Entitäts-IDs im Block `SENSOR` der Aufbereitungsfunktionen konfigurieren; für den bisherigen Sensor gegebenenfalls dessen tatsächliche ID übernehmen. Eine weiterhin von einer anderen Integration verwaltete Entität kann API-Schreibwerte überschreiben; deren alten Schreiber abschalten.

Siehe [Verdrahtungsschema](WIRING_DE.md) und [Sensor-Anbindung ohne Companion-Integration](#home-assistant-sensoren-ohne-companion-integration). Der anlagenspezifische Modbus-/Snapshot-Builder und SOC-Schreiber sind nicht im Import enthalten. Die neuen Nodes auf deren Flow-Tab platzieren und nur eine Sprachversion aktivieren.

Ohne vorhandenen periodischen Berechnungsauslöser einen Takt von etwa zwei Sekunden nach der SOC-Aktualisierung einrichten. Ein Auslöser ausschließlich von Snapshot-Ausgang 11 verarbeitet erfolgreiche Snapshots zeitnah, benötigt aber weiterlaufende Timer-Aufrufe für die Mittelwertauswertung bei ausbleibenden Snapshots. Einen Hauptauslösepfad verwenden und keinen zweiten Timer zu einer bereits getakteten Anlage ergänzen. Wiederholte Snapshot-IDs werden nicht doppelt integriert; überschriebene Zwischenmesspunkte lassen sich nicht rekonstruieren.

**Umstieg von v5.0.0:** Energie- und Mittelwerthistorie beibehalten; beide Schemata bleiben gleich. Berechnung, SOC-Vorbereitung und Sensor-Knoten gemeinsam ersetzen. Beim Umstieg von V4 oder V3 bleibt kompatible Energiehistorie erhalten; die Mittelwerthistorie beginnt dagegen mit neuen gültigen Prozentintervallen. Frühere Energiesummen ergeben keine rekonstruierbare Mittelwerthistorie.

## Erforderliche externe Werte

Die folgenden Werte müssen vom Snapshot-Builder synchron in den **Standard-Flow-Kontext** geschrieben werden. Genau so arbeitet der bereitgestellte Builder. Die Wirkungsgradfunktion liest sie zusammen in einem synchronen Aufruf.

| Schlüssel | Bedeutung |
| --- | --- |
| `p_batterie` | Tatsächlich gemessene Batterieleistung in W: positiv Laden, negativ Entladen; kein Regler-Sollwert |
| `snapshot_last_ok_cycleId` | Eindeutige Kennung des erfolgreichen Zyklus |
| `snapshot_last_ok_ts` | Abschlusszeit des Snapshots, Unixzeit in Millisekunden |
| `snapshot_last_ok_triggerTs` | Auslösezeit des zugehörigen Messzyklus |
| `snapshot_last_ok_quality` | `excellent`, `good` oder `borderline` |
| `snapshot_last_battery_source` | Muss `fresh` sein |
| `snapshot_last_battery_fresh` | Muss `true` sein |

Im expliziten Store **`memoryOnly`** werden zusätzlich benötigt:

| Schlüssel | Bedeutung |
| --- | --- |
| `batt_level` | Batterie-SOC von 0 bis 100 % |
| `batt_level_ts` | SOC-Beobachtungszeit als Unixzeit in ms; standardmäßig erforderlich und bei Erfassung höchstens 120 s alt |

Die Vorbereitung übergibt diese Werte in `msg._eff` und behält den ursprünglichen Beobachtungszeitstempel bei. Ein eine Sekunde alter SOC-Zeitstempel ist gültig. Mit `requireSocTimestamp: true` pausieren fehlende, zukünftige oder veraltete Zeitstempel die Aufnahme; gültige Mittelwerthistorie kann weiterhin verfügbar sein. Die Option nur bei einem bewusst gewählten Altaufbau ohne Zeitstempel auf false stellen; ungeprüfte SOC-Aktualität bleibt ausgewiesen. Ohne dieses Objekt liest die Berechnung die beiden SOC-Variablen selbst. Der BLE-Sensor `sensor.bluetooth_solarflow_solarflow_batterie_soc` kann weiterhin über **SOC -> EMS** liefern. Ein bei jeder HA-Abfrage neu erzeugter SOC-Zeitstempel bestätigt nur den Abfragezeitpunkt, nicht die Aktualität der Messung im BLE-Gerät. `soc_freshness_verified` prüft ausschließlich das Alter des bereitgestellten Zeitstempels.

Die vom Snapshot ebenfalls bereitgestellten `p_batt_in` und `p_batt_out` werden nicht separat benötigt: Beide Richtungen ergeben sich eindeutig aus `p_batterie`. Die Messgrenze muss für Laden und Entladen identisch sein. AC-Messung, DC-Telemetrie und Leistungssollwerte dürfen nicht gemischt werden.

## Kontext und Neustarts

Node-RED benötigt synchron lesbare Stores, zum Beispiel in `settings.js`:

```js
contextStorage: {
    default: "memoryOnly",
    memoryOnly: { module: "memory" },
    file: {
        module: "localfilesystem",
        config: { cache: true, flushInterval: 30 }
    }
}
```

Der V4-Zustand liegt vollständig in `flow.batt_eff_state_v4` im Store `file`: Energie-Minutenpuffer, Leistungs-/SOC-Ausgangspunkt, Übernahmemarker, Ausschlusszähler und ergänztes Objekt `mean` (Schema 1, Prozent-Zeit-Integrale, Abdeckung und letzter gültiger Mittelwert-Messpunkt). Die Dateiablage schreibt zeitverzögert; bei Stromausfall können noch nicht geschriebene Sekunden verloren gehen. Ein normaler Neustart lädt den gespeicherten Zustand, importiert V3 nicht nochmals und ignoriert wiederholte Snapshot-Zyklen. Eine Lücke über zehn Sekunden wird auf beiden Seiten der Energiebilanz ausgeschlossen. Nur eine aktive V4-Funktion darf diesen Zustand schreiben.

Die bisherigen Ausgabevariablen bleiben im Store `file`: `sum_batt_la_7d`, `sum_batt_ela_7d` in kWh und `la_ela_es` als bisheriger Prozentwert oder `null`. Neu ist `la_ela_es_mean_7d` als Mittelwert in Prozent oder `null`. Messfehler setzen den bisherigen Schlüssel zurück; gültige Mittelwerthistorie bleibt im Mittelwertschlüssel verfügbar. Der Watchdog schreibt niemals den Mittelwertschlüssel. Nur fehlende, abgelaufene oder nicht sicher nutzbare Historie ergibt einen null-Mittelwert. Der bisherige Schlüssel behält seine Bedeutung.

## Berechnung und Genauigkeit

Für ein akzeptiertes Intervall mit tatsächlicher Dauer `dt` werden Anfangs- und Endleistung linear verbunden und integriert. Bei gleicher Richtung ist das die Trapezregel:

`E_kWh = (P_alt + P_neu) / 2 × dt_ms / 3 600 000 000`

Bei einem Richtungswechsel wird am rechnerischen Nulldurchgang getrennt: Lade- und Entladeenergie werden nicht miteinander verrechnet. Bei 2.400 W über zwei Sekunden ergeben sich 0,001333333 kWh bzw. 1,333333 Wh. Zwischen Messpunkten unbekannte Lastsprünge können durch keine Integrationsmethode exakt rekonstruiert werden.

Die SOC-Änderung wird nur für dieselben akzeptierten Intervalle erfasst:

`ΔE_Speicher = Kapazität_kWh × (SOC_neu − SOC_alt) / 100`

Die Anzeige ergibt sich aus den Summen des Fensters:

`Wirkungsgrad_% = 100 × (Entladeenergie + ΔE_Speicher) / Ladeenergie`

`Verluste_kWh = Ladeenergie − Entladeenergie − ΔE_Speicher`

Die Zeitbasis der Leistung ist der **Snapshot-Abschluss**, nicht der im aktuellen Flow-Kontext nicht separat verfügbare Batterie-Empfangszeitpunkt. SOC ist der zuletzt bei der Verarbeitung verfügbare Wert. Diagnose: `power_time_basis` und `soc_time_basis`. Quellenlatenz, SOC-Rasterung, Nennkapazität, BMS-Korrekturen und diese Asynchronität begrenzen die Genauigkeit. Die Formel ist eine SOC-korrigierte Energiebilanz, keine zertifizierte Roundtrip-Messung eines vollständigen Lade-/Entladezyklus.

### Gleitendes Fenster und Speichergröße

Das Fenster endet am letzten verarbeiteten Snapshot und beginnt exakt 168 Stunden davor; es hängt nicht von Mitternacht oder Sommerzeitwechseln ab. Neue Intervalle werden bei Minutengrenzen aufgeteilt, innerhalb einer Minute anschließend ohne Rundung summiert. Maximal etwa 10.081 Minutenaggregate werden gespeichert. Damit bleiben Puffer und Dateischreibvolumen begrenzt.

**Die älteste angeschnittene Minute wird gleichmäßig zeitanteilig gewichtet.** Deren Energie- und SOC-Verlauf ist nach der Aggregation nicht mehr sekundengenau bekannt. Das ist eine bewusste, in `boundary_weighting` ausgewiesene Näherung mit höchstens einer betroffenen Minute. Ladeenergie, Entladeenergie, SOC-Änderung und Abdeckung erhalten denselben Gewichtungsfaktor. Es wird kein ganzer Tag mehr um Mitternacht entfernt. Kleine Änderungen durch SOC-Schritte, Lastwechsel und den Fensterrand bleiben möglich; der bisherige Prozentwert an Ausgang 2 wird nicht geglättet. Ausgang 1 liefert den separat beschriebenen Mittelwert.

### Grenzen und Lücken

- 2.400 W plus 20 % Reserve ergeben eine Eingabe-Plausibilitätsgrenze von 2.880 W je Richtung. Der Messwert wird nicht auf die Grenze gekürzt.
- Snapshots älter als 6,5 s, ungültige Werte und ESP-Ersatzwerte werden abgelehnt. Der ESP-Fallback kann wiederholte Telemetrie oder eine abweichende Messgrenze enthalten; er wird deshalb nicht als frische Modbus-Messung integriert.
- Maximal zehn Sekunden zwischen gültigen Punkten sind erlaubt. Kürzere Abstände werden linear überbrückt; längere Lücken und ausdrücklich ungültige Zwischenmeldungen starten einen neuen Ausgangspunkt. Dabei werden Energie und SOC-Änderung gemeinsam ausgeschlossen.
- Ein SOC-Schritt über zwei Prozentpunkte plus physikalischem Zuwachs mit 20 % Reserve wird zunächst ausgeschlossen. Drei aufeinanderfolgende ähnliche Werte bestätigen den neuen SOC-Ausgangspunkt. Langsame BMS-Korrekturen unter dieser Grenze sind damit nicht vollständig erkennbar.
- Ein negativer bisheriger Wirkungsgrad oder ein Wert über 100 % wird an Ausgang 2 als `null` ausgegeben, nicht auf 0/100 begrenzt; die Verfügbarkeit der Mittelwerthistorie wird getrennt geprüft. Nur rechnerische Überschreitungen innerhalb von **1e-9 Prozentpunkten** einer exakten 0/100-Grenze werden auf diese Grenze zurückgeführt, damit Gleitkomma-Subtraktion keine falsche Ablehnung erzeugt. Diagnose: `efficiency_arithmetic_tolerance_pct`. Die angezeigte Kapazität von 8,640 kWh ist eine Installationsvorgabe, kein universeller SolarFlow-Wert.

## Gleitender 7-Tage-Prozentmittelwert

Ausgang 2 behält die bisherige Formel und Prüfung. Ausgang 1 mittelt deren **ungerundete gültige Prozentwerte** über ein eigenes gleitendes 168-Stunden-Fenster. Gewichtet wird nach Zeit, nicht nach Nachrichtenanzahl oder Ladeenergie. Ein länger anliegender gültiger Wert trägt entsprechend mehr Zeit bei.

Für ein aufeinanderfolgendes akzeptiertes Intervall mit gültigen Prozentwerten an beiden Endpunkten:

`Prozent_Zeit_ms = (Wirkungsgrad_alt + Wirkungsgrad_neu) / 2 × dt_ms`

`Mittelwert_% = Summe(Prozent_Zeit_ms im Fenster) / Summe(gültig abgedeckte_ms im Fenster)`

Vor der Aggregation wird der lineare Verlauf an Minutengrenzen aufgeteilt. In der ältesten angeschnittenen Minute werden Integral und gültige Zeit mit demselben Überlappungsanteil gewichtet. Wie beim Energiepuffer bleibt der Verlauf innerhalb dieser einen Randminute eine Näherung. Gespeicherte Prozentwerte und Integrale werden nicht gerundet; nur die ausgegebene Nutzlast wird auf eine Nachkommastelle gerundet.

Beispiel: 80 → 84 % über 2 Sekunden ergibt 82 × 2; 84 → 76 % über 8 Sekunden ergibt 80 × 8. Zeitgewichtet entstehen **80,4 %**. Ein Mittelwert nach Messpunktanzahl ergäbe 80 % und würde sich mit der Abfragerate ändern.

### Verfügbarkeit, Lücken und Neustart

- Der erste gültige bisherige Prozentwert setzt den Mittelwert-Ausgangspunkt. Das nächste aufeinanderfolgende akzeptierte Intervall mit gültigen Endpunkten macht den Mittelwert verfügbar. Anfangs- oder historische Prozentwerte werden nicht erfunden.
- **Die Verfügbarkeit hängt von gültigen gespeicherten Mittelwertintervallen ab und ist unabhängig von der aktuellen SOC-/Quellgültigkeit.** Kurze SOC-Ausfälle, veraltete Leistung, Ersatzwerte, SOC-Sprungprüfung, unplausibler bisheriger Wirkungsgrad oder zu geringe Ladeenergie pausieren die Aufnahme, lassen Ausgang 1 bei verbleibender Historie aber verfügbar. Gleichzeitig darf Ausgang 2 null sein. Ausgang 1 meldet dann `valid: true`, `source_valid: false`, `reason: mean_available` und die tatsächliche `source_reason`.
- Ungültige oder ausgeschlossene Intervalle tragen keine Dauer bei. Der Interpolations-Ausgangspunkt wird gelöscht; der erste folgende gültige bisherige Prozentwert setzt einen neuen. Weder ein gehaltener Prozentwert noch 0 % werden während der Lücke eingerechnet. Die Wiederaufnahme überbrückt keine Lücke.
- Das Mittelwertfenster endet an der **aktuellen Auswertungszeit**, auch bei fehlerhaften Quellen. Weiterlaufende Timer-Aufrufe entfernen Altdaten und aktualisieren Abdeckung und Messwertalter. Durch herauslaufende Intervalle kann sich der Mittelwert ändern. Ohne gültige Intervalle in den letzten 168 Stunden wird Ausgang 1 null; beschädigter Zustand, Konfigurations- oder Laufzeit-/Kontextfehler erlauben ebenfalls keine Zusage einer sicher nutzbaren Historie.
- Der SOC-Watchdog setzt nur den bisherigen Ausgabeschlüssel zurück. Seine Warnung beschreibt die Quelle, nicht die Gültigkeit der Mittelwerthistorie. Kein Warnungskabel führt zum Mittelwertsensor. API-Fehler gehen an die Diagnose und setzen keine Berechnungshistorie zurück.
- Neustarts erhalten die Mittelwerthistorie auch während eines Quellausfalls. Ein kurzes akzeptiertes Intervall kann am gespeicherten Ausgangspunkt fortsetzen, eine Lücke über zehn Sekunden nicht. Doppelte gültige Snapshots ergänzen weder Daten noch Abdeckung.
- Vorhandene V5-Mittelwerthistorie wird weiterverwendet. Beim Umstieg von V3/V4 mit reiner Energiehistorie beginnt der Mittelwert mit neuen Beobachtungen; Energiesummen ergeben keine rekonstruierbaren früheren Prozentwerte.
- Während des Aufbaus ist ein Teilfenster möglich. Ein vollständiges Fenster benötigt 168 Stunden gültige Intervallabdeckung mit einer Millisekunde Rechentoleranz. Lücken bleiben bis zum Herauslaufen sichtbar; `mean_history_hours` allein belegt keine Abdeckung.
- Beide Historien speichern jeweils ungefähr 10.081 Minutenaggregate. Die älteste angeschnittene Minute behält die ausgewiesene gleichmäßige zeitanteilige Näherung.

### Ausgänge und Diagnose

Alle Ausgänge verwenden `msg.payload` für den veröffentlichten Prozentwert oder `null` und `msg.result` für die Diagnose. An Ausgang 1 beschreiben `result.valid` und `result.reason` den Mittelwert; `source_valid` und `source_reason` beschreiben die bisherige Bilanz. Ausgang 2 und 3 behalten deren `valid`/`reason` und enthalten zusätzlich die Mittelwertfelder. Die zurückgegebenen Diagnoseobjekte sind voneinander unabhängige Kopien.

| Ausgang | Nutzlast | Anschluss |
| --- | --- | --- |
| 1 | Gleitender 7-Tage-Mittelwert in Prozent | Neuer HA-Mittelwertsensor / Automatik |
| 2 | Bisherige SOC-korrigierte 168-Stunden-Bilanz in Prozent | Bisheriger HA-Wirkungsgradsensor |
| 3 | Gleiche Nutzlast wie Ausgang 2 mit gemeinsamer Diagnose | Debug / Diagnoseauswertung |

| Mittelwert-Diagnose | Bedeutung |
| --- | --- |
| `eta_mean_7d_pct` | Ausgegebener Mittelwert mit einer Nachkommastelle oder `null` |
| `eta_mean_7d_raw_pct` | Historischer Mittelwert für Diagnose auf drei Stellen gerundet, auch bei aktuell ungültiger Quelle |
| `mean_valid`, `mean_reason` | Aktuelle Verwendbarkeit und Begründung |
| `mean_window_start`, `mean_window_end` | Exakte UTC-Fenstergrenzen mit 168 Stunden Abstand |
| `mean_window_complete` | Vollständig abgedecktes Mittelwertfenster; getrennt vom bisherigen `window_complete` |
| `mean_covered_hours`, `mean_coverage_pct` | Aktuell vertretene gültige Mittelwertintervalle ohne Lücken |
| `mean_started_at`, `mean_history_hours` | Beginn und vergangene Zeit; kein Abdeckungsnachweis |
| `mean_collection_paused` | Aktuelle bisherige Quelle ungültig; Mittelwert darf gültig bleiben |
| `mean_last_sample_at`, `mean_sample_age_seconds` | Letztes gespeichertes Mittelwertintervall-Ende und dessen Alter |
| `mean_method`, `mean_source` | Linearer zeitgewichteter Mittelwert der bisherigen gleitenden Bilanz |
| `mean_buffer_buckets`, `mean_partial_boundary_bucket`, `mean_boundary_weighting` | Speichergröße und ausgewiesene Näherung der ältesten Randminute |

Eine Automatik, die auf eine vollständig abgedeckte Woche warten soll, kann in einer Function hinter **Ausgang 1** filtern:

```js
if (msg.result?.mean_valid !== true || msg.result?.mean_window_complete !== true) return null;
if (typeof msg.payload !== "number" || !Number.isFinite(msg.payload) || msg.payload <= 0) return null;
msg.batteryEfficiencyFactor = msg.payload / 100; // z. B. 80 % -> 0,80
return msg;
```

Damit steht ein Faktor für die nachfolgende Berechnung einer Entladeschwelle bereit; Geräteeinstellungen werden dadurch noch nicht verändert. Für die Verwendung eines Teilfensters eine ausdrückliche Mindestabdeckung wählen, statt vergangene Aufbauzeit als gemessene Abdeckung zu behandeln.

Der neue Mittelwert glättet SOC-Rasterung und kurzfristige lastabhängige Schwankungen. Systematische SOC-Fehler, ungenaue Kapazität und die physikalischen Grenzen der Energiebilanz bleiben. Weil bereits eine 168-Stunden-Bilanz gemittelt wird, werden dauerhafte Änderungen langsamer sichtbar. Es entsteht keine neue zyklusbezogene Roundtrip-Messung. Automatisierte Prüfung und ihre Grenzen stehen in [TESTING_DE.md](TESTING_DE.md).

## Übernahme des V3-Puffers

Bei der ersten gültigen Messung liest V4 optional `batt_eff_state_v3` aus `file`. Kapazität, bisherige Entitätsnamen und Node-RED-Zeitzone müssen zum V3-Fingerprint passen. `chargeEntityV3` / `dischargeEntityV3` dienen ausschließlich der Fingerprint-Prüfung bei Übernahme und lösen keine Tageszähler-Abfragen aus. Eine Abweichung führt zur Diagnose statt zu einer stillen Fehlübernahme. `CFG.importV3 = false` startet V4 bewusst ohne Import, verändert aber keinen V3-Puffer.

Alle vorhandenen Tagesenergien und SOC-Deltas werden übernommen. Bei bereits in V3 enthaltenen Legacy-Tagen wird auch dessen Korrektur zwischen den Legacy-SOC-Grenzen berücksichtigt. Diese Korrektur wird jeweils dem späteren Legacy-Tag zugeordnet. Fehlen erforderliche Grenzen, bleibt die bisherige Bilanz an Ausgang 2 ungültig, solange betroffene Daten im Fenster liegen.

V3 enthält keine untertägigen Zeitreihen. Daher verteilt die Übergangsrechnung jede übernommene Tagessumme gleichmäßig auf ihren lokalen Kalendertag; der letzte Tag endet am letzten gespeicherten V3-Messpunkt. Die bereits bekannte historische Ungenauigkeit wird dadurch nicht repariert. Alte Summen fallen nun zeitanteilig heraus. Dies kann von der alten Tagesfenster-Anzeige abweichen, besonders wenn der V3-Puffer beim Umstieg bereits veraltet war. Nach spätestens 168 Stunden ab dem letzten V3-Messpunkt ist die Übergangsnäherung ausgelaufen.

V4 beginnt seine Leistungsintegration erst mit einem neuen Ausgangspunkt. Die Zeit zwischen letztem V3-Punkt und erstem V4-Snapshot wird nicht mit rückwirkend angenommener Leistung aufgefüllt. Es gibt keine Überlappung oder Doppelzählung. `legacy_migration`, `imported_*` und `legacy_days_in_window` weisen die Übernahme aus. `covered_hours` enthält ausschließlich neu akzeptierte Leistungsintervalle; die Abdeckung der Altdaten ist unbekannt.

**Der alte V3-Puffer bleibt unverändert erhalten.** Bei Rückkehr zum alten Code ist er deshalb nur bis zum Umstiegszeitpunkt aktuell; V4 schreibt die V3-Tageswerte nicht weiter. Ein gespeicherter V4-Zustand hat immer Vorrang vor V3. Ein erneuter Import darf nicht durch unbedachtes Löschen von V4 erzwungen werden.

## Home Assistant Sensoren ohne Companion-Integration

Benötigt werden Node-RED, `node-red-contrib-home-assistant-websocket` (API-Schema gegen 0.80.3 geprüft) und eine funktionierende HA-Serververbindung. **Keine Custom Integration `hass-node-red` und kein Companion-Sensor erforderlich.** Tagesenergiesensoren werden weder abgefragt noch angelegt.

Die Sensor-Aufbereitung wählt bei `msg.result.output === "mean_7d"` den Mittelwert, sonst den bisherigen Sensor einschließlich optionaler Watchdog-Warnungen. Den Block `SENSOR` in beiden Aufbereitungsnodes konfigurieren. Die Vorgabe-IDs sind in deutscher und englischer Fassung identisch:

| Wert | Vorgabe-Entitäts-ID |
| --- | --- |
| Gleitender Mittelwert | `sensor.battery_efficiency_mean_7d` |
| Bisheriger Wirkungsgrad | `sensor.battery_efficiency` |

Die Vorbereitung bildet `msg.payload = {protocol: "http", method: "post", path: "/states/sensor.…", data: {state, attributes}}`. Der normale **API**-Knoten verwendet die Zugangsdaten seines ausgewählten Servers und ergänzt Home Assistants `/api`-Präfix. `payload.data` ist ein Objekt. Den numerischen Berechnungsausgang deshalb nicht direkt an den API-Knoten anschließen. Dessen Antwort liegt in `msg.ha_state`; dort endet der Sensorzweig. Fehler der angeschlossenen Aufbereitungs-/API-Knoten gehen über Catch an die Diagnose.

Gültige Zahlen werden als Zustandsstring geschrieben, auch ein echter Wert `"0"`; null/ungültige Werte ergeben **`"unknown"`**, niemals `"0"`. Attribute enthalten `%`, `state_class: measurement`, Gültigkeit und Begründung. Der Mittelwert ergänzt Quellgültigkeit, Quellgrund, pausierte Aufnahme, Abdeckung, Messwertalter und Fenstergrenzen. Gültige Mittelwerthistorie wird auch bei `source_valid: false` normal geschrieben.

Die REST-Aufrufe erzeugen/aktualisieren **Sensorzustände in der HA-Zustandsmaschine**, ohne Eintrag im Entitätsregister und ohne `unique_id`. Sie sind über ihre Entitäts-ID in Dashboards und Automationen nutzbar; einige Funktionen der Entitätsverwaltung stehen nicht zur Verfügung. Nach HA-Neustart erzeugt das nächste erfolgreiche API-Schreiben den Zustand erneut. Periodischen Auslöser weiterlaufen lassen und IDs ohne anderen aktiven Schreiber wählen. Die tatsächliche bisherige Sensor-ID kann ausdrücklich eingestellt werden; allein eine gleichbleibende Node-RED-Knoten-ID erhält keine HA-Entitäts-ID.

Ohne Altdaten müssen gültige Intervalle zunächst mindestens **0,1 kWh Ladeenergie** und eine plausible bisherige Bilanz liefern. Der Mittelwert benötigt danach ein aufeinanderfolgendes gültiges Prozentintervall. Sieben Tage Aufbauzeit werden nicht vorausgesetzt. Bei ausschließlich Entladung fehlt zunächst der Nenner. Teilfenster sind möglich; ihre Abdeckung bleibt ausgewiesen.

`window_complete` beschreibt die neu akzeptierte bisherige Leistungsabdeckung, `mean_window_complete` die Mittelwertintervall-Abdeckung. `excluded_*` zählt Ausschlüsse seit dem V4-Start statt nur im aktuellen Fenster.

Quellen: [HA REST API](https://developers.home-assistant.io/docs/api/rest/), [Standard-API-Knoten](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/API.html), [Node-RED-Dateikontext](https://nodered.org/docs/api/context/store/localfilesystem).

[MIT-Lizenz](../LICENSE) · [Markenhinweis](../NOTICE_DE.md) · [Messgrenzen und Gewährleistung](../DISCLAIMER_DE.md)

## Ausschlussdiagnose

Berechnung und SOC-Vorbereitung ersetzen und den vorhandenen periodischen Timer eine Sekunde nach dem SOC-Schreiber wie oben beschrieben verwenden. Kapazität und Kontext beibehalten. Der Snapshot-Builder liefert weiter seine Flow-Kontextwerte; beim vorhandenen Timer-Pfad ist kein zusätzlicher Auslöser von Ausgang 11 erforderlich. Die Abschluss- und Aktualitätsprüfungen bleiben aktiv.

`recent_exclusions` enthält bis zu zehn zusammenhängende Ausschlussereignisse, neuestes zuerst, einschließlich eines noch offenen Ereignisses. Die Liste wird in `batt_eff_state_v4` im Store `file` gespeichert und auf erfolgreichen sowie fehlerhaften Berechnungsausgaben mitgeliefert. Doppelte gültige Snapshots erzeugen weiterhin keine neue Nachricht. Ein noch nicht vorhandener Messausgangspunkt kann noch kein auszuschließendes Intervall besitzen; entsprechende Startfehler stehen im normalen `reason`.

| Feld | Bedeutung |
| --- | --- |
| `id`, `started_at`, `last_seen_at`, `ended_at` | Ereigniskennung und UTC-Zeiten; `end_ts`/`ended_at` ist der letzte tatsächlich verbuchte Ausschluss-Endpunkt |
| `open` | Fehler noch offen; endgültige Lückendauer steht gegebenenfalls erst bei Wiederaufnahme fest |
| `excluded_intervals`, `excluded_ms` | Bereits verbuchte Ausschlüsse dieses Ereignisses; keine hochgerechnete Ausfallzeit |
| `causes` | Technische Ursachen mit Anzahl der Beobachtungen und ersten/letzten Werten samt Prüfgrenzen |
| `ursachen` | Deutsche Erklärung je Ursache in der deutschen Fassung |
| `resolution`, `abschluss` | Abschlussstatus, etwa bestätigter SOC-Sprung oder Wiederaufnahme gültiger Messungen |

Wiederholte Fehler bis zur Wiederaufnahme bilden ein Ereignis. Ändert sich innerhalb der Lücke die Ursache, bleiben alle auftretenden Ursachen mit ihren ersten und letzten Messwerten erhalten. Die Ursache `battery_fallback_excluded` wird bei Wiederaufnahme nicht durch den allgemeinen Status `measurement_gap_excluded` ersetzt. Drei Bestätigungen eines SOC-Sprungs bleiben ein Ereignis mit drei ausgeschlossenen Intervallen. Ereigniszähler und Intervallzähler sind daher verschieden.

`exclusion_counts_by_reason` zählt Ereignisse **je Ursache seit Aufzeichnungsbeginn**; dieselbe Ursache erhöht den Zähler innerhalb eines Ereignisses nur einmal. Ein Ereignis mit mehreren Ursachen zählt einmal bei jeder dieser Ursachen. Diese Summen bleiben auch erhalten, wenn ältere Einträge aus der Zehnerliste fallen. Beobachtungszahlen innerhalb eines Ereignisses zählen dagegen die tatsächlichen Fehleraufrufe, auch wiederholte Abfragen desselben fehlerhaften Snapshots.

Die Ausschlussaufzeichnung ergänzt Diagnosefelder im bestehenden V4-Zustand; dieses Release ergänzt außerdem die getrennte Mittelwerthistorie. Energiehistorie, Übernahmemarker und bisherige Ausschlusszähler bleiben erhalten. `exclusion_log_since` benennt den Aufzeichnungsbeginn, `exclusions_before_logging` den vorherigen Bestand ohne rekonstruierbare Ursachen. Die Ursachen früherer Ausschlüsse werden nicht erfunden. Die Speicherung unterliegt demselben Dateispeicher-Schreibintervall wie der Energiepuffer. Fehlende oder defekte Kontextspeicher können naturgemäß auch die dauerhafte Fehleraufzeichnung verhindern.
