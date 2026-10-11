"""Reproducible plant response. Idle telemetry has its own fitted zero-command level."""
import math
import numpy as np

def advance(y,target,dt,m):
    if dt<=0:return y
    e=target-y
    if abs(e)<1e-12:return target
    tau=m['tau_up'] if e>0 else m['tau_down']
    rate=m['rate_up'] if e>0 else m['rate_down']
    s=1 if e>0 else -1
    linear=max(0,(abs(e)-rate*tau)/rate)
    if dt<=linear:return y+s*rate*dt
    if linear>0:return target-s*rate*tau*math.exp(-(dt-linear)/tau)
    return target-e*math.exp(-dt/tau)

def command_target(u,m):
    return m['idle_bias'] if u==0 and 'idle_bias' in m else m.get('gain',1)*u+m.get('bias',0)

def response(d,m,channel='battery'):
    tm=d['tb'] if channel=='battery' else d['tz']
    gain=m.get('gain',1);bias=m.get('bias',0)
    y=float(d['b'][0]) if channel=='battery' else gain*d['initial']+bias
    target=command_target(d['initial'],m);at=float(tm[0]);last=-1e20;events=[];prev=d['initial']
    for tc,u in zip(d['tc'],d['u']):
        if u==prev:continue
        delay=m['delay_up'] if u>prev else m['delay_down']
        effective=max(tc+delay,last+1e-6)
        events.append((effective,command_target(u,m)));last=effective;prev=u
    j=0;result=[]
    for t in tm:
        while j<len(events) and events[j][0]<=t:
            et,new=events[j];y=advance(y,target,max(0,et-at),m);at=et;target=new;j+=1
        y=advance(y,target,float(t)-at,m);at=float(t);result.append(y)
    return np.asarray(result)

def pv_effect(d,lag,tau):
    # Relative phase between reported PV and its contribution at the grid meter.
    # Negative lag is an offline sensor-phase hypothesis, not controller look-ahead.
    p=d['pv'];filtered=[float(p[0])]
    for i in range(1,len(p)):
        dt=d['tp'][i]-d['tp'][i-1]
        filtered.append(float(p[i]+(filtered[-1]-p[i])*math.exp(-dt/max(tau,.02))))
    return np.interp(d['tz']-lag,d['tp'],filtered)

KEYS=['tau_up','delay_up','tau_down','delay_down','rate_up','rate_down','gain','bias']
def unpack(x):return dict(zip(KEYS,map(float,x)))
def errors(e):return {'rmse_W':float(np.sqrt(np.mean(e**2))),'mae_W':float(np.mean(abs(e))),'max_abs_W':float(np.max(abs(e)))}

