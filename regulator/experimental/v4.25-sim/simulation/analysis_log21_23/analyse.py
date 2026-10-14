from common import *
from collections import Counter
result={}
for n in range(21,24):
 rs=read(n);g=[r for r in rs if executed(r)];seq=[r['execution']['invocationSequence'] for r in rs];cycles=[r['snapshotCycle']['regulatorCycleId'] for r in rs]
 masks={'all':lambda r:True,'normalCharge':lambda r:r['mode']=='REGEL_LADEN' and r['inputs']['p_solar']<720,'highCharge':lambda r:r['mode']=='REGEL_LADEN' and 720<=r['inputs']['p_solar']<1050,'veryHighCharge':lambda r:r['mode']=='REGEL_LADEN' and r['inputs']['p_solar']>=1050,'discharge':lambda r:r['mode']=='REGEL_ENTLADEN'}
 skips=[]
 for i,r in enumerate(rs):
  if executed(r):continue
  rej=r['measurementAtDecision']['rejectionForCycle'];skips.append({'row':i,'time':local(r['ts']),'ageMs':r['snapshotCycle']['ageMs'],'matchingBuilderRejection':rej,'outputEmitted':r['execution']['outputEmitted']})
 p={'sha256':hashlib.sha256((ROOT/f'upload/regler_event_log_{n}.jsonl').read_bytes()).hexdigest(),'start':local(rs[0]['ts']),'end':local(rs[-1]['ts']),'records':len(rs),'executed':len(g),'skips':skips,'continuousInvocationSequence':all(b==a+1 for a,b in zip(seq,seq[1:])),'duplicateSnapshotCycleIds':len(cycles)-len(set(cycles)),'continuousLoggerInputSequence':all(b['recording']['inputSequence']==a['recording']['inputSequence']+1 for a,b in zip(rs,rs[1:])),'pvRangeW':[min(r['inputs']['p_solar'] for r in g),max(r['inputs']['p_solar'] for r in g)],'metrics':{k:metric(rs,lambda i,r:pred(r)) for k,pred in masks.items()},'controlSets':dict(Counter(r['controlSet']['active'] for r in g)),'maxControllerRuntimeMs':max(r['execution']['elapsedMs'] for r in rs),'maxInvocationGapMs':max(r['execution']['intervalMs'] for r in rs),'blocksActiveRows':sum(r['directionBlocks']['charge']['blocked'] or r['directionBlocks']['discharge']['blocked'] for r in rs)}
 for cls in ['highCharge','veryHighCharge']:
  selected=[r for r in g if masks[cls](r)];p[cls+'Details']={'points':len(selected),'positiveImportPoints':sum(r['inputs']['p_zaehler']>0 for r in selected),'positiveImportAbove15Points':sum(r['inputs']['p_zaehler']>15 for r in selected),'rampLimitedPoints':sum(r['outputs']['chargeW']-r['controlBase']['lastChargeW']==20 for r in selected),'medianTargetW':float(np.median([r['targets']['p_target'] for r in selected])) if selected else None}
 result[str(n)]=p
(OUT/'Log21_23_Audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({n:{k:v for k,v in p.items() if k in ['records','executed','continuousInvocationSequence','duplicateSnapshotCycleIds','highChargeDetails','veryHighChargeDetails','controlSets']} for n,p in result.items()},indent=2))
