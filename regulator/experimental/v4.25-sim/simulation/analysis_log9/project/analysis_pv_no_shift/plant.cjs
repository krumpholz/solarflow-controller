// Saturated PT1 response, with FIFO delayed commands and separate idle telemetry.
function advance(y,target,dt,m){
 if(dt<=0)return y;
 const e=target-y;if(Math.abs(e)<1e-12)return target;
 const tau=e>0?m.tau_up:m.tau_down,rate=e>0?m.rate_up:m.rate_down,s=Math.sign(e);
 const linear=Math.max(0,(Math.abs(e)-rate*tau)/rate);
 if(dt<=linear)return y+s*rate*dt;
 if(linear>0)return target-s*rate*tau*Math.exp(-(dt-linear)/tau);
 return target-e*Math.exp(-dt/tau);
}
function target(u,m){return u===0&&m.idle_bias!==undefined?m.idle_bias:u*(m.gain??1)+(m.bias??0);}
class Plant{
 constructor(m,u,t,y=null){this.m=m;this.y=y??target(u,m);this.target=target(u,m);this.at=t;this.last=-1e20;this.queue=[];}
 sample(t){while(this.queue.length&&this.queue[0].at<=t){const e=this.queue.shift();this.y=advance(this.y,this.target,Math.max(0,e.at-this.at),this.m);this.at=e.at;this.target=e.target;}
  this.y=advance(this.y,this.target,t-this.at,this.m);this.at=t;return this.y;}
 command(t,u,old){if(u===old)return;const at=Math.max(t+(u>old?this.m.delay_up:this.m.delay_down),this.last+1e-6);this.last=at;this.queue.push({at,target:target(u,this.m)});}
}
module.exports={Plant,target,advance};
