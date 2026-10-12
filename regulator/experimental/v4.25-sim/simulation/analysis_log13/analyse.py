from base import *
from startup_model import startup_response
from zoneinfo import ZoneInfo
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ix=np.arange(len(rs));a=5;rel=t-t[a];m=model['discharging']['battery'];cmd=[];prev=0;last=-1e20
for i in range(a,len(rs)):
 u=rs[i]['outputs']['dischargeW']
 if u!=prev:
  e=reqByCycle.get((rs[i]['snapshotCycle']['regulatorCycleId'],'outputLimit'))
  at=(e['ts']/1000 if e else t[i]+model['timing']['regulatorToRequestMedian_s'])+(m['delay_up'] if u>prev else m['delay_down'])
  at=max(at,last+1e-6);last=at;cmd.append((at,u*m['gain']+m['bias'] if u else 0));prev=u
nom=np.array(startup_response(tb[a:],cmd,tb[a],tb[a],m,advance))
# Representative gate, selected from the observed onset bracket, no tau/gain refit.
gate_s=8.;pred=np.array(startup_response(tb[a:],cmd,t[a]+gate_s,tb[a],m,advance))
trans=(rel[a:]<=20);later=rel[a:]>=30
measured={k:metrics(mask) for k,mask in {'fullStandby':ix<5,'startup':(ix>=5)&(ix<10),'dischargeAll':ix>=5,'settled':ix>=10,'after30s':rel>=30}.items()}
invalid=np.flatnonzero(~np.array(snapValid)).tolist()
result={'sourceSHA256':hashlib.sha256((ROOT/'upload/regler_event_log_13.jsonl').read_bytes()).hexdigest(),'audit':audit,'snapshotAttachmentInvalidRows':invalid,'startLocal':datetime.datetime.fromtimestamp(t[0],ZoneInfo('Europe/Berlin')).isoformat(),'endLocal':datetime.datetime.fromtimestamp(t[-1],ZoneInfo('Europe/Berlin')).isoformat(),'measured':measured,'PVrange_W':[int(min(pv)),int(max(pv))],
 'modelComparison':{'transitionBefore':error((-B[a:]-nom)[trans]),'transitionWithGate':error((-B[a:]-pred)[trans]),'laterBefore':error((-B[a:]-nom)[later]),'laterWithGate':error((-B[a:]-pred)[later])},
 'startup':{'triggerRow':5,'firstOutput_W':900,'lastZeroBatterySample_s':float(tb[9]-t[a]),'firstNonzeroBatterySample_s':float(tb[10]-t[a]),'firstNonzeroRegulatorRow_s':float(rel[10]),'firstDirectionReadbackRow_s':float(rel[6]),'firstPackStateDischargeRow_s':float(rel[14]),'representativeGate_s':gate_s,'requestOutput_s':.088,'requestDirection_s':.508,'scope':'One full-standby startup event only; observed sample onset bracket, not proven actuator latency or universal timeout.'},
 'socMaxAll':all(r['socBlock']['batt_max'] for r in rs),'socBlockAll':all(r['socBlock']['soc_block'] for r in rs),'socValues':sorted({r['batteryBle']['observed']['soc']['value'] for r in rs}),
 'firstRows':[{'row':i,'dt_s':float(rel[i]),'grid_W':int(z[i]),'battery_W':int(B[i]),'command_W':rs[i]['outputs']['dischargeW'],'acMode':rs[i]['batteryStatus']['batt_acMode'],'packState':rs[i]['batteryStatus']['batt_packState']} for i in range(5,16)]}
(OUT/'Log13_Validierung.json').write_text(json.dumps(result,indent=2))
new=json.loads((ROOT/'results_regler_log12/Regler_Modell_V12_Ladebegrenzung.json').read_text());new['log13Validation']=result;new['latestValidationControllerVersion']='4.25-SIM';new['latestValidationLogSha256']=result['sourceSHA256'];new['modelRevision']='V13'
new['fullStandbyDischargeStartup']={'enabledByDefault':False,'activation':'transition from batt_max=true, zero battery power, standby packState and charging/idle direction to allowed discharge','releaseParameter_s':gate_s,'sensitivityScenarios_s':[7.2,8.0,9.2],'observation':result['startup'],'semantics':'Keep discharge output zero until release; delayed command target may update behind gate; then use unchanged normal discharge PT1 dynamics. Do not wait for packState telemetry to permit power.','chargeLimitWhenBattMax_W':0,'battMaxBlocksDischarge':False,'acceptanceRecoveryAfterDischarge':'unknown; retain V12 scenario-driven recovery, not permanently zero charge capacity','validation':'Transition is calibrated on this single event; later samples check normal dynamics only, not an independent startup validation.'}
(OUT/'Regler_Modell_V13_Voll_Entladen.json').write_text(json.dumps(new,indent=2))
fig,ax=plt.subplots(3,1,figsize=(11,9),constrained_layout=True)
s=rel<32
ax[0].plot((tb-t[a])[s],-B[s],'.-',label='Entladung gemessen');ax[0].step(rel[s],[r['outputs']['dischargeW'] for i,r in enumerate(rs) if s[i]],where='post',label='Anforderung');ax[0].plot((tb[a:]-t[a])[trans],nom[trans],'--',label='Bisheriges Modell');ax[0].plot((tb[a:]-t[a])[trans],pred[trans],'--',label='Mit Startfreigabe');ax[0].axvspan(tb[9]-t[a],tb[10]-t[a],alpha=.15,color='grey',label='Messintervall des Leistungsbeginns');ax[0].set_ylabel('W Entladen');ax[0].legend()
ax[1].plot(rel,z,label='Netzleistung');ax[1].axhspan(0,15,alpha=.2,color='green',label='Entladefenster 0…15 W');ax[1].set_ylabel('W (+ Import)');ax[1].legend()
ax[2].plot(rel[10:],z[10:],'.-',label='Netz nach Anlauf');ax[2].axhspan(0,15,alpha=.2,color='green');ax[2].axhline(7.5,ls='--',color='black',label='Ziel +7,5 W');ax[2].legend();ax[2].set_ylabel('W');ax[2].set_xlabel('Sekunden seit erkanntem Lastanstieg')
for x in ax:x.grid(alpha=.25)
fig.suptitle('Log13 / V4.25: volle Batterie → Entladen unter hoher PV');fig.savefig(OUT/'Log13_Umschaltung.png',dpi=150)
print(json.dumps(result,indent=2))

# Retain the locally validated coupled AC model and conditional parameter study.
new['fullStandbyDischargeStartup']['closedLoopACCoupling']={'scope':'Log13 local startup/discharge simulation only','gridEquation':'P_grid = P_external_net - P_discharge_actual; sample common physical response at each sensor receive timestamp','physicalResponse':'unchanged discharging.battery','oldSeparateGridPath':'retained in legacy models, not used for this local closed-loop branch; fails Log13 baseline long-horizon check','uncertainty':'No independently identified sensor filter. Net load reconstructed from logged grid minus signed battery power; may contain asynchronous measurement noise.'}
if (OUT/'Log13_Parametersimulation.json').exists():
 new['log13ParameterStudy']=json.loads((OUT/'Log13_Parametersimulation.json').read_text())
 new['log13ParameterStudy']['decision']='Keep PV discharge gain 0.8 and load-step up-ramp 900 W/tick. No robust benefit established from one startup; no new controller release.'
(OUT/'Regler_Modell_V13_Voll_Entladen.json').write_text(json.dumps(new,indent=2))
