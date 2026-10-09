# Batterie-Wirkungsgrad und gleitender 7-Tage-Mittelwert – Release v5.0.0

Release **v5.0.0** verwendet Berechnungsrevision **5.0**, Energie-Pufferschema **4** und ergänztes Mittelwert-Pufferschema **1**. Bestehende V4-Energiepuffer werden weiterverwendet. Die Ausgangsreihenfolge ändert sich; die Mittelwerthistorie beginnt beim Update.

[English](README.md) | **Deutsch**

Gleitende 168-Stunden-Energiebilanz aus dem vorzeichenbehafteten Leistungswert des Snapshot-Builders `1.3-SOLAR-G-ESP-BATT-FALLBACK`. Keine Tageszähler als Eingabe erforderlich. Drei Funktionsausgänge: **7-Tage-Mittelwert, bisheriger Wirkungsgrad, Diagnose**, in dieser Reihenfolge. Die bestehende Fassung mit Tageszählern bleibt unter [Release v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency) verfügbar.

## Bestehende Installation umstellen

1. Alten Flow exportieren und Node-RED-Kontext sichern. Im selben Flow-Tab bleiben; dort liegt der vorhandene Puffer.
2. Den **gesamten** Funktionscode von **Batterie Wirkungsgrad** durch [battery-efficiency_DE.js](battery-efficiency_DE.js) ersetzen. **Drei Ausgänge** einstellen. `capacityKWh: 8.640` und `maxPowerKW: 2.4` an die Anlage anpassen.
3. Ausgang 1 von **SOC erfassen und Messzyklus starten** direkt mit **Batterie Wirkungsgrad** verbinden. Die beiden bisherigen Tageszähler-Abfragen aus diesem Berechnungszweig entfernen. Keine zweite alte Berechnung parallel auf dieselben Ausgaben/Kontextwerte schreiben lassen.
4. Für jeden 2-Sekunden-Snapshot **Ausgang 11 (Diagnose, Index 10)** von **Messwerte berechnen V1.3** zusätzlich mit dem Eingang von **SOC erfassen und Messzyklus starten** verbinden. Den bisherigen 5-Sekunden-Timer als Auslöser dieses Zweigs abtrennen. Der Snapshot-Ausgang wird erst nach dem Schreiben aller benötigten Flow-Werte ausgegeben. Die bestehenden anderen Verbindungen des Snapshot-Nodes bleiben erhalten.
5. **Ausgang 1** der Berechnung mit dem neuen Mittelwertsensor oder einer Automatik verbinden. **Lade Entlade Effizenz** auf **Ausgang 2**, **Wirkungsgrad Diagnose** auf **Ausgang 3** umstecken. SOC-Erfassung durch [prepare-cycle_DE.js](prepare-cycle_DE.js) ersetzen. Deren Warnungsausgang (Ausgang 2) mit **beiden** HA-Sensoren und der Diagnose verbinden. Der alte Vorbereitungsknoten löst Berechnungen weiterhin aus, setzt bei seinem eigenen Watchdog-Timeout aber den neuen Mittelwertsensor noch nicht zurück.
6. Optional den bisherigen Timer als separaten 2-Sekunden-Watchdog an **SOC erfassen** anschließen. Doppelte Snapshot-Zyklen werden nicht erneut integriert. Bei ausbleibenden Snapshots liefert diese zusätzliche Abfrage `null`, statt einen alten Prozentwert unbegrenzt anzuzeigen. Der komplette Import enthält diesen Timer. Ohne einen weiterlaufenden Auslöser kann kein Function-Node den Ausfall seiner eigenen Eingaben anzeigen.

**Nur Funktionscode tauschen und die Zähler umgehen funktioniert zum Einstieg.** Solange jedoch nur alle fünf Sekunden abgefragt wird, integriert die Funktion nur diese ausgewählten Leistungswerte. Dazwischenliegende 2-Sekunden-Messpunkte lassen sich aus dem überschriebenen Flow-Kontext nicht nachträglich zurückholen. Die ereignisgesteuerte Verbindung in Schritt 4 erfasst jeden erfolgreichen Snapshot.

