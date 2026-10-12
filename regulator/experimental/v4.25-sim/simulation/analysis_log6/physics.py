"""Analytical delayed, rate-limited PT1 response in watts and seconds."""
import math

def advance(y,target,dt,m):
    if dt<=0:return y
    e=target-y
    if abs(e)<1e-12:return target
    tau=m['tau_up'] if e>0 else m['tau_down']
    rate=m['rate_up'] if e>0 else m['rate_down']
    sign=1 if e>0 else -1
    linear=max(0,(abs(e)-rate*tau)/rate)
    if dt<=linear:return y+sign*rate*dt
    if linear>0:return target-sign*rate*tau*math.exp(-(dt-linear)/tau)
    return target-e*math.exp(-dt/tau)
