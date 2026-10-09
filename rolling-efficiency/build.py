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
nodes=json.loads((R/'flow-template.json').read_text())
for n in nodes:
 if n['id']=='v4e46be25028e13f5d': n['func']=source
 if n['id']=='v4effprepare000003': n['func']=prepare
idmap={key:'v4'+key for key in ['e46be25028e13f5d','effprepare000003']}
(R/'flow.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
def write_mean_import(language):
 # Add only the new sensor/configuration; reuse the operator's HA server.
 mean=[dict(n) for n in nodes if n['id'] in ['0f55fb7a4d14af9f','71e17f5b60730d3d']]
 next(n for n in mean if n['type']=='ha-sensor').update(x=1520,y=5180)
 (R/f'sensor-mean{language}.json').write_text(json.dumps(mean,indent=2,ensure_ascii=False)+'\n')
write_mean_import('')
for n in nodes:
 if n['id']==idmap['e46be25028e13f5d']:n.update(name='Batterie Wirkungsgrad und 7-Tage-Mittelwert',func=(R/'battery-efficiency_DE.js').read_text(),outputLabels=['Gleitender 7-Tage-Mittelwert','Bisheriger Wirkungsgrad / HA-Sensor','Diagnose'])
 if n['id']==idmap['effprepare000003']:n.update(name='SOC erfassen und Messzyklus starten',func=(R/'prepare-cycle_DE.js').read_text(),outputLabels=['Snapshot auswerten','Fehlende Messung / Diagnose'])
 if n['type']=='ha-sensor':n['name']='Lade Entlade Effizenz 7-Tage-Mittelwert' if n['id']=='0f55fb7a4d14af9f' else 'Lade Entlade Effizenz'
 if n['type']=='ha-entity-config':
  name='Lade Entlade Effizenz 7-Tage-Mittelwert' if n['id']=='71e17f5b60730d3d' else 'Lade Entlade Effizenz'
  n['name']='S '+name
  next(item for item in n['haConfig'] if item['property']=='name')['value']=name
 if n['type']=='server':n['statusSeparator']='am:'
 if n['type']=='debug':n['name']='Wirkungsgrad Diagnose'
 if n['type']=='inject':n['name']='Snapshot manuell prüfen'
 if n['type']=='catch':n['name']='Fehler der Sensor-Anbindung'
 if n['type']=='comment':n.update(name='Vorhandenen Timer nach SOC-Erfassung anschließen; Anleitung lesen',info='Gleicher Flow-Tab wie Snapshot und SOC-Schreiber. Vorhandener Takt: SOC samt originalem Zeitstempel schreiben, 1 s später SOC erfassen und Berechnung starten. Snapshot muss dann vollständig vorliegen. Kein zusätzlicher periodischer Timer. Keine Tageszählerabfragen. Berechnung: Ausgang 1 direkt an Mittelwertsensor und Automatik, 2 direkt an bisherigen Sensor, 3 Diagnose. Watchdog-Ausgang 2 nur an Diagnose, optional an bisherigen Sensor. Beide ha-sensor-Nodes: State = msg.payload, Einheit %, keine Attribute und kein Aufbereitungsnode. Benötigt hass-node-red Companion-Integration 1.1.0+ in HA. Vorhandenen Server in jeder Entity config auswählen; bisherige Entity config für deren HA-Entität beibehalten. Kapazität und Kontextspeicher prüfen; alte Berechnung abschalten. Siehe rolling-efficiency/README_DE.md.')
(R/'flow_DE.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
write_mean_import('_DE')
