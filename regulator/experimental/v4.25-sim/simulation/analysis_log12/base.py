from pathlib import Path
import json,hashlib,datetime,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'results_regler_log12'
sys.path.insert(0,str(ROOT/'analysis_log6'))
from physics import advance
rs=[json.loads(s) for s in (ROOT/'upload/regler_event_log_12.jsonl').read_text().splitlines() if s.strip()]

t=np.array([r['ts']/1000 for r in rs]);seq=np.array([int(r['snapshotCycle']['regulatorCycleShort']) for r in rs]);pv=np.array([r['inputs']['p_solar'] for r in rs]);z=np.array([r['inputs']['p_zaehler'] for r in rs]);B=np.array([r['inputs']['p_batterie'] for r in rs]);target=np.array([r['targets']['p_target'] for r in rs]);charge=np.array([r['mode']=='REGEL_LADEN' for r in rs]);w=np.r_[np.where(np.diff(seq)==1,np.diff(t),0),0];breaks=np.r_[0,np.flatnonzero(np.diff(seq)!=1)+1,len(rs)]
lo=np.where(charge,-5,0);snapValid=[];tb=[];tz=[]
for r in rs:
 s=r.get('snapshot') or {};ok=s.get('cycleId')==r['snapshotCycle']['regulatorCycleId'] and all(s.get('values',{}).get(k)==r['inputs'][k] for k in ['p_zaehler','p_batterie','p_solar','p_haus']);snapValid.append(ok)
 rx=s.get('rxTsByTopic',{}) if ok else {};tb.append(rx.get('p_batterie',r['snapshotCycle']['lastOkTs'])/1000);tz.append(rx.get('p_zaehler',r['snapshotCycle']['lastOkTs'])/1000)
tb=np.array(tb);tz=np.array(tz)
quiet=np.ones(len(rs),bool);since=-1e20
for i,r in enumerate(rs):
 if i in breaks:since=t[i]
 d=r['loadStepDetection']['delta']
 if abs(d['dLoadEst'])>40 or abs(d['dSolar'])>30:since=t[i]
 quiet[i]=t[i]-since>=40
def metrics(mask):
 ww=w*mask;dur=sum(ww)
 if dur==0:return {"points":int(sum(mask)),"duration_s":0}
 return {'points':int(sum(mask)),'duration_s':float(dur),'mean_W':float(sum(ww*z)/dur),'target_mae_W':float(sum(ww*abs(z-target))/dur),
 'within_pct':float(sum(ww*((z>=lo)&(z<=15)))/dur*100),'shifted_window_pct':float(sum(ww*((z>=target-10)&(z<=target+10)))/dur*100),'no_import_pct':float(sum(ww*(z<=0))/dur*100),'center_2W_pct':float(sum(ww*(abs(z-target)<=2))/dur*100),
 'import_Wh':float(sum(ww*np.maximum(z,0))/3600),'export_Wh':float(sum(ww*np.maximum(-z,0))/3600),'min_W':int(min(z[mask])),'max_W':int(max(z[mask]))}
groups={'all':np.ones(len(rs),bool),'discharge':~charge,'normalCharge':charge&(pv<720),'requestedCharge':charge&(pv>=350)&(pv<=450),'highCharge':charge&(pv>=720),'first8min':t<t[0]+480}
measured={k:{'all':metrics(v),'quiet':metrics(v&quiet)} for k,v in groups.items()}
events={};conflicts=[]
for r in rs:
 b=r['batteryBle'];ev=list(b.get('eventsSincePreviousCapture',[]))
 for q in b['haCalls'].get('lastByCommand',{}).values():ev.extend(q.values())
 for e in ev:
  key=e.get('eventSeq')
  if key in events and events[key]!=e:conflicts.append(key)
  events[key]=e
