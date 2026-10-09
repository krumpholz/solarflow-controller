from pathlib import Path
import json
import localize as de
R=Path(__file__).resolve().parent
de.TEXT.update({
 'valid_measurement_resumed':'Gültige Messung wieder aufgenommen',
 'invalid_configuration':'Ungültige Konfiguration',
 'invalid_v4_state_or_configuration':'V4-Puffer oder Konfiguration ungültig – bitte prüfen',
 'expired_soc_capture':'SOC-Aufnahme abgelaufen',
 'missing_or_stale_snapshot':'Snapshot fehlt oder ist veraltet',
 'battery_fallback_excluded':'ESP-Ersatzwert ausgeschlossen',
 'invalid_battery_power':'Batterieleistung ungültig oder zu hoch',
 'soc_jump_pending':'SOC-Sprung wird geprüft',
 'confirmed_soc_jump_excluded':'Bestätigter SOC-Sprung ausgeschlossen',
 'migration_baseline_initialized':'Puffer übernommen, neuer Messausgangspunkt gesetzt',
 'calculation_available':'Wirkungsgrad berechnet',
 'no_v3_data':'Kein V3-Puffer vorhanden – Neustart',
 'disabled':'Übernahme deaktiviert',
 'invalid_v3_state':'V3-Puffer ungültig',
 'invalid_v3_cutover':'V3-Messzeitpunkt ungültig oder neuer als Snapshot',
 'v3_configuration_mismatch':'V3-Kapazität, Entitäten oder Zeitzone stimmen nicht überein',
 'mean_baseline_initialized':'Mittelwert-Ausgangspunkt gesetzt – nächstes gültiges Intervall abwarten',
 'mean_available':'Gleitender 7-Tage-Mittelwert berechnet',
 'mean_history_expired':'Keine gültigen Mittelwertintervalle mehr im 7-Tage-Fenster',
 'mean_history_unavailable':'Mittelwerthistorie nicht sicher verfügbar',
 'invalid_mean_history':'Mittelwerthistorie ungültig',
 'Invalid sensor entity ID':'Ungültige Sensor-Entitäts-ID'
})
de.HEADER='''/*
 * Batterie Wirkungsgrad – gleitende 168 Stunden, Revision 5.1.
 * Deutsche Oberfläche, identischer englischer Rechenkern. MIT-Lizenz.
 * Kapazität und Leistung oben im CFG des Rechenkerns prüfen.
 * Snapshot-Werte aus dem Standard-Flow-Speicher, SOC aus memoryOnly.
 * Neuer Puffer: batt_eff_state_v4 im Dateispeicher file mit Cache.
 * Vorhandener V3-Puffer wird einmal übernommen und nicht verändert.
 * Alte Tageswerte: gleichmäßige zeitliche Gewichtung als Übergangsnäherung.
 * Minutenpuffer: älteste angeschnittene Minute anteilig gewichten.
 * Drei Ausgänge: 7-Tage-Mittelwert / bisheriger Wirkungsgrad / Diagnose.
 * Mittelwerthistorie bleibt bei kurzen SOC-Ausfällen verfügbar.
 * Ein vorhandener V5-Mittelwertpuffer wird weiterverwendet.
 * Anleitung: README_DE.md.
 */
'''
source=(R/'battery-efficiency.js').read_text()
localized=de.localize(source).replace('return ausgabe;', """
if (Array.isArray(ausgabe)) {
    for (const nachricht of ausgabe) {
        for (const ereignis of nachricht?.result?.recent_exclusions || []) {
            ereignis.ursachen = Object.keys(ereignis.causes).map(code => ({code, grund:deutsch(code)}));
            if (ereignis.resolution) ereignis.abschluss = deutsch(ereignis.resolution);
        }
    }
}
return ausgabe;
""")
(R/'battery-efficiency_DE.js').write_text(localized)
# Canonical sources and a code-free flow template; no V3 build dependency.
prepare=(R/'prepare-cycle.js').read_text()
de.TEXT['Reading battery power snapshot']='Batterieleistung aus Snapshot wird gelesen'
de.HEADER='''/*
 * SOC erfassen und Snapshot auswerten – Vorbereitung für v5.1.0.
 * Zwei Ausgänge: Berechnung auslösen / fehlende Messung und Diagnose.
 * Ursprünglichen SOC-Zeitstempel beibehalten; keine Tageszählerabfragen.
 * Watchdog setzt nur bisherigen Wirkungsgrad zurück, niemals den Mittelwert.
 * Gleicher Flow-Tab wie Snapshot und SOC-Schreiber. MIT-Lizenz.
 */
'''
(R/'prepare-cycle_DE.js').write_text(de.localize(prepare))
sensor=(R/'prepare-sensor.js').read_text()
de.HEADER='''/*
 * Normalen HA-Sensor über den Standard-API-Knoten schreiben.
 * Keine Node-RED-Companion-Integration erforderlich. MIT-Lizenz.
 * Entitäts-IDs oben konfigurieren; Automatik vor der Aufbereitung abzweigen.
 */
'''
(R/'prepare-sensor_DE.js').write_text(de.localize(sensor
 .replace('"Battery Efficiency 7-Day Mean"','"Batterie Wirkungsgrad 7-Tage-Mittelwert"')
 .replace('"Battery Efficiency"','"Lade Entlade Effizenz"')))
