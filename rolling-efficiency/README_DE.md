# Batterie-Wirkungsgrad aus Leistung – Version 4.1

[English](README.md) | **Deutsch**

Gleitende 168-Stunden-Energiebilanz aus dem vorzeichenbehafteten Leistungswert des Snapshot-Builders `1.3-SOLAR-G-ESP-BATT-FALLBACK`. Keine Tageszähler als Eingabe erforderlich. Zwei Funktionsausgänge: Wirkungsgrad und Diagnose. Die bestehende Fassung mit Tageszählern bleibt unter [round-trip-efficiency](../round-trip-efficiency/README_DE.md) verfügbar.

## Bestehende Installation umstellen

1. Alten Flow exportieren und Node-RED-Kontext sichern. Im selben Flow-Tab bleiben; dort liegt der vorhandene Puffer.
2. Den **gesamten** Funktionscode von **Batterie Wirkungsgrad** durch [battery-efficiency_DE.js](battery-efficiency_DE.js) ersetzen. Zwei Ausgänge beibehalten. `capacityKWh: 8.640` und `maxPowerKW: 2.4` an die Anlage anpassen.
3. Ausgang 1 von **SOC erfassen und Messzyklus starten** direkt mit **Batterie Wirkungsgrad** verbinden. Die beiden bisherigen Tageszähler-Abfragen aus diesem Berechnungszweig entfernen. Keine zweite alte Berechnung parallel auf dieselben Ausgaben/Kontextwerte schreiben lassen.
4. Für jeden 2-Sekunden-Snapshot **Ausgang 11 (Diagnose, Index 10)** von **Messwerte berechnen V1.3** zusätzlich mit dem Eingang von **SOC erfassen und Messzyklus starten** verbinden. Den bisherigen 5-Sekunden-Timer als Auslöser dieses Zweigs abtrennen. Der Snapshot-Ausgang wird erst nach dem Schreiben aller benötigten Flow-Werte ausgegeben. Die bestehenden anderen Verbindungen des Snapshot-Nodes bleiben erhalten.
5. Ausgang 1 der Wirkungsgradfunktion bleibt mit **Lade Entlade Effizenz**, Ausgang 2 mit **Wirkungsgrad Diagnose** verbunden. Der SOC-Vorbereitungsknoten kann unverändert bleiben: Die V4-Funktion bedient auch dessen bisherigen Watchdog-Schlüssel. Lediglich dessen Statusbeschreibung erwähnt dann noch Tageszähler; [prepare-cycle_DE.js](prepare-cycle_DE.js) enthält die passende Beschriftung für V4.
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

Der V4-Zustand liegt vollständig in `flow.batt_eff_state_v4` im Store `file`: Minutenpuffer, Leistungs-/SOC-Ausgangspunkt, Übernahmemarker und Ausschlusszähler. Die Dateiablage schreibt zeitverzögert; bei Stromausfall können noch nicht geschriebene Sekunden verloren gehen. Ein normaler Neustart lädt den gespeicherten Zustand, importiert V3 nicht nochmals und ignoriert wiederholte Snapshot-Zyklen. Eine Lücke über zehn Sekunden wird auf beiden Seiten der Energiebilanz ausgeschlossen. Nur eine aktive V4-Funktion darf diesen Zustand schreiben.

Die folgenden bisherigen Ausgabevariablen werden weiterhin im Store `file` aktualisiert: `sum_batt_la_7d`, `sum_batt_ela_7d` in kWh und `la_ela_es` in Prozent oder `null`.

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

**Die älteste angeschnittene Minute wird gleichmäßig zeitanteilig gewichtet.** Deren Energie- und SOC-Verlauf ist nach der Aggregation nicht mehr sekundengenau bekannt. Das ist eine bewusste, in `boundary_weighting` ausgewiesene Näherung mit höchstens einer betroffenen Minute. Ladeenergie, Entladeenergie, SOC-Änderung und Abdeckung erhalten denselben Gewichtungsfaktor. Es wird kein ganzer Tag mehr um Mitternacht entfernt. Kleine Änderungen durch SOC-Schritte, Lastwechsel und den Fensterrand bleiben möglich; die Anzeige ist keine künstlich geglättete Kurve.

### Grenzen und Lücken

- 2.400 W plus 20 % Reserve ergeben eine Eingabe-Plausibilitätsgrenze von 2.880 W je Richtung. Der Messwert wird nicht auf die Grenze gekürzt.
- Snapshots älter als 6,5 s, ungültige Werte und ESP-Ersatzwerte werden abgelehnt. Der ESP-Fallback kann wiederholte Telemetrie oder eine abweichende Messgrenze enthalten; er wird deshalb nicht als frische Modbus-Messung integriert.
- Maximal zehn Sekunden zwischen gültigen Punkten sind erlaubt. Kürzere Abstände werden linear überbrückt; längere Lücken und ausdrücklich ungültige Zwischenmeldungen starten einen neuen Ausgangspunkt. Dabei werden Energie und SOC-Änderung gemeinsam ausgeschlossen.
- Ein SOC-Schritt über zwei Prozentpunkte plus physikalischem Zuwachs mit 20 % Reserve wird zunächst ausgeschlossen. Drei aufeinanderfolgende ähnliche Werte bestätigen den neuen SOC-Ausgangspunkt. Langsame BMS-Korrekturen unter dieser Grenze sind damit nicht vollständig erkennbar.
- Ein negativer Wirkungsgrad oder ein Wert über 100 % wird als `null` ausgegeben, nicht auf 0/100 begrenzt. Die angezeigte Kapazität von 8,640 kWh ist eine Installationsvorgabe, kein universeller SolarFlow-Wert.

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

## Ausschlussdiagnose ab Version 4.1

Zum Update genügt der vollständige Austausch von **Batterie Wirkungsgrad**. Verdrahtung, Kapazität und vorhandenen Kontext beibehalten. Alternativ zum Snapshot-Diagnoseausgang kann wie beim Regler der bestehende 2-Sekunden-Takt nach dessen 1-Sekunden-Verzögerung den SOC-Vorbereitungsknoten auslösen. Diese feste Verzögerung garantiert keine abgeschlossenen Abfragen; die Snapshot-Prüfungen bleiben deshalb aktiv.

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

Das Update ergänzt ausschließlich Diagnosefelder im bestehenden V4-Zustand. Energiehistorie, Übernahmemarker und bisherige Ausschlusszähler bleiben erhalten. `exclusion_log_since` benennt den Aufzeichnungsbeginn, `exclusions_before_logging` den vorherigen Bestand ohne rekonstruierbare Ursachen. Die Ursachen früherer Ausschlüsse werden nicht erfunden. Die Speicherung unterliegt demselben Dateispeicher-Schreibintervall wie der Energiepuffer. Fehlende oder defekte Kontextspeicher können naturgemäß auch die dauerhafte Fehleraufzeichnung verhindern.