Neuinstallationen können alternativ [flow_DE.json](flow_DE.json) importieren. Nur eine Sprachversion aktivieren, denselben Flow-Tab wie Snapshot und SOC-Schreiber verwenden und den vorhandenen Home-Assistant-Server auswählen. Der Export enthält weder deinen Modbus-Snapshot-Builder noch dessen Geräte-/Netzwerkkonfiguration. Eine separate Reglerinstallation ist erforderlich, um die unten genannten Snapshot-Werte bereitzustellen.

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
| `batt_level_ts` | Optional: Unixzeit der SOC-Beobachtung in ms; wenn vorhanden höchstens 120 s alt |

Der vorhandene SOC-Vorbereitungsknoten übergibt diese Werte in `msg._eff`. Ohne dieses Objekt liest die Berechnung die beiden SOC-Variablen selbst. Der BLE-Sensor `sensor.bluetooth_solarflow_solarflow_batterie_soc` kann weiterhin über **SOC -> EMS** liefern. Ein bei jeder HA-Abfrage neu erzeugter SOC-Zeitstempel bestätigt nur den Abfragezeitpunkt, nicht die Aktualität der Messung im BLE-Gerät. `soc_freshness_verified` prüft ausschließlich das Alter des bereitgestellten Zeitstempels.

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

Die bisherigen Ausgabevariablen bleiben im Store `file`: `sum_batt_la_7d`, `sum_batt_ela_7d` in kWh und `la_ela_es` als bisheriger Prozentwert oder `null`. Neu ist `la_ela_es_mean_7d` als Mittelwert in Prozent oder `null`. Berechnungsfehler und Watchdog-Timeout setzen beide Prozentwerte zurück. Der alte Schlüssel wird nicht mit dem Mittelwert überschrieben.

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
- Ein negativer Wirkungsgrad oder ein Wert über 100 % wird als `null` ausgegeben, nicht auf 0/100 begrenzt. Nur rechnerische Überschreitungen innerhalb von **1e-9 Prozentpunkten** einer exakten 0/100-Grenze werden auf diese Grenze zurückgeführt, damit Gleitkomma-Subtraktion keine falsche Ablehnung erzeugt. Diagnose: `efficiency_arithmetic_tolerance_pct`. Die angezeigte Kapazität von 8,640 kWh ist eine Installationsvorgabe, kein universeller SolarFlow-Wert.

## Gleitender 7-Tage-Prozentmittelwert

Ausgang 2 behält die bisherige Formel und Prüfung. Ausgang 1 mittelt deren **ungerundete gültige Prozentwerte** über ein eigenes gleitendes 168-Stunden-Fenster. Gewichtet wird nach Zeit, nicht nach Nachrichtenanzahl oder Ladeenergie. Ein länger anliegender gültiger Wert trägt entsprechend mehr Zeit bei.

Für ein aufeinanderfolgendes akzeptiertes Intervall mit gültigen Prozentwerten an beiden Endpunkten:

`Prozent_Zeit_ms = (Wirkungsgrad_alt + Wirkungsgrad_neu) / 2 × dt_ms`

`Mittelwert_% = Summe(Prozent_Zeit_ms im Fenster) / Summe(gültig abgedeckte_ms im Fenster)`

Vor der Aggregation wird der lineare Verlauf an Minutengrenzen aufgeteilt. In der ältesten angeschnittenen Minute werden Integral und gültige Zeit mit demselben Überlappungsanteil gewichtet. Wie beim Energiepuffer bleibt der Verlauf innerhalb dieser einen Randminute eine Näherung. Gespeicherte Prozentwerte und Integrale werden nicht gerundet; nur die ausgegebene Nutzlast wird auf eine Nachkommastelle gerundet.

Beispiel: 80 → 84 % über 2 Sekunden ergibt 82 × 2; 84 → 76 % über 8 Sekunden ergibt 80 × 8. Zeitgewichtet entstehen **80,4 %**. Ein Mittelwert nach Messpunktanzahl ergäbe 80 % und würde sich mit der Abfragerate ändern.

