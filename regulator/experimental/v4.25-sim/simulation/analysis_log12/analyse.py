from base import *
from acceptance_model import acceptance_cap,apply_acceptance,AcceptanceObserver
from scipy.optimize import least_squares
from zoneinfo import ZoneInfo
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ix=np.arange(len(rs));u=np.array([r['outputs']['chargeW'] for r in rs]);soc=np.array([r['batteryBle']['observed']['soc']['value'] for r in rs]);house=np.array([r['inputs']['p_haus'] for r in rs])
highmodel=json.loads((ROOT/'results_regler_log9/Regler_Modell_V9_Log9.json').read_text())['chargingHighPVLocal']['battery']
nom,valid,_=response(highmodel,True)
# First 120 s after an unambiguous sustained charge-power reduction; no holdout samples fit.
a=180;train=(ix>=a)&(t<t[a]+120);test=(t>=t[a]+120)&(ix<375)
b0=float(B[a]);elapsed=t-t[a]
fit=least_squares(lambda p:p[0]+(b0-p[0])*np.exp(-elapsed[train]/p[1])-B[train],[158,85],bounds=([0,10],[500,300]),loss='soft_l1',f_scale=10)
floor,tau=map(float,fit.x);cap=np.array([acceptance_cap(e,b0,floor,tau) for e in elapsed]);limited=np.minimum(nom,cap)
fitResult={'activationRow':a,'initialBattery_W':b0,'floor_W':floor,'tau_s':tau,'trainRows':np.flatnonzero(train).tolist(),'testRows':np.flatnonzero(test).tolist(),'train':error((B-cap)[train]),'holdout':error((B-cap)[test]),'uncappedHoldout':error((B-nom)[test]),'cappedHoldout':error((B-limited)[test]),'scope':'Single identified taper episode. Activation and release supplied externally, not predicted from SOC.'}
observer=AcceptanceObserver();flags=[]
for i,r in enumerate(rs):
 dt=0 if i==0 else t[i]-t[i-1]
 flags.append(observer.update(dt,r['controlBase']['lastChargeW'],B[i],z[i],soc[i],charge[i],r['batteryStatus']['batt_acMode']==1,r['batteryMeasurement']['fresh'],i>0 and seq[i]==seq[i-1]+1))
flags=np.array(flags);segments={
 'all':np.ones(len(rs),bool), 'beforeTaper':ix<179,'taper':(ix>=179)&(ix<375),
 'discharge':~charge,'afterReturnToCharge':ix>=533,
 'highChargeBeforeTaper':charge&(pv>=720)&(ix<179),
 'quietHighBeforeTaper':charge&(pv>=720)&(ix<179)&quiet,
 'shortStableAfterReturn':(ix>=586)&(ix<=609),
 'latePossibleTaper':ix>=678,
 'charge350to450':charge&(pv>=350)&(pv<=450)}
measured={k:metrics(v) for k,v in segments.items()}
# Energetic estimate only under empirical cap and measured exogenous PV/load.
physicalExport=np.maximum(0,pv-house-cap)
mask=test
unavoidable={'scope':'holdout of first empirically fitted acceptance episode; AC balance, not independent ground truth', 'estimated_export_Wh':float(sum(w*mask*physicalExport)/3600),'observed_export_Wh':float(sum(w*mask*np.maximum(0,-z))/3600)}
rowsEvent=[]
for i in range(527,541):
 r=rs[i];rowsEvent.append({'row':i,'relative_s':round(t[i]-t[529],3),'grid_W':int(z[i]),'battery_W':int(B[i]),'PV_W':int(pv[i]),'house_W':int(house[i]),'charge_W':r['outputs']['chargeW'],'discharge_W':r['outputs']['dischargeW'],'control':r['controlSet']['active']})