def observed_time(ts):return any(t[a]<=ts/1000<=t[b-1] for a,b in zip(breaks,breaks[1:]))
knownCycles={r['snapshotCycle']['regulatorCycleId'] for r in rs}
selected=[e for e in events.values() if e.get('cycleId') in knownCycles]
requests=[e for e in selected if e['stage']=='ha_call_requested'];done=[e for e in events.values() if e['stage']=='ha_call_completed'];completed={e.get('requestEventSeq'):e for e in done}
unmatched=[e['eventSeq'] for e in requests if e['eventSeq'] not in completed]
times=[completed[e['eventSeq']]['haCallDurationMs'] for e in requests if e['eventSeq'] in completed]
ready=[r['batteryBle']['ready']['value'] for r in rs]
coverage={k:sum(not r['batteryBle']['diagnosticCoverage'][k] for r in rs) for k in ['allObserversPresent','allObservedStatesValid','snapshotFrozenInRegulator','haCallAuditObserved']}
audit={'rows':len(rs),'snapshotAttachmentInvalid':int(sum(not x for x in snapValid)),
 'distinctConfigs':len({json.dumps(r['cfg'],sort_keys=True) for r in rs}),
 'coreCycleMismatch':sum(not r['snapshotCycle']['cycleMatch'] for r in rs),'coreStale':sum(not r['snapshotCycle']['freshForControl'] for r in rs),
 'batteryStale':sum(not r['batteryMeasurement']['fresh'] for r in rs),'httpPresent':sum('batteryHttp'in r for r in rs),
 'bleNotReady':sum(not x for x in ready),'coverageFalseCounts':coverage,'eventConflicts':conflicts,
 'stalePollRows':sum(bool(r['batteryBle']['diagnosticCoverage'].get('stalePollObserved')) for r in rs),
 'maxPollAgeByObserver_ms':{k:max(r['batteryBle']['observed'][k]['pollAgeMs'] for r in rs) for k in rs[0]['batteryBle']['observed']},
 'observedRequests':len(requests),'matchedCompletions':len(requests)-len(unmatched),'unmatchedRequestSeq':unmatched,
 'haErrors':sum(e['stage'] not in ['ha_call_requested','ha_call_completed'] for e in selected),
 'haDurationMedian_ms':float(np.median(times)),'haDurationMax_ms':max(times),
 'missingCycles':int(sum(np.maximum(0,np.diff(seq)-1))),'episodes':len(breaks)-1,
 'wallDuration_s':float(t[-1]-t[0]),'observedDuration_s':float(sum(w)),
 'gaps':[{'afterRow':int(i),'seconds':float(t[i]-t[i-1]),'missingCycles':int(seq[i]-seq[i-1]-1)} for i in breaks[1:-1]]}
model=json.loads((ROOT/'restored_pv/project/results_regler_log6/Regler_Modell_V6.json').read_text())
reqByCycle={(e['cycleId'],e['command']):e for e in events.values() if e['stage']=='ha_call_requested'}
def response(m,isCharge):
 pred=np.full(len(rs),np.nan);valid=np.zeros(len(rs),bool);requestUsed=0
 responseBreaks=np.unique(np.r_[breaks,np.flatnonzero(charge[1:]!=charge[:-1])+1])
 for a,b in zip(responseBreaks,responseBreaks[1:]):
  if charge[a]!=isCharge:continue
  mode='chargeW' if isCharge else 'dischargeW';lastKey='lastChargeW' if isCharge else 'lastDischargeW';command='inputLimit' if isCharge else 'outputLimit'
  initial=rs[a]['controlBase'][lastKey];sign=1 if isCharge else -1
  def tgt(u):return m.get('idle_bias',m.get('bias',0)) if u==0 else m.get('gain',1)*u+m.get('bias',0)
  y=sign*B[a];current=tgt(initial);at=tb[a];queue=[];last=-1e30;prev=initial
  for i in range(a,b):
   u=rs[i]['outputs'][mode]
   if u!=prev:
    # Charge model clock is regulator. Discharge model clock is HA request.
    e=reqByCycle.get((rs[i]['snapshotCycle']['regulatorCycleId'],command))
    clock=t[i] if isCharge else e['ts']/1000 if e else t[i]+model['timing']['regulatorToRequestMedian_s']
    if e and not isCharge:requestUsed+=1
    when=max(clock+(m['delay_up'] if u>prev else m['delay_down']),last+1e-6);queue.append((when,tgt(u)));last=when;prev=u
  j=0
  for i in range(a,b):
   while j<len(queue) and queue[j][0]<=tb[i]:
    when,new=queue[j];y=advance(y,current,max(0,when-at),m);at=when;current=new;j+=1
   y=advance(y,current,tb[i]-at,m);at=tb[i];pred[i]=sign*y;valid[i]=tb[i]-tb[a]>=6
 return pred,valid,requestUsed
def error(e):return {'points':len(e),'rmse_W':float(np.sqrt(np.mean(e*e))),'mae_W':float(np.mean(abs(e))),'max_abs_W':float(max(abs(e)))}



