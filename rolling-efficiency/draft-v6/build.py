import json,pathlib
p=pathlib.Path(__file__).resolve().parent
legacy=(p.parent/'battery-efficiency_DE.js').read_text()
engine=(p/'engine.js').read_text()
header='''/* V6.0.0-draft.1 – FOUR outputs: Netz-Plan / bisherige Bilanz / Diagnose / Quellen.
 * Replace the existing calculation only; do not run both writers.
 * Once-only seed 80% in la_ela_es_mean_7d. Original v4 history is retained.
 * Source 4 -> optional solar-release.js; no direct control write here.
 * Source provenance is estimated, SOC-confirmed; gaps invalidate provenance.
 */
const legacyFlow={get:(...args)=>flow.get(...args),set:(key,value,...rest)=>
 flow.set(key==='la_ela_es_mean_7d'?'batt_eff_legacy_mean_7d':key,value,...rest)};
const legacy=(function(msg,node,flow,context){
'''
body=header+legacy+'\n})(msg,node,legacyFlow,context);\nif(legacy===null)return null;\n'+engine
(p/'battery-efficiency-v6.js').write_text(body)
# Match user's uploaded calculation ID/wiring, no credentials or unrelated nodes.
n={'id':'b84a28463be042be','type':'function','z':'577158dd0ea2615a',
'name':'Batterie Wirkungsgrad V6.0.0-draft.1','func':body,'outputs':4,'timeout':0,'noerr':0,
'initialize':'','finalize':'','libs':[],'x':1110,'y':5240,
'wires':[['ea866d525e410a2f'],['619074ace164b99e'],['effdiagnostics03'],[]],
'outputLabels':['Planungswirkungsgrad Netz (initial 80 %)','Bisherige 7-Tage-Bilanz','Diagnose','Quellenbilanz / optionale Solarfreigabe']}
(p/'calculation-import.json').write_text(json.dumps([n],ensure_ascii=False,indent=2)+'\n')
g={'id':'effv6solarrelease','type':'function','z':n['z'],'name':'V6 Solarvorrat + bisherige Freigabe',
'func':(p/'solar-release.js').read_text(),'outputs':1,'timeout':0,'noerr':0,'initialize':'','finalize':'','libs':[],
'x':1460,'y':5360,'wires':[[]]}
(p/'solar-release-import.json').write_text(json.dumps([g],ensure_ascii=False,indent=2)+'\n')
