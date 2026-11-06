'use strict';
const $=id=>document.getElementById(id), canvas=$('field'),ctx=canvas.getContext('2d');
const BUILD='07 · TERRAIN REWORK';
const RESPONSE_LEASH=2;
const OUTPOST={x:10,z:25,sight:12};
const NX=64,NZ=48, terrain=[],keys=new Set();let W=0,H=0,scale=18,zoom=1,pan={x:0,y:0},units=[],effects=[],selected=new Set(),mode='prep',paused=false,time=0,kills=0,baseHP=1600,spawnIndex=0,spawnClock=0,layout='choke',snapshot=null,idNext=0,pointer=null,mouse={x:-100,y:-100},toastUntil=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function height(x,z){if(x<0||z<0||x>=NX||z>=NZ)return 10;if(x>=33&&x<36&&(z<19||z>=29&&z<38))return 4.2+Math.sin(z*.7)*.3;if(x>=20&&x<30&&z>=10&&z<25)return z<20?2.7:(25-z)*.54;return 0;}
for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++)terrain.push({x,z,h:height(x+.5,z+.5),shade:((x*37+z*71+x*z*13)%19)-9});
const hAt=(x,z)=>height(Math.floor(x)+.5,Math.floor(z)+.5);
function terrainType(x,z){
  const h=height(x,z);
  const bridge=x>=44&&x<54&&z>=22&&z<27;
  if(bridge)return 'industrial';
  if(x>=44&&x<54&&z>=16&&z<35)return 'water';
  if(Math.hypot(x-31,z-40)<7.3)return 'crater';
  if(x>=12&&x<44&&z>=18&&z<34&&h<6)return 'industrial';
  if(x>=53&&x<63&&z>=7&&z<18&&h<6)return 'terra';
  if(h>=6)return 'cliff';
  if(h>=2)return 'high';
  return 'dust';
}
const walk=(x,z)=>x>=1&&x<NX-1&&z>=1&&z<NZ-1&&hAt(x,z)<6&&terrainType(x,z)!=='water';
// Footprints constrain both terrain clearance and unit-to-unit movement.
function radius(u){return u.type==='infantry'?.45:.72;}
function canStand(x,z,r){
  if(!walk(x,z))return false;
  const h=hAt(x,z);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;
    if(!walk(xx,zz)||Math.abs(hAt(xx,zz)-h)>.81)return false;
  }
  return true;
}
function fits(u,x,z){
  if(!canStand(x,z,radius(u)))return false;
  if(u.reacting&&u.responseAnchor&&distance({x,z},u.responseAnchor)>RESPONSE_LEASH)return false;
  return !units.some(v=>v!==u&&v.hp>0&&Math.hypot(v.x-x,v.z-z)<radius(u)+radius(v)-.001);
}
function clearMove(u,x,z){
  const n=Math.max(1,Math.ceil(Math.hypot(x-u.x,z-u.z)/.12));
  let h=hAt(u.x,u.z);
  for(let i=1;i<=n;i++){
    const xx=u.x+(x-u.x)*i/n,zz=u.z+(z-u.z)*i/n,next=hAt(xx,zz);
    if(Math.abs(next-h)>.81||!fits(u,xx,zz))return false;
    h=next;
  }
  return true;
}
function project(x,z,y=hAt(x,z)){let q=scale*zoom;return{x:W*.5+pan.x+(x-32-(z-24)*.46)*q,y:H*.54+pan.y+((z-24)*.65+(x-32)*.10-y*.73)*q};}
function unproject(px,py){let q=scale*zoom,bx=(px-W*.5-pan.x)/q,by=(py-H*.54-pan.y)/q;let z=(by-.10*bx)/.696+24,x=bx+.46*(z-24)+32;let best={x,z},bestD=1e9;for(let yy=0;yy<=8;yy+=.3){let zz=(by+yy*.73-.10*bx)/.696+24,xx=bx+.46*(zz-24)+32;if(Math.abs(hAt(xx,zz)-yy)<.4){let p=project(xx,zz),d=Math.abs(p.y-py);if(d<bestD){bestD=d;best={x:xx,z:zz};}}}return best;}
function pathfind(a,b,avoidUnits=false){let sx=clamp(Math.floor(a.x),1,NX-2),sz=clamp(Math.floor(a.z),1,NZ-2),tx=clamp(Math.floor(b.x),1,NX-2),tz=clamp(Math.floor(b.z),1,NZ-2);const pass=(x,z)=>(!a.reacting||!a.responseAnchor||distance({x:x+.5,z:z+.5},a.responseAnchor)<=RESPONSE_LEASH)&&canStand(x+.5,z+.5,a.type?radius(a):0)&&(!avoidUnits||!units.some(v=>v!==a&&v.hp>0&&Math.hypot(v.x-x-.5,v.z-z-.5)<radius(a)+radius(v)));if(!pass(tx,tz))return[];const start=sz*NX+sx,goal=tz*NX+tx,open=[start],prev=new Int32Array(NX*NZ).fill(-1),g=new Float64Array(NX*NZ).fill(Infinity),closed=new Uint8Array(NX*NZ);g[start]=0;let count=0;while(open.length&&count++<NX*NZ){let bi=0;for(let i=1;i<open.length;i++){let n=open[i],v=open[bi];if(g[n]+Math.hypot(n%NX-tx,Math.floor(n/NX)-tz)<g[v]+Math.hypot(v%NX-tx,Math.floor(v/NX)-tz))bi=i;}let n=open.splice(bi,1)[0];if(n===goal){let p=[];while(n!==start){p.push({x:n%NX+.5,z:Math.floor(n/NX)+.5});n=prev[n];}return p.reverse();}if(closed[n])continue;closed[n]=1;let x=n%NX,z=Math.floor(n/NX);for(let [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let xx=x+dx,zz=z+dz;if(!pass(xx,zz)||Math.abs(hAt(xx,zz)-hAt(x,z))>.81)continue;if(dx&&dz&&(!pass(x+dx,z)||!pass(x,z+dz)||Math.abs(hAt(x+dx,z)-hAt(x,z))>.81||Math.abs(hAt(x,z+dz)-hAt(x,z))>.81))continue;let m=zz*NX+xx,ng=g[n]+Math.hypot(dx,dz);if(!closed[m]&&ng<g[m]){g[m]=ng;prev[m]=n;open.push(m);}}}return[];}
function lineOfSight(a,b,arc=false){let d=distance(a,b),ha=hAt(a.x,a.z)+.7,hb=hAt(b.x,b.z)+.7;for(let i=1;i<Math.ceil(d*3);i++){let t=i/Math.ceil(d*3),h=ha+(hb-ha)*t+(arc?Math.sin(t*Math.PI)*4:0);if(hAt(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)>h+.1)return false;}return true;}
function makeUnit(x,z,type,team=0){const max=type==='tank'?380:type==='crawler'?290:team?95:150;const r=type==='infantry'?.45:.72;
if(!canStand(x,z,r)){x=Math.floor(x)+.5;z=Math.floor(z)+.5;}
return{id:idNext++,x,z,type,team,hp:max,max,path:[],cool:0,angle:0,sieged:false,deploy:0,route:[],repath:0,manualTarget:null,blocked:0,chaseClock:0,hold:false,reacting:false,responseAnchor:null,attackerId:null,underFireUntil:0,responseClock:0};}
function notify(t){$('toast').textContent=t;$('toast').style.opacity=1;toastUntil=performance.now()+2800;}
function reset(keep=false){units=[];effects=[];time=0;kills=0;baseHP=1600;spawnIndex=0;spawnClock=0;mode='prep';paused=false;selected.clear();$('result').hidden=true;if(keep&&snapshot){for(let s of snapshot){let u=makeUnit(s.x,s.z,s.type);u.sieged=s.sieged;u.hold=!!s.hold;units.push(u);}}else{const presets={open:[[43,24],[43,27],[46,21],[46,24],[46,27],[46,30]],choke:[[27,24],[28,27],[30,22],[30,24],[30,26],[30,29]],ridge:[[26,17],[28,19],[30,22],[31,24],[29,27],[26,33]]};presets[layout].forEach((p,i)=>units.push(makeUnit(p[0],p[1],i<2?'tank':'infantry')));snapshot=null;}units.filter(u=>u.type==='tank').forEach(u=>selected.add(u.id));updateUI();}
function launch(){if(mode!=='prep')return;snapshot=units.filter(u=>!u.team).map(({x,z,type,sieged,hold})=>({x,z,type,sieged,hold}));mode='fight';spawnClock=1;notify('Foundry force inbound. Hold until all 22 units are destroyed.');updateUI();}
function toggleSiege(){let n=0;for(let u of units)if(selected.has(u.id)&&u.type==='tank'&&!u.deploy){u.deploy=2;u.nextSiege=!u.sieged;u.path=[];n++;}if(!n)notify('Select a Bastion tank first.');else notify('Guns '+(units.find(u=>u.deploy)?.nextSiege?'deploying':'packing')+' · 2 seconds');}
function command(p){
  if(mode==='ended')return;
  if(!walk(p.x,p.z)){notify('Cliff face. Choose traversable terrain or the ridge ramp.');return;}
  const group=units.filter(u=>selected.has(u.id));
  const movable=group.filter(u=>!u.sieged&&!u.deploy);
  if(!group.length)return;
  group.forEach(u=>{u.manualTarget=null;clearResponse(u,true);u.hold=false;});
  if(movable.length<group.length)notify('Deployed tanks cannot move. Press E to pack them.');
  movable.forEach((u,i)=>{
    const dest={x:p.x+(i%3-(Math.min(3,movable.length)-1)/2)*1.8,z:p.z+Math.floor(i/3)*1.8};
    u.path=pathfind(u,dest);u.blocked=0;
  });
  effects.push({kind:'order',x:p.x,z:p.z,life:1,max:1});
}
function enemyAtScreen(p){
  return units.filter(u=>u.team&&u.hp>0&&spotted(u)).map(u=>{
    const pp=project(u.x,u.z);return {u,d:Math.hypot(pp.x-p.x,pp.y-8*zoom-p.y)};
  }).filter(v=>v.d<Math.max(13,18*zoom)).sort((a,b)=>a.d-b.d)[0]?.u;
}
function attackCommand(t){
  if(mode!=='fight'||!t||!spotted(t))return;
  const group=units.filter(u=>selected.has(u.id)&&!u.team);
  if(!group.length)return;
  for(const u of group){clearResponse(u,true);u.hold=false;u.manualTarget=t.id;u.path=[];u.chaseClock=0;u.blocked=0;}
  const waiting=group.some(u=>u.sieged&&!validShot(u,t));
  notify(waiting?'Target marked. Siege guns hold until it enters a clear firing position.':'Target marked. Manual order overrides armor priority.');
}
function rightCommand(p){const t=enemyAtScreen(p);if(t)attackCommand(t);else command(unproject(p.x,p.y));}
function manualEnemy(u){
  const t=units.find(v=>v.id===u.manualTarget&&v.hp>0&&v.team!==u.team);
  if(!t||!spotted(t)){if(u.manualTarget!==null)u.path=[];u.manualTarget=null;return null;}
  return t;
}
function clearResponse(u,resetAnchor=false){
  if(u.reacting)u.path=[];
  u.reacting=false;u.attackerId=null;u.underFireUntil=0;u.responseClock=0;
  if(resetAnchor)u.responseAnchor=null;
}
function takeDamage(t,damage,attacker){
  t.hp-=damage;
  // Only idle friendly infantry may interrupt their stance to return fire.
  if(t.hp>0&&attacker&&attacker.team!==t.team&&!t.team&&t.type==='infantry'&&!t.hold&&t.manualTarget===null&&(!t.path.length||t.reacting)){
    if(!t.responseAnchor)t.responseAnchor={x:t.x,z:t.z};
    t.attackerId=attacker.id;t.underFireUntil=time+5;
  }
}
function respondToFire(u,dt){
  if(u.team||u.type!=='infantry'||u.hold||u.manualTarget!==null)return;
  const a=units.find(v=>v.id===u.attackerId&&v.hp>0&&v.team!==u.team);
  if(!a||time>u.underFireUntil||!spotted(a)){
    if(u.reacting)clearResponse(u);
    return;
  }
  if(u.path.length&&!u.reacting)return;
  u.reacting=true;
  if(validShot(u,a)){u.path=[];return;}
  u.responseClock-=dt;
  if(u.responseClock>0)return;
  u.responseClock=.5;
  const anchor=u.responseAnchor,candidates=[];
  for(let z=Math.floor(anchor.z-RESPONSE_LEASH);z<=Math.ceil(anchor.z+RESPONSE_LEASH);z++)
    for(let x=Math.floor(anchor.x-RESPONSE_LEASH);x<=Math.ceil(anchor.x+RESPONSE_LEASH);x++){
      const p={x:x+.5,z:z+.5};
      if(distance(p,anchor)<=RESPONSE_LEASH&&fits(u,p.x,p.z)&&validShot({...u,...p},a))candidates.push(p);
    }
  candidates.sort((a,b)=>distance(u,a)-distance(u,b));
  u.path=[];
  for(const p of candidates){const route=pathfind(u,p);if(route.length){u.path=route;break;}}
}
function toggleHold(){
  const group=units.filter(u=>selected.has(u.id)&&!u.team&&u.type==='infantry');
  if(!group.length)return;
  const hold=!group.every(u=>u.hold);
  group.forEach(u=>{clearResponse(u,true);u.path=[];u.manualTarget=null;u.hold=hold;});
  notify(hold?'Infantry holding position. They will fire but will not advance.':'Infantry may advance up to 2 map units when hit.');
  updateUI();
}
function acquireTarget(u){
  const manual=manualEnemy(u);
  if(manual)return validShot(u,manual)?manual:null;
  const attacker=units.find(t=>t.id===u.attackerId&&t.hp>0);
  if(u.reacting&&attacker&&validShot(u,attacker))return attacker;
  const candidates=units.filter(t=>t.team!==u.team&&t.hp>0&&validShot(u,t));
  candidates.sort((a,b)=>{
    if(u.type==='tank'){
      const armor=t=>t.type==='crawler'||t.type==='tank'?1:0;
      if(armor(a)!==armor(b))return armor(b)-armor(a);
    }
    return distance(u,a)-distance(u,b)||a.id-b.id;
  });
  return candidates[0]||null;
}
function moveUnit(u,dt){
  if(!u.path.length||u.sieged||u.deploy)return;
  let p=u.path[0],d=distance(u,p);
  if(d<.16){u.path.shift();if(!u.path.length)return;p=u.path[0];d=distance(u,p);}
  const angle=Math.atan2(p.z-u.z,p.x-u.x),speed=Math.min(d,(u.type==='infantry'?2.8:1.8)*dt);
  // Steer around a body when there is space; otherwise wait without pushing it.
  const sign=u.id%2?1:-1;
  let moved=false;
  for(const offset of [0,.45*sign,-.45*sign,.9*sign,-.9*sign,1.35*sign,-1.35*sign]){
    const a=angle+offset,x=u.x+Math.cos(a)*speed,z=u.z+Math.sin(a)*speed;
    if(clearMove(u,x,z)){u.x=x;u.z=z;u.angle=a;moved=true;break;}
  }
  u.blocked=moved&&distance(u,p)<d-.015?0:u.blocked+dt;
  if(u.blocked>1){
    const dest=u.path[u.path.length-1],alternate=pathfind(u,dest,true);
    if(alternate.length)u.path=alternate;
    u.blocked=0;
  }
}
function range(u){return(u.type==='tank'?(u.sieged?16:6):u.type==='crawler'?6:5.5)+(hAt(u.x,u.z)>=2?2:0);}
function spotted(u){return !u.team||(baseHP>0&&distance(OUTPOST,u)<=OUTPOST.sight&&lineOfSight(OUTPOST,u))||units.some(a=>!a.team&&a.hp>0&&distance(a,u)<(a.type==='infantry'?12:10)+(hAt(a.x,a.z)>=2?2:0)&&lineOfSight(a,u));}
function validShot(a,b){let d=distance(a,b);return d<=range(a)&&(!(a.type==='tank'&&a.sieged)||d>=4)&&lineOfSight(a,b,a.sieged)&&(!b.team||spotted(b));}
function fire(u,t){u.angle=Math.atan2(t.z-u.z,t.x-u.x);u.cool=u.type==='tank'?(u.sieged?3.5:1.25):u.type==='crawler'?1.3:.65;const damage=u.type==='tank'?(u.sieged?102:31):u.type==='crawler'?23:11;if(u.sieged){effects.push({kind:'shell',x:u.x,z:u.z,tx:t.x,tz:t.z,life:.65,max:.65,team:u.team,damage,attackerId:u.id});}else{effects.push({kind:'shot',x:u.x,z:u.z,tx:t.x,tz:t.z,life:.13,max:.13,team:u.team});takeDamage(t,damage,u);}}
function step(dt){
  if(paused||mode==='ended')return;
  if(mode==='fight'){
    time+=dt;spawnClock-=dt;
    if(spawnClock<=0&&spawnIndex<22){
      const i=spawnIndex,flank=$('flank').checked&&i%3===0;
      const u=makeUnit(59+(i%2),22+(i%5)*1.3,i%6===3?'crawler':'infantry',1);
      if(fits(u,u.x,u.z)){
        spawnIndex++;
        u.route=flank?[{x:43,z:41+(i%3)},{x:29,z:42},{x:13,z:32},{x:10,z:25}]:[{x:40,z:23+(i%3)},{x:31.5,z:23+(i%3)},{x:10,z:25}];
        units.push(u);spawnClock=1.25;
      }else spawnClock=.25;
    }
  }
  for(const e of effects){
    e.life-=dt;
    if(e.kind==='shell'&&e.life<=0&&!e.hit){
      e.hit=true;
      for(const t of units)if(t.team!==e.team&&distance(t,{x:e.tx,z:e.tz})<2.4)takeDamage(t,e.damage*(1-distance(t,{x:e.tx,z:e.tz})/3.2),units.find(u=>u.id===e.attackerId));
      effects.push({kind:'blast',x:e.tx,z:e.tz,life:.6,max:.6});
    }
  }
  effects=effects.filter(e=>e.life>0);
  for(const u of units){
    if(u.hp<=0)continue;
    u.cool-=dt;
    if(u.deploy){u.deploy=Math.max(0,u.deploy-dt);if(!u.deploy)u.sieged=u.nextSiege;continue;}
    let target=null;
    if(mode==='fight'){
      respondToFire(u,dt);
      target=acquireTarget(u);
      if(target&&u.cool<=0)fire(u,target);
      const manual=manualEnemy(u);
      if(manual&&!u.sieged){
        u.chaseClock-=dt;
        if(target)u.path=[];
        else if(u.chaseClock<=0){u.path=pathfind(u,manual);u.chaseClock=.8;}
      }
    }
    if(u.team&&mode==='fight'&&!target){
      u.repath-=dt;
      let dest=u.route[0];
      if(u.route.length===1&&distance(u,{x:10,z:25})<4.7){u.route=[];u.path=[];dest=null;}
      if(dest&&distance(u,dest)<Math.max(1.3,radius(u)+1)){u.route.shift();u.path=[];dest=u.route[0];}
      if(dest&&!u.path.length&&u.repath<=0){u.path=pathfind(u,dest);u.repath=1;}
      if(!dest&&distance(u,{x:10,z:25})<5&&u.cool<=0){
        baseHP-=u.type==='crawler'?38:16;u.cool=1;
        effects.push({kind:'shot',x:u.x,z:u.z,tx:10,tz:25,life:.15,max:.15,team:1});
      }
    }
    if(!(u.team&&target))moveUnit(u,dt);
  }
  for(const u of units)if(u.hp<=0){
    if(u.team)kills++;selected.delete(u.id);
    effects.push({kind:'blast',x:u.x,z:u.z,life:.5,max:.5});
  }
  units=units.filter(u=>u.hp>0);
  if(mode==='fight'&&(baseHP<=0||kills===22)){
    mode='ended';$('result').hidden=false;
    $('resultTitle').textContent=baseHP>0?'The line held.':'Outpost lost.';
    $('resultText').textContent=`${kills} of 22 attackers destroyed · ${6-units.filter(u=>!u.team).length} friendly units lost · outpost ${Math.max(0,Math.ceil(baseHP/16))}% intact · ${Math.floor(time)} seconds.`;
  }
}
function polygon(points,color,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.5;ctx.stroke();}}
function line(a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function ring(x,z,r,color,dashed=false){ctx.beginPath();for(let i=0;i<=90;i++){let a=i/90*Math.PI*2,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,p=project(xx,zz,hAt(x,z)+.09);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.setLineDash(dashed?[5,5]:[]);ctx.stroke();ctx.setLineDash([]);}
function box(x,z,w,d,h,color,y=hAt(x,z)){let a=project(x-w/2,z-d/2,y),b=project(x+w/2,z-d/2,y),c=project(x+w/2,z+d/2,y),e=project(x-w/2,z+d/2,y),aa=project(x-w/2,z-d/2,y+h),bb=project(x+w/2,z-d/2,y+h),cc=project(x+w/2,z+d/2,y+h),ee=project(x-w/2,z+d/2,y+h);polygon([b,c,cc,bb],color.side);polygon([c,e,ee,cc],color.dark);polygon([aa,bb,cc,ee],color.top,'#0005');}
function drawUnit(u){let q=scale*zoom,p=project(u.x,u.z),team=u.team?'#f99564':'#8bdddf',sel=selected.has(u.id);if(sel)ring(u.x,u.z,u.type==='tank'?1.1:.85,'#8cedef');if(u.type==='tank'||u.type==='crawler'){const colors=u.team?{top:'#8c7463',side:'#493c37',dark:'#332d2a'}:{top:'#99a8a2',side:'#526563',dark:'#344547'};box(u.x-.61,u.z,.28,1.65,.25,{top:'#303a39',side:'#182326',dark:'#172125'});box(u.x+.61,u.z,.28,1.65,.25,{top:'#303a39',side:'#182326',dark:'#172125'});box(u.x,u.z,1.1,1.4,.5,colors);box(u.x,u.z,.7,.65,.3,colors,hAt(u.x,u.z)+.5);let a=project(u.x,u.z,hAt(u.x,u.z)+.85),b=project(u.x+Math.cos(u.angle)*(u.sieged?1.8:1.15),u.z+Math.sin(u.angle)*(u.sieged?1.8:1.15),hAt(u.x,u.z)+.85);line(a,b,'#283739',6*zoom);line(a,b,'#bdc5b7',3*zoom);if(u.sieged)for(let [dx,dz]of [[-1,-.8],[1,-.8],[-1,.8],[1,.8]])line(project(u.x+dx*.4,u.z+dz*.4,.35+hAt(u.x,u.z)),project(u.x+dx,u.z+dz),team,2);line(project(u.x-.3,u.z+.45,.54+hAt(u.x,u.z)),project(u.x+.3,u.z+.45,.54+hAt(u.x,u.z)),team,3);}else{for(let [dx,dz]of [[-.32,-.28],[.32,-.25],[0,.34]]){let pp=project(u.x+dx,u.z+dz),head=project(u.x+dx,u.z+dz,hAt(u.x,u.z)+.65);line(pp,head,u.team?'#493c36':'#354e52',5*zoom);ctx.fillStyle=team;ctx.beginPath();ctx.arc(head.x,head.y,2.5*zoom,0,Math.PI*2);ctx.fill();line({x:head.x,y:head.y+3*zoom},{x:head.x+5*zoom,y:head.y+2*zoom},'#c9c9b5',1.5*zoom);}}
if(sel||u.hp<u.max){ctx.fillStyle='#102024';ctx.fillRect(p.x-13*zoom,p.y-24*zoom,26*zoom,3);ctx.fillStyle=team;ctx.fillRect(p.x-13*zoom,p.y-24*zoom,26*zoom*u.hp/u.max,3);}if(u.deploy){ctx.fillStyle='#f6c17e';ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText((u.nextSiege?'DEPLOY ':'PACK ')+u.deploy.toFixed(1),p.x,p.y-29*zoom);}}
function label(x,z,text,color='#d9bda2'){let p=project(x,z);ctx.font=`${Math.max(10,12*zoom)}px Arial`;ctx.textAlign='center';ctx.fillStyle='#1b1715cc';ctx.fillRect(p.x-ctx.measureText(text).width/2-7,p.y-12,ctx.measureText(text).width+14,18);ctx.fillStyle=color;ctx.fillText(text,p.x,p.y);}
function crystal(x,z,h=2.3){
  const y=hAt(x,z),base=project(x,z,y),tip=project(x-.08,z-.04,y+h);
  const l=project(x-.35,z+.18,y+.12),r=project(x+.32,z-.16,y+.12),m=project(x+.06,z+.05,y+h*.62);
  ctx.save();ctx.shadowColor='#b66cff';ctx.shadowBlur=14*zoom;
  polygon([l,r,tip],'#7c5798','#e5c8ffcc');polygon([l,m,tip],'#b58ad0aa');ctx.restore();
  ctx.fillStyle='#e5c8ff';ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(base.x,base.y,7*zoom,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
}
const seeded=(x,z,n=0)=>{let v=Math.sin(x*12.9898+z*78.233+n*37.719)*43758.5453;return v-Math.floor(v);};
function terrainDetail(x,z,h,kind,p){
  const cx=(p[0].x+p[2].x)/2,cy=(p[0].y+p[2].y)/2,q=zoom;
  if(kind==='dust'||kind==='high'||kind==='crater'){
    const n=seeded(x,z);
    if(n>.28){ctx.fillStyle=kind==='high'?'#5d392c88':'#3f271f77';ctx.beginPath();ctx.ellipse(cx+(n-.5)*10*q,cy+(seeded(x,z,1)-.5)*5*q,(1.1+n*1.6)*q,(.6+n)*q,-.2,0,Math.PI*2);ctx.fill();}
    if(seeded(x,z,2)>.74){line({x:p[0].x+4*q,y:p[0].y+2*q},{x:p[2].x-5*q,y:p[2].y-2*q},'#e0926440',.8);}
  }
  if(kind==='industrial'){
    line({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},{x:(p[3].x+p[2].x)/2,y:(p[3].y+p[2].y)/2},'#161b1c44',1);
    line({x:(p[0].x+p[3].x)/2,y:(p[0].y+p[3].y)/2},{x:(p[1].x+p[2].x)/2,y:(p[1].y+p[2].y)/2},'#c9aa7740',.8);
    if((x+2*z)%11===0){for(let i=0;i<3;i++){let a=i/3;line({x:p[0].x+(p[1].x-p[0].x)*(.1+a*.17),y:p[0].y+(p[1].y-p[0].y)*(.1+a*.17)},{x:p[3].x+(p[2].x-p[3].x)*(.1+a*.17),y:p[3].y+(p[2].y-p[3].y)*(.1+a*.17)},'#d39a3e99',1.2);}}
  }
  if(kind==='water'){
    const wob=Math.sin(time*1.7+x*.8+z*.35)*2*q;
    line({x:p[0].x+3*q,y:p[0].y+4*q+wob},{x:p[2].x-5*q,y:p[2].y-3*q+wob},'#a4e0df55',1);
    if((x+z)%3===0)line({x:p[3].x+2*q,y:p[3].y-1*q},{x:p[1].x-2*q,y:p[1].y+1*q},'#1f666d99',1.2);
  }
  if(kind==='terra'){
    for(let i=0;i<2;i++){let rx=(seeded(x,z,i+6)-.5)*12*q,ry=(seeded(x,z,i+8)-.5)*6*q;ctx.fillStyle=i?'#6f7e3f99':'#8c8c4d77';ctx.beginPath();ctx.ellipse(cx+rx,cy+ry,(2+seeded(x,z,i+10)*3)*q,(1+seeded(x,z,i+12)*2)*q,.2,0,Math.PI*2);ctx.fill();}
  }
}
function pipeRun(x,z,len=5){
  const y=hAt(x,z)+.55;for(const off of [-.28,.28]){let a=project(x-len/2,z+off,y),b=project(x+len/2,z+off,y);line(a,b,'#6b4a35',7*zoom);line(a,b,'#c37f46',3*zoom);}
  for(let i=-2;i<=2;i++){let a=project(x+i*len/5,z-.55,hAt(x,z)),b=project(x+i*len/5,z+.55,hAt(x,z));line(a,b,'#d6a252',2*zoom);}
}
function storageTank(x,z){
  const y=hAt(x,z);box(x,z,2.1,2.1,2.6,{top:'#8d8271',side:'#585b57',dark:'#393f3e'},y);
  let p=project(x,z,y+2.75);ctx.strokeStyle='#d0a34a';ctx.lineWidth=2*zoom;ctx.beginPath();ctx.ellipse(p.x,p.y,13*zoom,5*zoom,0,0,Math.PI*2);ctx.stroke();
  line(project(x+.85,z,y+2.6),project(x+.85,z,y+3.7),'#d0a34a',2*zoom);
}
function antenna(x,z){
  const y=hAt(x,z);box(x,z,1.4,1.4,1,{top:'#77766c',side:'#4b5855',dark:'#35413f'},y);
  line(project(x,z,y+1),project(x,z,y+4),'#c4b79e',2*zoom);let p=project(x,z,y+4);ctx.fillStyle='#ef6d5c';ctx.beginPath();ctx.arc(p.x,p.y,2.5*zoom,0,Math.PI*2);ctx.fill();
}
function barrier(x,z){box(x,z,2.4,.55,.55,{top:'#9a8e78',side:'#66594d',dark:'#463b34'});let a=project(x-1,z-.29,hAt(x,z)+.58),b=project(x+1,z-.29,hAt(x,z)+.58);line(a,b,'#e0a53f',2*zoom);}

function surfaceRect(x1,z1,x2,z2,color,y=0,stroke=null){
  polygon([project(x1,z1,y),project(x2,z1,y),project(x2,z2,y),project(x1,z2,y)],color,stroke);
}
function mapPoly(cx,cz,r,y,color){
  const pts=[];for(let i=0;i<64;i++){const a=i/64*Math.PI*2;pts.push(project(cx+Math.cos(a)*r,cz+Math.sin(a)*r,y));}polygon(pts,color);
}
function rock(x,z,s=.45){
  const y=hAt(x,z),p=project(x,z,y),p1=project(x-s,z+.15*s,y),p2=project(x+.15*s,z-s,y),p3=project(x+s,z+.2*s,y),top=project(x,z,y+s*.65);
  polygon([p1,p2,top],'#9a5c3d');polygon([p2,p3,top],'#6a4030');polygon([p3,p1,top],'#7c4935');
}
function render(){
  ctx.fillStyle='#1e1714';ctx.fillRect(0,0,W,H);
  // One continuous Martian ground plane. The simulation remains tile based underneath.
  surfaceRect(0,0,NX,NZ,'#7c432f');
  surfaceRect(12,18,44,34,'#5c5952');
  surfaceRect(44,16,54,35,'#245e67');
  surfaceRect(53,7,63,18,'#58633b');
  mapPoly(31,40,7.4,0,'#623526');
  mapPoly(31,40,5.7,.03,'#70402d');
  mapPoly(31,40,3.8,.05,'#512b23');

  // Broad surface texture instead of a visible checkerboard.
  for(let i=0;i<150;i++){
    const x=1+seeded(i,17)*62,z=1+seeded(i,31)*46,k=terrainType(x,z);
    if(k==='water'||k==='industrial'||k==='terra')continue;
    const p=project(x,z),r=(.45+seeded(i,53)*1.2)*zoom;
    ctx.fillStyle=seeded(i,71)>.5?'#a55d3a55':'#43281f66';
    ctx.beginPath();ctx.ellipse(p.x,p.y,r*2.1,r,seeded(i,11)*.8,0,Math.PI*2);ctx.fill();
  }
  // Industrial slab seams, faded lane paint and scars.
  for(let x=14;x<44;x+=4){line(project(x,18,.03),project(x,34,.03),'#252a2b99',1);if(x%8===2)line(project(x+.5,21,.05),project(x+.5,31,.05),'#d49a4266',2*zoom);}
  for(let z=20;z<34;z+=4)line(project(12,z,.03),project(44,z,.03),'#aaa08a28',1);
  for(let i=0;i<18;i++){const x=14+seeded(i,91)*28,z=19+seeded(i,92)*14,p=project(x,z,.05);ctx.fillStyle='#171b1c55';ctx.beginPath();ctx.ellipse(p.x,p.y,(3+seeded(i,93)*8)*zoom,(1+seeded(i,94)*3)*zoom,.2,0,Math.PI*2);ctx.fill();}

  // Reservoir motion and hard concrete banks.
  for(let z=17;z<35;z+=1.6){const a=project(44.3,z,.05),b=project(53.7,z,.05),w=Math.sin(time*1.8+z)*2*zoom;line({x:a.x,y:a.y+w},{x:b.x,y:b.y+w},'#8fd2d35d',1);}
  line(project(44,16,.05),project(54,16,.05),'#9d9788',3*zoom);line(project(44,35,.05),project(54,35,.05),'#4c4a45',3*zoom);

  // Terraform pocket: sparse, ugly and valuable rather than lush Earth grass.
  for(let i=0;i<45;i++){const x=53.4+seeded(i,121)*9.2,z=7.5+seeded(i,122)*9.5,p=project(x,z,.05);ctx.fillStyle=seeded(i,123)>.55?'#81904e88':'#394b2f99';ctx.beginPath();ctx.ellipse(p.x,p.y,(1+seeded(i,124)*3)*zoom,(.6+seeded(i,125)*1.8)*zoom,.3,0,Math.PI*2);ctx.fill();}

  // Elevated terrain only: keep height geometry, ditch the tiled floor look.
  for(let t of terrain){const{x,z,h}=t;if(h<=.05)continue;const p=[project(x,z,h),project(x+1,z,h),project(x+1,z+1,h),project(x,z+1,h)];let top=h>3.5?'#714a36':'#9a6c48';polygon(p,top);let zh=z<NZ-1?hAt(x,z+1):0,xh=x<NX-1?hAt(x+1,z):0;if(h>zh+.15)polygon([p[3],p[2],project(x+1,z+1,zh),project(x,z+1,zh)],'#4b3026');if(h>xh+.15)polygon([p[1],p[2],project(x+1,z+1,xh),project(x+1,z,xh)],'#5a3929');}
  // Roughen cliff faces with vertical mineral bands.
  for(let z of [4,8,12,16,31,35]){let a=project(33.2,z,4),b=project(33.2,z+2,0);line(a,b,'#c47a4a44',2*zoom);}
  for(let i=0;i<34;i++){const x=2+seeded(i,201)*58,z=2+seeded(i,202)*42;if(terrainType(x,z)==='dust')rock(x,z,.25+seeded(i,203)*.5);}

  // Functional landmarks, now drawn as believable infrastructure clusters.
  for(const r of [3.4,5.3,7.1])ring(31,40,r,'#3f211d55',r===5.3);
  box(49,24.5,10,4.4,.4,{top:'#69655e',side:'#403c38',dark:'#292725'});
  for(let x=45;x<54;x+=1.5){line(project(x,22.25,.5),project(x,22.25,1.15),'#d7a34b',1.5*zoom);line(project(x,26.8,.5),project(x,26.8,1.15),'#d7a34b',1.5*zoom);}
  storageTank(48.1,17.6);storageTank(51.1,18.2);storageTank(48.2,32.4);storageTank(51.2,31.9);
  pipeRun(19,31,6.5);pipeRun(37,20,5.5);pipeRun(39,31,4.8);
  for(const p of [[17,22],[22,20],[34,31],[39,22],[15,30]])barrier(p[0],p[1]);
  antenna(7,22);antenna(42,18);
  box(26,23,6.5,3.2,.22,{top:'#777067',side:'#443e39',dark:'#2f2926'});
  for(let i=0;i<7;i++)line(project(23+i*.95,21.7,.3),project(23+i*.95,22.25,.3),'#d69e44',2*zoom);

  // Aetherite is the only deliberately unnatural color on the map.
  ctx.save();ctx.globalCompositeOperation='screen';ring(58,13,4.4,'#9b68c477');ctx.restore();
  for(const c of [[56.3,10.7,2.5],[58,11.4,3.1],[59.5,9.8,2.2],[60.3,13.2,2.7],[57,14.4,1.9],[61.1,11.5,1.7]])crystal(c[0],c[1],c[2]);

  // Terran Accord outpost.
  box(9,25,3.8,3.4,1.35,{top:'#77796f',side:'#485653',dark:'#2f3d3e'});box(9,25,2.2,2.2,1.05,{top:'#a49d89',side:'#65716d',dark:'#405354'},1.35);
  box(7.1,24.2,1.1,1.6,2.1,{top:'#8d856e',side:'#58625e',dark:'#374847'});box(11,26.2,1.4,1.1,.85,{top:'#726d61',side:'#4c5451',dark:'#333e3d'});
  line(project(9,25,2.4),project(9,25,5.1),'#d1c2a2',2*zoom);line(project(8.7,25,3.8),project(9.3,25,3.8),'#d59d48',2*zoom);
  ctx.fillStyle='#81e6e3';let beacon=project(9,25,5.1);ctx.shadowColor='#81e6e3';ctx.shadowBlur=8*zoom;ctx.fillRect(beacon.x-2,beacon.y-2,4,4);ctx.shadowBlur=0;

  // Selection, units, combat effects.
  for(let u of units)if(selected.has(u.id)){const marked=units.find(v=>v.id===u.manualTarget&&v.hp>0&&spotted(v));if(marked){ring(marked.x,marked.z,1.05,'#ff866a',true);line(project(u.x,u.z),project(marked.x,marked.z),'#ff866a55');}ring(u.x,u.z,range(u),'#83dadd55');if(u.sieged)ring(u.x,u.z,4,'#edc08499',true);if(u.path.length){ctx.setLineDash([3,5]);let pp=project(u.x,u.z);for(let t of u.path){let np=project(t.x,t.z);line(pp,np,'#a7dedb66');pp=np;}ctx.setLineDash([]);}}
  units.slice().sort((a,b)=>project(a.x,a.z).y-project(b.x,b.z).y).forEach(u=>{if(!u.team||spotted(u))drawUnit(u);});
  for(let e of effects){if(e.kind==='shot'){line(project(e.x,e.z,hAt(e.x,e.z)+.7),project(e.tx,e.tz,hAt(e.tx,e.tz)+.6),e.team?'#ff9e60':'#ddf9cf',1.6);}else if(e.kind==='shell'){let t=1-e.life/e.max,x=e.x+(e.tx-e.x)*t,z=e.z+(e.tz-e.z)*t,p=project(x,z,hAt(e.x,e.z)*(1-t)+hAt(e.tx,e.tz)*t+Math.sin(t*Math.PI)*7+.8);ctx.fillStyle='#ffdf99';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}else if(e.kind==='blast'){let p=project(e.x,e.z),r=(1-e.life/e.max)*scale*zoom*2.5;ctx.globalAlpha=e.life/e.max;ctx.fillStyle='#f4bd77';ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.65,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}else ring(e.x,e.z,(1-e.life)*1.5+.2,'#9effe0');}
  label(9,29,'ACCORD BASE','#acd9d6');label(24,12,'CANYON HIGH GROUND');label(25,26.5,'RIDGE RAMP');label(31,30,'INDUSTRIAL MIDLINE');label(49,29,'RESERVOIR CHOKE','#9bcfd0');label(31,44,'CRATER FLANK');label(58,8.5,'AETHERITE ZONE','#d2a8e5');label(57,21,'FOUNDRY APPROACH','#f4a574');
  if(pointer&&pointer.button===0&&Math.hypot(mouse.x-pointer.x,mouse.y-pointer.y)>5){ctx.fillStyle='#8ee9ed18';ctx.strokeStyle='#a6edef';ctx.fillRect(pointer.x,pointer.y,mouse.x-pointer.x,mouse.y-pointer.y);ctx.strokeRect(pointer.x,pointer.y,mouse.x-pointer.x,mouse.y-pointer.y);}
}
function updateUI(){let group=units.filter(u=>selected.has(u.id)),tanks=group.filter(u=>u.type==='tank');$('phase').textContent=mode==='prep'?'DEPLOYMENT':mode==='ended'?'COMPLETE':paused?'PAUSED':'CONTACT';$('clock').textContent=String(Math.floor(time/60)).padStart(2,'0')+':'+String(Math.floor(time%60)).padStart(2,'0');$('base').textContent=Math.max(0,Math.ceil(baseHP/16))+'%';$('kills').textContent=kills+' / 22';$('losses').textContent=(6-units.filter(u=>!u.team).length)+' / 6';$('selection').textContent=group.length===0?'No units selected':group.length===tanks.length?`${tanks.length} Bastion siege tank${tanks.length>1?'s':''}`:`${group.length} units · ${tanks.length} tanks / ${group.length-tanks.length} squads`;$('detail').textContent=group.length?`${tanks.filter(u=>u.sieged).length} deployed · ${group.filter(u=>hAt(u.x,u.z)>=2).length} on high ground · ${Math.ceil(group.reduce((s,u)=>s+u.hp,0))} HP · ${group.filter(u=>u.manualTarget!==null).length} manual targets`:'Left-click a unit or drag a selection box';const squads=group.filter(u=>u.type==='infantry');$('hold').disabled=!squads.length||mode==='ended';$('hold').textContent=squads.length&&squads.every(u=>u.hold)?'Release hold [H]':'Hold position [H]';$('siege').disabled=!tanks.length||mode==='ended';$('start').disabled=mode!=='prep';$('pause').textContent=paused?'Resume':'Pause';$('flank').disabled=mode!=='prep';document.querySelectorAll('[data-layout]').forEach(b=>{b.disabled=mode!=='prep';b.classList.toggle('active',b.dataset.layout===layout);});}
function resize(){let rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;let dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.max(7,Math.min(W/77,H/40));}window.addEventListener('resize',resize);
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.focus();let r=canvas.getBoundingClientRect();mouse={x:e.clientX-r.left,y:e.clientY-r.top};pointer={...mouse,button:e.button,shift:e.shiftKey,type:e.pointerType};canvas.setPointerCapture(e.pointerId);if(e.button===2)rightCommand(mouse);});canvas.addEventListener('pointermove',e=>{let r=canvas.getBoundingClientRect(),m={x:e.clientX-r.left,y:e.clientY-r.top};if(pointer?.button===1){pan.x+=m.x-mouse.x;pan.y+=m.y-mouse.y;}mouse=m;});canvas.addEventListener('pointerup',e=>{if(pointer?.button===0){let drag=Math.hypot(mouse.x-pointer.x,mouse.y-pointer.y)>6,hits=[];for(let u of units.filter(u=>!u.team)){let p=project(u.x,u.z);if(drag?p.x>=Math.min(mouse.x,pointer.x)&&p.x<=Math.max(mouse.x,pointer.x)&&p.y>=Math.min(mouse.y,pointer.y)&&p.y<=Math.max(mouse.y,pointer.y):Math.hypot(p.x-mouse.x,p.y-8*zoom-mouse.y)<18*zoom)hits.push(u);}if(!drag)hits=hits.sort((a,b)=>{let pa=project(a.x,a.z),pb=project(b.x,b.z);return Math.hypot(pa.x-mouse.x,pa.y-mouse.y)-Math.hypot(pb.x-mouse.x,pb.y-mouse.y);}).slice(0,1);if(pointer.type==='touch'&&!hits.length&&selected.size)rightCommand(mouse);else{if(!pointer.shift)selected.clear();hits.forEach(u=>selected.add(u.id));}}pointer=null;updateUI();});canvas.addEventListener('pointerleave',()=>{if(!pointer)mouse={x:-100,y:-100};});canvas.addEventListener('pointercancel',()=>pointer=null);canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.9:1.1),.6,2.5);},{passive:false});
$('hold').onclick=toggleHold;$('siege').onclick=toggleSiege;$('all').onclick=()=>{selected=new Set(units.filter(u=>!u.team).map(u=>u.id));updateUI();};$('stop').onclick=()=>units.filter(u=>selected.has(u.id)).forEach(u=>{u.path=[];u.manualTarget=null;clearResponse(u,true);});$('start').onclick=launch;$('pause').onclick=()=>{paused=!paused;updateUI();};$('reset').onclick=()=>reset(true);$('retryResult').onclick=()=>reset(true);$('zoomIn').onclick=()=>zoom=clamp(zoom*1.2,.6,2.5);$('zoomOut').onclick=()=>zoom=clamp(zoom/1.2,.6,2.5);$('home').onclick=()=>{zoom=1;pan={x:0,y:0};};$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.layout;reset();});
window.addEventListener('keydown',e=>{if($('helpDialog').open||document.activeElement.tagName==='INPUT')return;let k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='e')toggleSiege();if(k==='h')toggleHold();if(k==='a'&&!e.shiftKey)$('all').click();if(k==='s'&&!e.shiftKey)$('stop').click();if(k===' ')$('pause').click();if(k==='enter')launch();if(k==='escape')selected.clear();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();mouse={x:-100,y:-100};pointer=null;if(mode==='fight'){paused=true;updateUI();}});
let last=performance.now(),uiClock=0;function frame(now){let dt=Math.min((now-last)/1000,.05);last=now;let speed=400*dt;if(!$('helpDialog').open){if(keys.has('arrowleft')||keys.has('a')&&keys.has('shift')||mouse.x>=0&&mouse.x<14)pan.x+=speed;if(keys.has('arrowright')||keys.has('d')||mouse.x>W-14&&mouse.x<=W)pan.x-=speed;if(keys.has('arrowup')||keys.has('w')||mouse.y>=0&&mouse.y<12)pan.y+=speed;if(keys.has('arrowdown')||keys.has('s')&&keys.has('shift')||mouse.y>H-12&&mouse.y<=H)pan.y-=speed;pan.x=clamp(pan.x,-W*.8,W*.8);pan.y=clamp(pan.y,-H*.8,H*.8);step(dt);}if(now>toastUntil)$('toast').style.opacity=0;render();uiClock+=dt;if(uiClock>.15){updateUI();uiClock=0;}requestAnimationFrame(frame);}resize();reset();requestAnimationFrame(frame);