### Verfügbarkeit, Lücken und Neustart

- Der erste gültige Prozentwert setzt den Mittelwert-Ausgangspunkt. Der nächste aufeinanderfolgende gültige Wert trägt sein Intervall bei und macht den Mittelwert verfügbar. Vorhandene Mittelwerthistorie kann nach Wiederaufnahme gültiger Messungen weiterverwendet werden.
- Ungültige Messungen, SOC-Sprungprüfung, unplausibler Wirkungsgrad, zu geringe Ladeenergie und ausgeschlossene Messintervalle tragen keine Mittelwertdauer bei. Der vorherige Mittelwert-Ausgangspunkt wird gelöscht. Der nächste gültige Prozentwert setzt einen neuen Ausgangspunkt; die Lücke wird nicht überbrückt.
- Bei aktuell ungültiger Berechnung liefern Ausgang 1 und 2 beide `payload: null`, auch wenn ein früher gültiger Mittelwert noch in der Historie liegt. Ausgang 3 beschreibt die Ursache. Fehler werden nicht als Null-Prozent-Messpunkte eingerechnet.
- Nach Neustart bleibt die gespeicherte Mittelwerthistorie erhalten. Ein kurzes akzeptiertes Intervall kann am gespeicherten Ausgangspunkt fortsetzen; eine Lücke über zehn Sekunden nicht. Doppelte Snapshots ergänzen weder Daten noch Abdeckung.
- Die vorhandene V4-Energiehistorie bleibt erhalten. Die neue Mittelwerthistorie beginnt beim Update. Weder V4-Minutenenergiesummen noch übernommene V3-Tageswerte enthalten den früheren Prozentwertverlauf; ein historischer Mittelwert wird nicht erfunden.
- Der Mittelwert kann schon während des Aufbaus angezeigt werden und umfasst dann weniger als sieben Tage. Ein vollständiges Fenster braucht 168 Stunden gültig abgedeckter Mittelwertintervalle mit einer Millisekunde Rechentoleranz. Lücken bleiben bis zum Herauslaufen sichtbar. `mean_history_hours` allein belegt keine Abdeckung.
- Beide Historien halten jeweils ungefähr 10.081 Minutenaggregate. Abdeckung und Speicher bleiben begrenzt. Der periodische Snapshot-Watchdog setzt bei ausbleibenden Messungen beide Ausgabesensoren zurück; die Berechnung braucht weiterhin einen Auslöser, um den Ausfall festzustellen.

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
| `mean_started_at`, `mean_history_hours` | Beginn der neuen Historie und seitdem vergangene Zeit |
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

Bei der ersten gültigen Messung liest V4 optional `batt_eff_state_v3` aus `file`. Kapazität, bisherige Entitätsnamen und Node-RED-Zeitzone müssen zum V3-Fingerprint passen. Eine Abweichung führt zur Diagnose statt zu einer stillen Fehlübernahme. `CFG.importV3 = false` startet V4 bewusst ohne Import, verändert aber keinen V3-Puffer.

Alle vorhandenen Tagesenergien und SOC-Deltas werden übernommen. Bei bereits in V3 enthaltenen Legacy-Tagen wird auch dessen Korrektur zwischen den Legacy-SOC-Grenzen berücksichtigt. Diese Korrektur wird jeweils dem späteren Legacy-Tag zugeordnet. Fehlen erforderliche Grenzen, bleibt die Ausgabe ungültig, solange betroffene Daten im Fenster liegen.

V3 enthält keine untertägigen Zeitreihen. Daher verteilt die Übergangsrechnung jede übernommene Tagessumme gleichmäßig auf ihren lokalen Kalendertag; der letzte Tag endet am letzten gespeicherten V3-Messpunkt. Die bereits bekannte historische Ungenauigkeit wird dadurch nicht repariert. Alte Summen fallen nun zeitanteilig heraus. Dies kann von der alten Tagesfenster-Anzeige abweichen, besonders wenn der V3-Puffer beim Umstieg bereits veraltet war. Nach spätestens 168 Stunden ab dem letzten V3-Messpunkt ist die Übergangsnäherung ausgelaufen.

