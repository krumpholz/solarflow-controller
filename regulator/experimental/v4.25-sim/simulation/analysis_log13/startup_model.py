"""Optional full-standby-to-discharge gate; AC watts and seconds.
The release time is a scenario parameter, not a universal battery property.
Calls during the gate retain the newest delayed target. No backlog burst.
Full/max-SOC blocks charging only; empty/min-SOC blocks discharging only.
"""
from math import inf

def effective_limits(max_charge_w,max_discharge_w,batt_max,batt_min,discharge_allowed=True):
    return (0. if batt_max else max_charge_w,
            0. if batt_min or not discharge_allowed else max_discharge_w)

def startup_response(times,commands,release_time,initial_time,m,advance):
    """commands: sorted (already delayed effect time, desired discharge magnitude).
    Returned values are positive discharge magnitudes. release_time may be
    initial_time to disable the added gate. Normal delay must precede this gate.
    """
    y=0.;target=0.;at=initial_time;j=0;out=[]
    def evolve(end):
        nonlocal y,at
        if end<=release_time:y=0.
        else:y=advance(y,target,max(0,end-max(at,release_time)),m)
        at=end
    for ts in times:
        while j<len(commands) and commands[j][0]<=ts:
            when,target_next=commands[j];evolve(when);target=target_next;j+=1
        evolve(ts);out.append(y)
    return out