nodes=json.loads((R/'flow-template.json').read_text())
for n in nodes:
 if n['id']=='v4e46be25028e13f5d': n['func']=source
 if n['id']=='v4effprepare000003': n['func']=prepare
 if n['id'] in ['v51effmeanprep01','v51effrawprep001']: n['func']=sensor
idmap={key:'v4'+key for key in ['e46be25028e13f5d','effprepare000003']}
(R/'flow.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
for n in nodes:
 if n['id']==idmap['e46be25028e13f5d']:n.update(name='Batterie Wirkungsgrad und 7-Tage-Mittelwert',func=(R/'battery-efficiency_DE.js').read_text(),outputLabels=['Gleitender 7-Tage-Mittelwert','Bisheriger Wirkungsgrad / HA-Sensor','Diagnose'])
 if n['id']==idmap['effprepare000003']:n.update(name='SOC erfassen und Messzyklus starten',func=(R/'prepare-cycle_DE.js').read_text(),outputLabels=['Snapshot auswerten','Fehlende Messung / Diagnose'])
 if n['id'] in ['v51effmeanprep01','v51effrawprep001']:
  n['func']=(R/'prepare-sensor_DE.js').read_text()
  n['name']='Mittelwert für HA aufbereiten' if n['id']=='v51effmeanprep01' else 'Wirkungsgrad für HA aufbereiten'
 if n['type']=='ha-api':n['name']='API: Mittelwertsensor schreiben' if n['id']=='v5effmean00000001' else 'API: Wirkungsgradsensor schreiben'
 if n['type']=='debug':n['name']='Wirkungsgrad Diagnose'
 if n['type']=='inject':n['name']='Snapshot manuell prüfen'
 if n['type']=='catch':n['name']='Fehler der Sensor-Anbindung'
 if n['type']=='comment':n.update(name='Vorhandenen Timer nach SOC-Erfassung anschließen; Anleitung lesen',info='Gleicher Flow-Tab wie Snapshot und SOC-Schreiber. Vorhandener Takt: SOC samt originalem Zeitstempel schreiben, 1 s später SOC erfassen und Berechnung starten. Snapshot muss dann vollständig vorliegen. Kein zusätzlicher periodischer Timer. Keine Tageszählerabfragen. Berechnung: Ausgang 1 Mittelwert und Automatik, 2 bisheriger Wirkungsgrad, 3 Diagnose. Watchdog-Ausgang 2 nur an Diagnose, optional an bisherigen Sensor. Standard-HA-API statt Companion-Sensor. Entitäts-IDs in der Sensor-Aufbereitung konfigurieren. Kapazität und Kontextspeicher prüfen; alte Berechnung abschalten. Siehe rolling-efficiency/README_DE.md.')
(R/'flow_DE.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
