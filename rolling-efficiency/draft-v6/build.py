import json,pathlib
p=pathlib.Path(__file__).resolve().parent
body=(p/'battery-efficiency-v6.js').read_text()
# Match user's uploaded calculation ID/wiring, no credentials or unrelated nodes.
n={'id':'b84a28463be042be','type':'function','z':'577158dd0ea2615a',
'name':'Batterie Wirkungsgrad V6.0.0-draft.1','func':body,'outputs':4,'timeout':0,'noerr':0,
'initialize':'','finalize':'','libs':[],'x':1110,'y':5240,
'wires':[['ea866d525e410a2f'],['619074ace164b99e'],['effv6solarrelease'],['effdiagnostics03']],
'outputLabels':['Planungswirkungsgrad Netz (initial 80 %)','Bisherige 7-Tage-Bilanz','Quellenbilanz / optionale Solarfreigabe','Diagnose']}
(p/'calculation-import.json').write_text(json.dumps([n],ensure_ascii=False,indent=2)+'\n')
g={'id':'effv6solarrelease','type':'function','z':n['z'],'name':'V6 Solarvorrat → b_entladen_solar',
'func':(p/'solar-release.js').read_text(),'outputs':1,'timeout':0,'noerr':0,'initialize':'','finalize':'','libs':[],
'x':1460,'y':5360,'wires':[[]]}
(p/'solar-release-import.json').write_text(json.dumps([g],ensure_ascii=False,indent=2)+'\n')
