from common import *
import sys,copy
from scipy.optimize import least_squares
sys.path.insert(0,str(ROOT/'analysis_log6'))
from physics import advance

base_path=ROOT/'results_regler_log13/Regler_Modell_V13_Voll_Entladen.json'
base=json.loads(base_path.read_text())
def error(v):
    v=np.asarray(v,dtype=float);v=v[np.isfinite(v)]
    return {'points':len(v),'rmseW':float(np.sqrt(np.mean(v*v))),'maeW':float(np.mean(abs(v))),'p95AbsW':float(np.quantile(abs(v),.95))}
def response(n,mode,m):
    rows=read(n);pred=np.full(len(rows),np.nan);valid=np.zeros(len(rows),bool)
    req={(e.get('cycleId'),e.get('command')):e for e in events(rows) if e['stage']=='ha_call_requested'}
    old=None;y=None;at=None;target=None;q=[];last=-1e30;start=None;prevSeq=None
    sign=1 if mode=='REGEL_LADEN' else -1;key='chargeW' if sign==1 else 'dischargeW';oldKey='lastChargeW' if sign==1 else 'lastDischargeW'
    def goal(u):return m.get('idle_bias',m.get('bias',0)) if u==0 else m.get('gain',1)*u+m.get('bias',0)
    for i,r in enumerate(rows):
        if not executed(r):continue # Known skips preserve commands/plant state, no new measurement.
        if r['mode']!=mode:y=None;prevSeq=None;continue
        tc,tb,tz=clocks(r);seq=int(r['snapshotCycle']['regulatorCycleShort'])
        if y is None or (n!=16 and prevSeq is not None and seq!=prevSeq+1):
            y=sign*r['inputs']['p_batterie'];at=tb;old=r['controlBase'][oldKey];target=goal(old);q=[];last=-1e30;start=tb
        while q and q[0][0]<=tb:
            when,new=q.pop(0);y=advance(y,target,max(0,when-at),m);at=when;target=new
        y=advance(y,target,max(0,tb-at),m);at=tb;pred[i]=sign*y;valid[i]=tb-start>=8
        u=r['outputs'][key]
        if u!=old:
            e=req.get((r['snapshotCycle']['regulatorCycleId'],'inputLimit' if sign==1 else 'outputLimit'))
            clock=tc if sign==1 else e['ts']/1000 if e else tc+base['timing']['regulatorToRequestMedian_s']
            when=max(clock+(m['delay_up'] if u>old else m['delay_down']),last+1e-6)
            q.append((when,goal(u)));last=when;old=u
        prevSeq=seq
    return pred,valid

d0=copy.deepcopy(base['discharging']['battery']);c0=copy.deepcopy(base['charging']['battery'])
rs15=read(15);rs16=read(16)
B15=np.array([r['inputs']['p_batterie'] for r in rs15],float)
B16=np.array([r['inputs']['p_batterie'] if executed(r) else np.nan for r in rs16],float)
t15=np.array([r['ts'] for r in rs15]);t16=np.array([r['ts'] for r in rs16])
p15,v15=response(15,'REGEL_ENTLADEN',d0)
train15=v15&(t15<t15[0]+600000);test15=v15&~train15
def fitD(x):
    m={**d0,'bias':float(x[0])};p,_=response(15,'REGEL_ENTLADEN',m);return (B15-p)[train15]
fd=least_squares(fitD,[d0['bias']],loss='soft_l1',f_scale=2)
d1={**d0,'bias':float(fd.x[0]),'idle_bias':19.0}
def evalD(m):
    p15,v15=response(15,'REGEL_ENTLADEN',m);p16,v16=response(16,'REGEL_ENTLADEN',m)
    active16=v16&np.array([executed(r) and r['mode']=='REGEL_ENTLADEN' and r['outputs']['dischargeW']>=10 for r in rs16])
    idle16=v16&np.array([executed(r) and r['mode']=='REGEL_ENTLADEN' and r['outputs']['dischargeW']==0 and i>=438 for i,r in enumerate(rs16)])
    return {'trainLog15First10min':error((B15-p15)[train15]),'holdoutLog15Last10min':error((B15-p15)[test15]),
            'holdoutLog16Active':error((B16-p16)[active16]),'log16IdleCalibrationOnly':error((B16-p16)[idle16])}
dResults={'V13':evalD(d0),'localLowPower':evalD(d1)}
adoptDischarge=all(dResults['localLowPower'][part][k]<dResults['V13'][part][k]
    for part in ['holdoutLog15Last10min','holdoutLog16Active'] for k in ['rmseW','maeW'])