# Power balance may contain asynchronous measurements: quantify rather than assume independence.
balance=z-(house+B-pv)
result={'sourceSHA256':hashlib.sha256((ROOT/'upload/regler_event_log_12.jsonl').read_bytes()).hexdigest(),'audit':audit,
 'versions':sorted({r['version'] for r in rs}), 'rangePV_W':[int(min(pv)),int(max(pv))], 'SOCvalues':sorted(set(soc.tolist())),
 'startLocal':datetime.datetime.fromtimestamp(t[0],ZoneInfo('Europe/Berlin')).isoformat(),'endLocal':datetime.datetime.fromtimestamp(t[-1],ZoneInfo('Europe/Berlin')).isoformat(),
 'measured':measured,'acceptanceFit':fitResult,'acceptanceObserver':{'flaggedRows':np.flatnonzero(flags).tolist(),'firstFlaggedRow':int(np.flatnonzero(flags)[0]) if flags.any() else None,'notBmsProof':True},
 'physicalExportEstimate':unavoidable,'loadFall':rowsEvent,'fastBranchRows':[i for i,r in enumerate(rs) if r['controlSet']['active']=='discharge_export_fast'],
 'batteryMaxFlagRows':sum(r['socBlock']['batt_max'] for r in rs), 'maxAbsAlgebraicBalanceResidual_W':float(max(abs(balance))),
 'integratorChargeMax_W':max(r['integrator']['iChargeW'] for r in rs)}
(OUT/'Log12_Validierung.json').write_text(json.dumps(result,indent=2))
model12=json.loads((ROOT/'results_regler_log11/Regler_Modell_V11_Log11.json').read_text())
model12['log12Validation']=result
model12['chargeAcceptanceExtension']={'enabledByDefault':False,'equation':'B_actual(t)=min(B_nominal(t), C(t)); C(t)=C_floor+(C_initial-C_floor)*exp(-(t-t0)/tau)','units':'AC W, seconds','parameters':fitResult,'scenarioInputs':['activation time t0','initial AC acceptance','release/reset after discharge or recovery'],'observer':'analysis_log12/acceptance_model.py; causal suspicion, not authoritative BMS state','limitations':['No universal SOC-to-cap function; same SOC 98 occurs with approximately 158 and 1293 W charging.','No cell voltages, temperature or authoritative BMS allowed-charge-power measurement.','Only first taper episode fitted/chronologically validated. Short final reduction is not an independent long validation.','Do not replay measured battery residuals as invariant after changing discharge history.','Original uncapped dynamics and controller parameters retained.']}
(OUT/'Regler_Modell_V12_Ladebegrenzung.json').write_text(json.dumps(model12,indent=2))
fig,axs=plt.subplots(4,1,figsize=(12,12),constrained_layout=True);tm=(t-t[0])/60
axs[0].plot(tm,pv,label='PV');axs[0].plot(tm,house,label='Hauslast');axs[0].legend();axs[0].set_ylabel('W')
axs[1].plot(tm,u,label='Ladeanforderung');axs[1].plot(tm,B,label='Batterie gemessen');idx=(ix>=a)&(ix<375);axs[1].plot(tm[idx],cap[idx],'--',label='Aufnahmegrenze (Modell)');axs[1].axvline(tm[np.flatnonzero(test)[0]],color='k',ls=':',label='Beginn unabhängiger Zeitabschnitt');axs[1].legend();axs[1].set_ylabel('W')
axs[2].plot(tm,z,label='Netz: + Import / − Export');axs[2].axhspan(-5,15,color='green',alpha=.2,label='Ladefenster −5…+15 W');axs[2].legend();axs[2].set_ylabel('W');axs[2].set_xlabel('Minuten seit Logbeginn')
idx=(ix>=525)&(ix<544);axs[3].plot(t[idx]-t[529],z[idx],'.-',label='Netz');axs[3].plot(t[idx]-t[529],B[idx],'.-',label='Batterie');axs[3].step(t[idx]-t[529],np.array([r['outputs']['dischargeW'] for r in rs])[idx],where='post',label='Entladeanforderung');axs[3].legend();axs[3].set_xlabel('Sekunden zum großen Lastabfall');axs[3].set_ylabel('W');axs[3].axvspan(t[530]-t[529],t[531]-t[529],color='grey',alpha=.18,label='Messlücke');axs[3].legend()
for ax in axs:ax.grid(alpha=.25)
fig.suptitle('Log12 / V4.25: Lastsprünge und begrenzte Ladeaufnahme');fig.savefig(OUT/'Log12_Verhalten_Modell.png',dpi=150)
print(json.dumps({k:v for k,v in result.items() if k not in ['acceptanceObserver','loadFall']},indent=2))
