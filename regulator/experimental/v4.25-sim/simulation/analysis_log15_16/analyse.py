from common import *
import collections

result={'source':{},'logs':{},'interpretation':{}}
for n in [15,16]:
    rows=read(n);good=[r for r in rows if executed(r)];seq=[int(r['snapshotCycle']['regulatorCycleShort']) for r in rows]
    snapshot_bad=[]
    for i,r in enumerate(rows):
        if not executed(r):continue
        s=r.get('snapshot') or {}
        if s.get('cycleId')!=r['snapshotCycle']['regulatorCycleId'] or any(s.get('values',{}).get(k)!=r['inputs'][k] for k in ['p_solar','p_batterie','p_zaehler','p_haus']):snapshot_bad.append(i)
    ev=events(rows);ids={r['snapshotCycle']['regulatorCycleId'] for r in rows};req=[e for e in ev if e['stage']=='ha_call_requested' and e.get('cycleId') in ids]
    done={e.get('requestEventSeq'):e for e in ev if e['stage']=='ha_call_completed'}
    skips=[]
    for i,r in enumerate(rows):
        if executed(r):continue
        m=r['measurementAtDecision'];rej=m['rejectionForCycle'];sc=r['snapshotCycle']
        skips.append({'row':i,'time':local(r['ts']),'cycle':sc['regulatorCycleShort'],
          'reason':r['execution']['reasons'],'cause':'builder_latency' if rej else 'delayed_controller_invocation',
          'snapshotAgeMs':sc['ageMs'],'controllerSinceTriggerMs':r['execution']['enteredTs']-r['execution']['triggerTsFromFlow'],
          'rejection':rej,'outputEmitted':r['execution']['outputEmitted'],
          'nullInputs':all(v is None for v in r['inputs'].values()),'nullOutputs':all(v is None for v in r['outputs'].values())})
    g={
      'all':lambda i,r:True,
      'discharge_pv_le_50':lambda i,r:r['mode']=='REGEL_ENTLADEN' and r['inputs']['p_solar']<=50,
      'discharge_pv_gt_50_active':lambda i,r:r['mode']=='REGEL_ENTLADEN' and r['inputs']['p_solar']>50 and r['outputs']['dischargeW']>0,
      'discharge_zero_command':lambda i,r:r['mode']=='REGEL_ENTLADEN' and r['outputs']['dischargeW']==0,
      'charge_lowpv':lambda i,r:r['mode']=='REGEL_LADEN' and r['inputs']['p_solar']<280,
      'charge_normalpv':lambda i,r:r['mode']=='REGEL_LADEN' and r['inputs']['p_solar']>=280,
      'charge_all':lambda i,r:r['mode']=='REGEL_LADEN',
      'charge_last_120s':lambda i,r:r['mode']=='REGEL_LADEN' and r['ts']>=rows[-1]['ts']-120000}
    ex=[r.get('execution') for r in rows if r.get('execution')]
    payload={'start':local(rows[0]['ts']),'end':local(rows[-1]['ts']),'rows':len(rows),'executed':len(good),'diagnosticSkips':len(skips),
      'missingInvocationCycles':sum(max(0,b-a-1) for a,b in zip(seq,seq[1:])),
      'continuousLoggerInputSequence':[r['recording']['inputSequence'] for r in rows]==list(range(1,len(rows)+1)),
      'duplicateCycleIds':len(seq)-len(set(seq)),'invalidExecutedSnapshots':snapshot_bad,
      'modeCounts':dict(collections.Counter(r['mode'] for r in rows)),'diagnosticVersions':dict(collections.Counter(str(r.get('diagnosticVersion')) for r in rows)),
      'pvRangeW':[min(r['inputs']['p_solar'] for r in good),max(r['inputs']['p_solar'] for r in good)],
      'gridTargetW':sorted({r['targets']['p_target'] for r in good}),'runtimeErrors':sum(r.get('execution',{}).get('outcome')=='runtime_error' for r in rows),
      'executionMaxMs':max((e['elapsedMs'] for e in ex),default=None),'snapshotSkips':skips,
      'HARequests':len(req),'HAMatchedCompletions':sum(e['eventSeq'] in done for e in req),
      'maxLoggerDelayMs':max(r['log_ts']-r['ts'] for r in rows),
      'BLEUnreadyRows':sum(r['batteryBle']['ready']['value'] is not True for r in rows),
      'staleBLEPollRows':sum(bool(r['batteryBle']['diagnosticCoverage']['stalePollObserved']) for r in rows),
      'separateBlocksPresent':all('charge'in r['directionBlocks'] and 'discharge'in r['directionBlocks'] for r in rows),
      'chargeOrDischargeInhibitedRows':sum(r['directionBlocks']['charge']['blocked'] or r['directionBlocks']['discharge']['blocked'] for r in rows),
      'metrics':{k:metric(rows,v) for k,v in g.items()},
      'metricsSemantics':'Time weighting between adjacent valid measurement/controller cycles only; missing/diagnostic intervals are not scored as zero power.'}
    if n==16:
        firstC=next(i for i,r in enumerate(rows) if r['mode']=='REGEL_LADEN')
        zero=next(i for i,r in enumerate(rows) if executed(r) and r['outputs']['dischargeW']==0)
        guard=[(i,r) for i,r in enumerate(rows) if executed(r) and r['directionGuard']['blocked']]
        idle=[r for i,r in enumerate(rows) if executed(r) and zero+3<=i<firstC]
        payload['transition']={'firstChargeRow':firstC,'firstChargeAt':local(rows[firstC]['ts']),
          'firstZeroDischargeRow':zero,'firstZeroDischargeAt':local(rows[zero]['ts']),
          'zeroToChargeSeconds':(rows[firstC]['ts']-rows[zero]['ts'])/1000,
          'blockedGuardRows':len(guard),'guardFirstRow':guard[0][0],'guardLastRow':guard[-1][0],
          'guardReasons':{'exportThresholdW':-35,'surplusMarginW':40},
          'idleBatteryMedianW':float(np.median([r['inputs']['p_batterie'] for r in idle])),
          'gridAtFirstChargeW':rows[firstC]['inputs']['p_zaehler'],
          'firstChargeW':rows[firstC]['outputs']['chargeW'],
          'firstPositiveBatteryRow':next(i for i,r in enumerate(rows) if executed(r) and r['inputs']['p_batterie']>0)}
    result['source'][str(n)]={'filename':f'regler_event_log_{n}.jsonl','sha256':hashlib.sha256((ROOT/f'upload/regler_event_log_{n}.jsonl').read_bytes()).hexdigest()}
    result['logs'][str(n)]=payload
result['interpretation']={'highPVObserved':False,'normalDischargeTargetW':7.5,'chargeTargetBelow720W':5,
 'log16Idle':'Approximately -19 W battery telemetry at zero discharge command. A measured idle operating point, not proof of real minimum AC export without independent load metering.',
 'latency':'Three builder latency rejects are now proved. Two accepted same-cycle snapshots were skipped at ages 1871 and 1843 ms after delayed controller calls. No threshold change follows automatically.'}
(OUT/'Log15_16_Audit.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({k:{x:v[x] for x in ['rows','executed','missingInvocationCycles','metrics']} for k,v in result['logs'].items()},indent=2))
