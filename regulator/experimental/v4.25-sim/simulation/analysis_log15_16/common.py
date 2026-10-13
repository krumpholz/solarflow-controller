from pathlib import Path
import json, hashlib, datetime
from zoneinfo import ZoneInfo
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'results_regler_log15_16'
OUT.mkdir(exist_ok=True)
def read(n):
    return [json.loads(s) for s in (ROOT/f'upload/regler_event_log_{n}.jsonl').read_text().splitlines() if s.strip()]
def executed(r): return r.get('execution',{}).get('controlExecuted',True) is True
def local(ts): return datetime.datetime.fromtimestamp(ts/1000,ZoneInfo('Europe/Berlin')).isoformat()
def clocks(r):
    s=r.get('snapshot') or {};rx=s.get('rxTsByTopic',{})
    tc=r.get('execution',{}).get('enteredTs',min(r['ts'],r['snapshotCycle']['lastOkTs']+r['snapshotCycle']['ageMs']))/1000
    return tc,rx.get('p_batterie',r['snapshotCycle']['lastOkTs'])/1000,rx.get('p_zaehler',r['snapshotCycle']['lastOkTs'])/1000
def metric(rows,mask):
    a=[]
    for i,r in enumerate(rows):
        if not executed(r) or not mask(i,r):continue
        dt=0
        if i+1<len(rows) and executed(rows[i+1]) and int(rows[i+1]['snapshotCycle']['regulatorCycleShort'])==int(r['snapshotCycle']['regulatorCycleShort'])+1:
            dt=(rows[i+1]['ts']-r['ts'])/1000
        z=r['inputs']['p_zaehler'];lo=r['effectiveWindows']['charge']['p_o_s_in_eff'] if r['mode']=='REGEL_LADEN' else r['effectiveWindows']['discharge']['p_o_b_out_eff']
        hi=r['effectiveWindows']['charge']['p_o_max_eff'] if r['mode']=='REGEL_LADEN' else r['effectiveWindows']['discharge']['p_o_max_eff']
        a.append((z,r['targets']['p_target'],lo,hi,dt))
    if not a:return {'points':0}
    x=np.array(a);z,t,lo,hi,w=x.T;dur=sum(w)
    return {'points':len(a),'scoredSeconds':float(dur),'meanGridW':float(np.average(z,weights=w)),
            'targetMAEW':float(np.average(abs(z-t),weights=w)),'withinWindowPct':float(np.average((z>=lo)&(z<=hi),weights=w)*100),
            'importWh':float(sum(w*np.maximum(z,0))/3600),'exportWh':float(sum(w*np.maximum(-z,0))/3600),
            'minGridW':float(min(z)),'maxGridW':float(max(z))}

def events(rows):
    out={}
    for r in rows:
        b=r.get('batteryBle',{});es=list(b.get('eventsSincePreviousCapture',[]))
        for v in b.get('haCalls',{}).get('lastByCommand',{}).values():es.extend(v.values())
        for e in es:
            if 'eventSeq' in e:out[e['eventSeq']]=e
    return list(out.values())
