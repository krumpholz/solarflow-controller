from pathlib import Path
import json, importlib.util
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('de',R.parent/'round-trip-efficiency/build-german-flow.py')
de=importlib.util.module_from_spec(spec);spec.loader.exec_module(de)
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
# A copy of the existing capture node, with v4 wording and heartbeat key.
prepare=(R.parent/'round-trip-efficiency/prepare-cycle.js').read_text().replace('measurement requests / watchdog status','snapshot trigger / watchdog status').replace('both energy requests carry this same snapshot','the calculation uses this SOC snapshot').replace('batt_eff_last_completed_v3','batt_eff_last_completed_v4').replace('Requesting paired daily counters','Reading battery power snapshot')
de.TEXT['Reading battery power snapshot']='Batterieleistung aus Snapshot wird gelesen'
(R/'prepare-cycle.js').write_text(prepare)
(R/'prepare-cycle_DE.js').write_text(de.localize(prepare))
old=json.loads((R.parent/'round-trip-efficiency/flow.json').read_text())
nodes=[n for n in old if n['type'] not in ('api-current-state','inject')]
watchdog=next(n for n in old if n['type']=='inject')
watchdog.update(name='Snapshot watchdog every 2 seconds',repeat='2')
nodes.append(watchdog)
for n in nodes:
 if n['type']=='function' and n['id']=='e46be25028e13f5d':n.update(func=source,name='Rolling 168-Hour Battery Efficiency')
 if n['id']=='effprepare000003':n.update(func=prepare,wires=[['e46be25028e13f5d'],['0e16d9dcd078a8e9','effdiagnostics03']])
 if n['type']=='comment':n.update(name='Connect snapshot diagnostic output to SOC capture; read README',info='Same flow tab as snapshot and SOC writer. Connect output 11 of the V1.3 snapshot builder to SOC capture. Set capacity and stores. Disable the old efficiency writer. No input energy sensors required. See rolling-efficiency/README.md.')
 if n['type']=='ha-sensor':n['name']='Battery Efficiency'
 if n['type']=='ha-entity-config':
  n['name']='Battery Efficiency Sensor'
  for row in n['haConfig']:
   if row['property']=='name':row['value']='Battery Efficiency'
# Give new imports their own node ids; flow context remains on the user's tab.
idmap={n['id']:'v4'+n['id'] for n in nodes}
for n in nodes:
 n['id']=idmap[n['id']]
 for key in ('server','entityConfig'):
  if n.get(key) in idmap:n[key]=idmap[n[key]]
 if 'wires' in n:n['wires']=[[idmap.get(i,i) for i in w] for w in n['wires']]
(R/'flow.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
for n in nodes:
 if n['id']==idmap['e46be25028e13f5d']:n.update(name='Batterie Wirkungsgrad',func=(R/'battery-efficiency_DE.js').read_text())
 if n['id']==idmap['effprepare000003']:n.update(name='SOC erfassen und Messzyklus starten',func=(R/'prepare-cycle_DE.js').read_text())
 if n['type']=='ha-sensor':n['name']='Lade Entlade Effizenz'
 if n['type']=='debug':n['name']='Wirkungsgrad Diagnose'
 if n['type']=='inject':n['name']='Snapshot-Überwachung alle 2 Sekunden'
 if n['type']=='ha-entity-config':
  n['name']='S Lade Entlade Effizenz'
  for row in n['haConfig']:
   if row['property']=='name':row['value']='Lade Entlade Effizenz'
 if n['type']=='comment':n.update(name='Snapshot-Diagnose an SOC-Erfassung anschließen; Anleitung lesen',info='Gleicher Flow-Tab wie Snapshot und SOC-Schreiber. Ausgang 11 des Snapshot-Nodes V1.3 an SOC-Erfassung anschließen. Kapazität und Kontextspeicher prüfen. Alte Berechnung abschalten. Keine Eingabe-Energiesensoren erforderlich. Siehe rolling-efficiency/README_DE.md.')
(R/'flow_DE.json').write_text(json.dumps(nodes,indent=2,ensure_ascii=False)+'\n')