V4 beginnt seine Leistungsintegration erst mit einem neuen Ausgangspunkt. Die Zeit zwischen letztem V3-Punkt und erstem V4-Snapshot wird nicht mit rückwirkend angenommener Leistung aufgefüllt. Es gibt keine Überlappung oder Doppelzählung. `legacy_migration`, `imported_*` und `legacy_days_in_window` weisen die Übernahme aus. `covered_hours` enthält ausschließlich neu akzeptierte Leistungsintervalle; die Abdeckung der Altdaten ist unbekannt.

**Der alte V3-Puffer bleibt unverändert erhalten.** Bei Rückkehr zum alten Code ist er deshalb nur bis zum Umstiegszeitpunkt aktuell; V4 schreibt die V3-Tageswerte nicht weiter. Ein gespeicherter V4-Zustand hat immer Vorrang vor V3. Ein erneuter Import darf nicht durch unbedachtes Löschen von V4 erzwungen werden.

## Neue Nutzer und Home Assistant

Ohne V3-Daten setzt die erste Messung den Ausgangspunkt. Sobald akzeptierte Intervalle mindestens **0,1 kWh Ladeenergie** enthalten und die Bilanz plausibel ist, wird ein Wert ausgegeben. Ein vollständiger Siebentagepuffer ist nicht erforderlich. Bei ausschließlich Entladung fehlt zunächst ein sinnvoller Nenner. Die Schwelle verhindert nur eine Division durch nahezu null und garantiert noch keine hohe Genauigkeit bei kurzer Beobachtung.

Die bisherigen Eingabesensoren `sensor.batterie_lade_energie_pro_tag` und `sensor.batterie_entlade_energie_pro_tag` werden nicht mehr abgefragt oder angelegt. Für den HA-Ergebnissensor werden weiterhin `node-red-contrib-home-assistant-websocket`, die **Node-RED Companion Integration** in Home Assistant und eine funktionierende Serververbindung benötigt. Der importierte `ha-sensor` samt Entitätskonfiguration erstellt den Ergebnissensor bei korrekt eingerichteter Integration; die endgültige Entity-ID kann bei bereits bestehenden Namen abweichen. Beim reinen Austausch des Funktionscodes bleibt der vorhandene Ausgabesensor bestehen.

`window_complete` bezeichnet ein vollständig durch neue akzeptierte Intervalle abgedecktes 168-Stunden-Fenster. Eine gültige Ausgabe kann lange vorher erfolgen. `excluded_*` zählt Ausschlüsse seit dem V4-Start, nicht nur innerhalb des aktuellen Fensters. Die minutenweise Abdeckung am angeschnittenen Fensterrand unterliegt derselben beschriebenen Näherung.

[MIT-Lizenz](../LICENSE) · [Markenhinweis](../NOTICE_DE.md) · [Messgrenzen und Gewährleistung](../DISCLAIMER_DE.md)

Quellen: [Node-RED-Dateikontext](https://nodered.org/docs/api/context/store/localfilesystem), [HA-Sensor-Knoten](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html), [Node-RED-Begleitintegration](https://github.com/zachowj/hass-node-red).

## Ausschlussdiagnose

Zum Update den vollständigen Code von **Batterie Wirkungsgrad** tauschen und die drei Ausgänge wie oben beschrieben umverdrahten. Kapazität und vorhandenen Kontext beibehalten. Alternativ zum Snapshot-Diagnoseausgang kann wie beim Regler der bestehende 2-Sekunden-Takt nach dessen 1-Sekunden-Verzögerung den SOC-Vorbereitungsknoten auslösen. Diese feste Verzögerung garantiert keine abgeschlossenen Abfragen; die Snapshot-Prüfungen bleiben deshalb aktiv.

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