p16,v16=response(16,'REGEL_LADEN',c0)
startC=next(r['ts'] for r in rs16 if r['mode']=='REGEL_LADEN')
active=v16&np.array([executed(r) and r['mode']=='REGEL_LADEN' and r['outputs']['chargeW']>=60 for r in rs16])
trainC=active&(t16<startC+120000);testC=active&~trainC
def fitC(x):
    m={**c0,'bias':float(x[0])};p,_=response(16,'REGEL_LADEN',m);return (B16-p)[trainC]
fc=least_squares(fitC,[c0['bias']],loss='soft_l1',f_scale=3)
c1={**c0,'bias':float(fc.x[0])}
def evalC(m):
    p,v=response(16,'REGEL_LADEN',m)
    return {'trainFirst120s':error((B16-p)[trainC]),'holdoutRemainder':error((B16-p)[testC])}
cResults={'V13':evalC(c0),'biasCandidate':evalC(c1)}
adoptCharge=all(cResults['biasCandidate']['holdoutRemainder'][k]<cResults['V13']['holdoutRemainder'][k] for k in ['rmseW','maeW'])
summary={'discharge':{'frozen':d0,'local':d1,'adoptActiveBias':adoptDischarge,'fits':dResults,'fitOnly':'bias; gain, delay, time constants and slew limits retained',
   'trainDomain':'Log15 first10min, low discharge commands; independent Log15 remainder and Log16 active discharge checks',
   'idle':'Zero-command -19 W telemetry calibrated on one Log16 interval; physical zero-command export is not independently identifiable.'},
 'charge':{'frozen':c0,'candidate':c1,'adoptLocalBias':adoptCharge,'fits':cResults,
   'fitOnly':'bias; fixed V13 dynamics. First120s charging used for fit, remaining samples held out.',
   'commandRangeObservedW':[min(r['outputs']['chargeW'] for r in rs16 if r['mode']=='REGEL_LADEN'),max(r['outputs']['chargeW'] for r in rs16 if r['mode']=='REGEL_LADEN')]}}
model=copy.deepcopy(base);model['modelRevision']='V14';model['latestValidationControllerVersion']='4.25-SIM-DIAG1'
model['latestValidationLogSha256']={str(n):hashlib.sha256((ROOT/f'upload/regler_event_log_{n}.jsonl').read_bytes()).hexdigest() for n in [15,16]}
model['lowPowerDawnExtension']={'scope':'Logs15/16: PV8..367W, active discharge <=90W and charge commands60..285W. Not a High-PV or full-battery recalibration.',
 'dischargingLowPower':d1 if adoptDischarge else {**d0,'idle_bias':19.0},'activeDischargeCommandMaximumW':120,
 'chargingLowPower':c1 if adoptCharge else c0,'physicalIdleAlternativesW':[-19,0],
 'calibration':summary,
 'clock':'Charge dynamics referenced to controller invocation. Discharge dynamics referenced to HA request (fallback: controller plus existing median request latency). Do not add request delay twice.',
 'transition':'A single D-to-C event. Existing normal charging delay already brackets observed onset; no additional full-standby 8s gate applies.',
 'diagnosticOnlyInvocations':'Maintain controller and actuator state; no command on outputs1..3. Do not use null diagnostic values as zero measurements. Known skips differ from unobserved historical gaps.',
 'uncertainty':'2s data cannot separate transport, physical dynamics and reporting filters. House power is derived. Physical idle contribution, measurement offset and external net load are not independently identified.'}
(OUT/'Log15_16_Kalibrierung.json').write_text(json.dumps(summary,indent=2)+'\n')
(OUT/'Regler_Modell_V14.json').write_text(json.dumps(model,indent=2)+'\n')
np.savez(OUT/'calibration_plot_data.npz',log15Old=p15,log15Local=response(15,'REGEL_ENTLADEN',d1)[0],
 log16DOld=response(16,'REGEL_ENTLADEN',d0)[0],log16DLocal=response(16,'REGEL_ENTLADEN',d1)[0],
 log16COld=response(16,'REGEL_LADEN',c0)[0],log16CLocal=response(16,'REGEL_LADEN',c1)[0])
print(json.dumps({'discharge':dResults,'charge':cResults,'D_bias':d1['bias'],'C_bias':c1['bias'],'adoptCharge':adoptCharge},indent=2))
