"""Empirical, optional charge-acceptance envelope, not a universal SOC law.
Activation/release and initial capacity are scenario inputs. SOC alone cannot
identify these transitions from Log12. Applies to AC battery power in watts.
"""
import math

def acceptance_cap(elapsed_s, initial_w, floor_w, tau_s):
    if tau_s <= 0 or initial_w < floor_w or floor_w < 0:
        raise ValueError('Invalid acceptance envelope')
    return floor_w + (initial_w-floor_w)*math.exp(-max(0,elapsed_s)/tau_s)

def apply_acceptance(nominal_battery_w, elapsed_s, initial_w, floor_w, tau_s):
    # Preserve discharging and idle consumption; only positive charging is capped.
    return min(nominal_battery_w,acceptance_cap(elapsed_s,initial_w,floor_w,tau_s))

class AcceptanceObserver:
    """Causal suspicion indicator. It does not prove a BMS limit or estimate SOC physics.
    Call with measured battery power BEFORE updating the command. Breaks and
    falling commands invalidate pending evidence; no unobserved interval counts.
    """
    def __init__(self):
        self.pending_s=0.; self.command_age_s=0.; self.previous_u=None
    def update(self,dt,u,b,z,soc,charge_mode,ac_confirmed,fresh,contiguous=True):
        changed=self.previous_u is None or abs(u-self.previous_u)>20
        self.command_age_s=0. if changed or not contiguous else self.command_age_s+dt
        self.previous_u=u
        eligible=(contiguous and fresh and charge_mode and ac_confirmed and soc>=97
                  and self.command_age_s>=10 and u>200 and b>=0 and z<-15
                  and u-b>max(80,.1*u))
        self.pending_s=self.pending_s+dt if eligible else 0.
        return self.pending_s>=8
