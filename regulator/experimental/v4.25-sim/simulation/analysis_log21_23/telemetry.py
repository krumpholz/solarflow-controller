from common import *
from calibrate import response,rows,error,base
from scipy.optimize import least_squares
m=base['daylightExtension']['preferredDaytimeChargingBattery'];rs=rows[23];actual=np.array([r['inputs']['p_batterie'] if executed(r) else np.nan for r in rs]);pred,valid=response(23,m)
train=valid&np.array([r['ts']<rs[0]['ts']+600000 for r in rs]);test=valid&~train
fit=least_squares(lambda d:(actual-response(23,{**m,'bias':m['bias']+d[0]})[0])[train],[0],bounds=([-40],[40]),loss='soft_l1',f_scale=3)
local={**m,'bias':m['bias']+float(fit.x[0])};new,_=response(23,local)
x={'scope':'Local Log23 charging TELEMETRY offset hypothesis, SOC92..96 observed. Not a physical AC gain/offset change and not a SOC law. First10min used for fit, remainder held out.','extraTelemetryOffsetW':float(fit.x[0]),'model':local,'trainOld':error((actual-pred)[train]),'trainLocal':error((actual-new)[train]),'holdoutOld':error((actual-pred)[test]),'holdoutLocal':error((actual-new)[test]),'otherLogs':{}}
for n in [21,22]:
 p,v=response(n,m);q,_=response(n,local);a=np.array([r['inputs']['p_batterie'] if executed(r) else np.nan for r in rows[n]]);x['otherLogs'][str(n)]={'old':error((a-p)[v]),'local':error((a-q)[v])}
(OUT/'Log23_Telemetrieoffset.json').write_text(json.dumps(x,indent=2)+'\n');print(json.dumps(x,indent=2))
