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
 'v3_configuration_mismatch':'V3-Kapazität, Entitäten oder Zeitzone stimmen nicht überein'
})
de.HEADER='''/*
 * Batterie Wirkungsgrad – gleitende 168 Stunden, Version 4.1.
 * Deutsche Oberfläche, identischer englischer Rechenkern. MIT-Lizenz.
 * Kapazität und Leistung oben im CFG des Rechenkerns prüfen.
 * Snapshot-Werte aus dem Standard-Flow-Speicher, SOC aus memoryOnly.
 * Neuer Puffer: batt_eff_state_v4 im Dateispeicher file mit Cache.
 * Vorhandener V3-Puffer wird einmal übernommen und nicht verändert.
 * Alte Tageswerte: gleichmäßige zeitliche Gewichtung als Übergangsnäherung.
 * Minutenpuffer: älteste angeschnittene Minute anteilig gewichten.
 * Zwei Ausgänge: HA-Wirkungsgrad / Diagnose. Anleitung: README_DE.md.
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
(R/'prepare-cycle_DE.js').write_text(de.localize(prepare))
nodes=json.loads((R/'flow-template.json').read_text())
for n in nodes:
 if n['id']=='v4e46be25028e13f5d': n['func']=source
 if n['id']=='v4effprepare000003': n['func']=prepare
idmap={key:'v4'+key for key in ['e46be25028e13f5d','effprepare000003']}
(R/'flow.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
for n in nodes:
 if n['id']==idmap['e46be25028e13f5d']:n.update(name='Batterie Wirkungsgrad',func=(R/'battery-efficiency_DE.js').read_text(),outputLabels=['Wirkungsgrad / HA-Sensor','Diagnose'])
 if n['id']==idmap['effprepare000003']:n.update(name='SOC erfassen und Messzyklus starten',func=(R/'prepare-cycle_DE.js').read_text(),outputLabels=['Snapshot auswerten','Fehlende Messung / Diagnose'])
 if n['type']=='ha-sensor':n['name']='Lade Entlade Effizenz'
 if n['type']=='debug':n['name']='Wirkungsgrad Diagnose'
 if n['type']=='inject':n['name']='Snapshot-Überwachung alle 2 Sekunden'
 if n['type']=='ha-entity-config':
  n['name']='S Lade Entlade Effizenz'
  for row in n['haConfig']:
   if row['property']=='name':row['value']='Lade Entlade Effizenz'
 if n['type']=='comment':n.update(name='Snapshot-Diagnose an SOC-Erfassung anschließen; Anleitung lesen',info='Gleicher Flow-Tab wie Snapshot und SOC-Schreiber. Ausgang 11 des Snapshot-Nodes V1.3 an SOC-Erfassung anschließen. Kapazität und Kontextspeicher prüfen. Alte Berechnung abschalten. Keine Eingabe-Energiesensoren erforderlich. Siehe rolling-efficiency/README_DE.md.')
(R/'flow_DE.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
