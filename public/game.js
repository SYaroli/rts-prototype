'use strict';
const $=id=>document.getElementById(id), canvas=$('field'),ctx=canvas.getContext('2d');
const BUILD='02 · TARGETING + COLLISION';
const NX=64,NZ=48, terrain=[],keys=new Set();let W=0,H=0,scale=18,zoom=1,pan={x:0,y:0},units=[],effects=[],selected=new Set(),mode='prep',paused=false,time=0,kills=0,baseHP=1600,spawnIndex=0,spawnClock=0,layout='choke',snapshot=null,idNext=0,pointer=null,mouse={x:-100,y:-100},toastUntil=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function height(x,z){if(x<0||z<0||x>=NX||z>=NZ)return 10;if(x>=33&&x<37&&(z<21||z>=27&&z<38))return 7+Math.sin(z*.7)*.35;if(x>=20&&x<30&&z>=10&&z<25)return z<20?3:(25-z)*.6;return 0;}
for(let z=0;z<NZ;z++)for(let x=0;x<NX;x++)terrain.push({x,z,h:height(x+.5,z+.5),shade:((x*37+z*71+x*z*13)%19)-9});
const hAt=(x,z)=>height(Math.floor(x)+.5,Math.floor(z)+.5);
const walk=(x,z)=>x>=1&&x<NX-1&&z>=1&&z<NZ-1&&hAt(x,z)<6;
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
function pathfind(a,b,avoidUnits=false){let sx=clamp(Math.floor(a.x),1,NX-2),sz=clamp(Math.floor(a.z),1,NZ-2),tx=clamp(Math.floor(b.x),1,NX-2),tz=clamp(Math.floor(b.z),1,NZ-2);const pass=(x,z)=>canStand(x+.5,z+.5,a.type?radius(a):0)&&(!avoidUnits||!units.some(v=>v!==a&&v.hp>0&&Math.hypot(v.x-x-.5,v.z-z-.5)<radius(a)+radius(v)));if(!pass(tx,tz))return[];const start=sz*NX+sx,goal=tz*NX+tx,open=[start],prev=new Int32Array(NX*NZ).fill(-1),g=new Float64Array(NX*NZ).fill(Infinity),closed=new Uint8Array(NX*NZ);g[start]=0;let count=0;while(open.length&&count++<NX*NZ){let bi=0;for(let i=1;i<open.length;i++){let n=open[i],v=open[bi];if(g[n]+Math.hypot(n%NX-tx,Math.floor(n/NX)-tz)<g[v]+Math.hypot(v%NX-tx,Math.floor(v/NX)-tz))bi=i;}let n=open.splice(bi,1)[0];if(n===goal){let p=[];while(n!==start){p.push({x:n%NX+.5,z:Math.floor(n/NX)+.5});n=prev[n];}return p.reverse();}if(closed[n])continue;closed[n]=1;let x=n%NX,z=Math.floor(n/NX);for(let [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let xx=x+dx,zz=z+dz;if(!pass(xx,zz)||Math.abs(hAt(xx,zz)-hAt(x,z))>.81)continue;if(dx&&dz&&(!pass(x+dx,z)||!pass(x,z+dz)||Math.abs(hAt(x+dx,z)-hAt(x,z))>.81||Math.abs(hAt(x,z+dz)-hAt(x,z))>.81))continue;let m=zz*NX+xx,ng=g[n]+Math.hypot(dx,dz);if(!closed[m]&&ng<g[m]){g[m]=ng;prev[m]=n;open.push(m);}}}return[];}
function lineOfSight(a,b,arc=false){let d=distance(a,b),ha=hAt(a.x,a.z)+.7,hb=hAt(b.x,b.z)+.7;for(let i=1;i<Math.ceil(d*3);i++){let t=i/Math.ceil(d*3),h=ha+(hb-ha)*t+(arc?Math.sin(t*Math.PI)*4:0);if(hAt(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)>h+.1)return false;}return true;}
function makeUnit(x,z,type,team=0){const max=type==='tank'?380:type==='crawler'?290:team?95:150;const r=type==='infantry'?.45:.72;
if(!canStand(x,z,r)){x=Math.floor(x)+.5;z=Math.floor(z)+.5;}
return{id:idNext++,x,z,type,team,hp:max,max,path:[],cool:0,angle:0,sieged:false,deploy:0,route:[],repath:0,manualTarget:null,blocked:0,chaseClock:0};}
function notify(t){$('toast').textContent=t;$('toast').style.opacity=1;toastUntil=performance.now()+2800;}
function reset(keep=false){units=[];effects=[];time=0;kills=0;baseHP=1600;spawnIndex=0;spawnClock=0;mode='prep';paused=false;selected.clear();$('result').hidden=true;if(keep&&snapshot){for(let s of snapshot){let u=makeUnit(s.x,s.z,s.type);u.sieged=s.sieged;units.push(u);}}else{const presets={open:[[43,24],[43,27],[46,21],[46,24],[46,27],[46,30]],choke:[[27,24],[28,27],[30,22],[30,24],[30,26],[30,29]],ridge:[[26,17],[28,19],[30,22],[31,24],[29,27],[26,33]]};presets[layout].forEach((p,i)=>units.push(makeUnit(p[0],p[1],i<2?'tank':'infantry')));snapshot=null;}units.filter(u=>u.type==='tank').forEach(u=>selected.add(u.id));updateUI();}
function launch(){if(mode!=='prep')return;snapshot=units.filter(u=>!u.team).map(({x,z,type,sieged})=>({x,z,type,sieged}));mode='fight';spawnClock=1;notify('Foundry force inbound. Hold until all 22 units are destroyed.');updateUI();}
function toggleSiege(){let n=0;for(let u of units)if(selected.has(u.id)&&u.type==='tank'&&!u.deploy){u.deploy=2;u.nextSiege=!u.sieged;u.path=[];n++;}if(!n)notify('Select a Bastion tank first.');else notify('Guns '+(units.find(u=>u.deploy)?.nextSiege?'deploying':'packing')+' · 2 seconds');}
function command(p){
  if(mode==='ended')return;
  if(!walk(p.x,p.z)){notify('Cliff face. Choose traversable terrain or the ridge ramp.');return;}
  const group=units.filter(u=>selected.has(u.id));
  const movable=group.filter(u=>!u.sieged&&!u.deploy);
  if(!group.length)return;
  group.forEach(u=>u.manualTarget=null);
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
  for(const u of group){u.manualTarget=t.id;u.path=[];u.chaseClock=0;u.blocked=0;}
  const waiting=group.some(u=>u.sieged&&!validShot(u,t));
  notify(waiting?'Target marked. Siege guns hold until it enters a clear firing position.':'Target marked. Manual order overrides armor priority.');
}
function rightCommand(p){const t=enemyAtScreen(p);if(t)attackCommand(t);else command(unproject(p.x,p.y));}
function manualEnemy(u){
  const t=units.find(v=>v.id===u.manualTarget&&v.hp>0&&v.team!==u.team);
  if(!t||!spotted(t)){if(u.manualTarget!==null)u.path=[];u.manualTarget=null;return null;}
  return t;
}
function acquireTarget(u){
  const manual=manualEnemy(u);
  if(manual)return validShot(u,manual)?manual:null;
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
function spotted(u){return !u.team||units.some(a=>!a.team&&a.hp>0&&distance(a,u)<(a.type==='infantry'?12:10)+(hAt(a.x,a.z)>=2?2:0)&&lineOfSight(a,u));}
function validShot(a,b){let d=distance(a,b);return d<=range(a)&&(!(a.type==='tank'&&a.sieged)||d>=4)&&lineOfSight(a,b,a.sieged)&&(!b.team||spotted(b));}
function fire(u,t){u.angle=Math.atan2(t.z-u.z,t.x-u.x);u.cool=u.type==='tank'?(u.sieged?3.5:1.25):u.type==='crawler'?1.3:.65;const damage=u.type==='tank'?(u.sieged?102:31):u.type==='crawler'?23:11;if(u.sieged){effects.push({kind:'shell',x:u.x,z:u.z,tx:t.x,tz:t.z,life:.65,max:.65,team:u.team,damage});}else{effects.push({kind:'shot',x:u.x,z:u.z,tx:t.x,tz:t.z,life:.13,max:.13,team:u.team});t.hp-=damage;}}
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
      for(const t of units)if(t.team!==e.team&&distance(t,{x:e.tx,z:e.tz})<2.4)t.hp-=e.damage*(1-distance(t,{x:e.tx,z:e.tz})/3.2);
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
function label(x,z,text,color='#d9bda2'){let p=project(x,z);ctx.font=`${Math.max(10,12*zoom)}px Arial`;ctx.textAlign='center';ctx.fillStyle='#1b1715bb';ctx.fillRect(p.x-ctx.measureText(text).width/2-7,p.y-12,ctx.measureText(text).width+14,18);ctx.fillStyle=color;ctx.fillText(text,p.x,p.y);}
function render(){ctx.fillStyle='#2c231e';ctx.fillRect(0,0,W,H);for(let t of terrain){const{x,z,h,shade}=t,p=[project(x,z,h),project(x+1,z,h),project(x+1,z+1,h),project(x,z+1,h)];if(p[2].x<-50||p[0].x>W+70||p[2].y<-50||p[0].y>H+100)continue;let c=h>6?[85,61,47]:h>0?[133,94,64]:[115,72,49];let road=(z>21&&z<27||z>39&&z<44)&&h===0;if(road)c=[127,85,59];polygon(p,`rgb(${c[0]+shade},${c[1]+shade},${c[2]+shade})`);let zh=z<NZ-1?hAt(x,z+1):0,xh=x<NX-1?hAt(x+1,z):0;if(h>zh)polygon([p[3],p[2],project(x+1,z+1,zh),project(x,z+1,zh)],'#553c2d');if(h>xh)polygon([p[1],p[2],project(x+1,z+1,xh),project(x+1,z,xh)],'#715039');}
// Functional world geometry: outpost, barricades and the ridge access ramp.
box(9,25,3,3,1.8,{top:'#939184',side:'#5b6664',dark:'#394b4f'});box(9,25,1.6,2,1,{top:'#b4ad98',side:'#76807a',dark:'#435958'},1.8);box(6.5,24,1,1.6,2.3,{top:'#a5997d',side:'#5b6664',dark:'#394b4f'});line(project(9,25,2.8),project(9,25,5),'#c7b99f',2);ctx.fillStyle='#81e6e3';let beacon=project(9,25,5);ctx.fillRect(beacon.x-2,beacon.y-2,4,4);
for(let u of units)if(selected.has(u.id)){const marked=units.find(v=>v.id===u.manualTarget&&v.hp>0&&spotted(v));if(marked){ring(marked.x,marked.z,1.05,'#ff866a',true);line(project(u.x,u.z),project(marked.x,marked.z),'#ff866a55');}ring(u.x,u.z,range(u),'#83dadd55');if(u.sieged)ring(u.x,u.z,4,'#edc08499',true);if(u.path.length){ctx.setLineDash([3,5]);let pp=project(u.x,u.z);for(let t of u.path){let np=project(t.x,t.z);line(pp,np,'#a7dedb66');pp=np;}ctx.setLineDash([]);}}
units.slice().sort((a,b)=>project(a.x,a.z).y-project(b.x,b.z).y).forEach(u=>{if(!u.team||spotted(u))drawUnit(u);});for(let e of effects){if(e.kind==='shot'){line(project(e.x,e.z,hAt(e.x,e.z)+.7),project(e.tx,e.tz,hAt(e.tx,e.tz)+.6),e.team?'#ff9e60':'#ddf9cf',1.6);}else if(e.kind==='shell'){let t=1-e.life/e.max,x=e.x+(e.tx-e.x)*t,z=e.z+(e.tz-e.z)*t,p=project(x,z,hAt(e.x,e.z)*(1-t)+hAt(e.tx,e.tz)*t+Math.sin(t*Math.PI)*7+.8);ctx.fillStyle='#ffdf99';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}else if(e.kind==='blast'){let p=project(e.x,e.z),r=(1-e.life/e.max)*scale*zoom*2.5;ctx.globalAlpha=e.life/e.max;ctx.fillStyle='#f4bd77';ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.65,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}else ring(e.x,e.z,(1-e.life)*1.5+.2,'#9effe0');}
label(9,29,'MINING OUTPOST','#acd9d6');label(24,12,'RIDGE +3 m');label(25,26.5,'RAMP');label(36,25,'CANYON PASS');label(39,42,'SOUTHERN FLANK');label(56,18,'FOUNDRY APPROACH','#f4a574');if(pointer&&pointer.button===0&&Math.hypot(mouse.x-pointer.x,mouse.y-pointer.y)>5){ctx.fillStyle='#8ee9ed18';ctx.strokeStyle='#a6edef';ctx.fillRect(pointer.x,pointer.y,mouse.x-pointer.x,mouse.y-pointer.y);ctx.strokeRect(pointer.x,pointer.y,mouse.x-pointer.x,mouse.y-pointer.y);}}
function updateUI(){let group=units.filter(u=>selected.has(u.id)),tanks=group.filter(u=>u.type==='tank');$('phase').textContent=mode==='prep'?'DEPLOYMENT':mode==='ended'?'COMPLETE':paused?'PAUSED':'CONTACT';$('clock').textContent=String(Math.floor(time/60)).padStart(2,'0')+':'+String(Math.floor(time%60)).padStart(2,'0');$('base').textContent=Math.max(0,Math.ceil(baseHP/16))+'%';$('kills').textContent=kills+' / 22';$('losses').textContent=(6-units.filter(u=>!u.team).length)+' / 6';$('selection').textContent=group.length===0?'No units selected':group.length===tanks.length?`${tanks.length} Bastion siege tank${tanks.length>1?'s':''}`:`${group.length} units · ${tanks.length} tanks / ${group.length-tanks.length} squads`;$('detail').textContent=group.length?`${tanks.filter(u=>u.sieged).length} deployed · ${group.filter(u=>hAt(u.x,u.z)>=2).length} on high ground · ${Math.ceil(group.reduce((s,u)=>s+u.hp,0))} HP · ${group.filter(u=>u.manualTarget!==null).length} manual targets`:'Left-click a unit or drag a selection box';$('siege').disabled=!tanks.length||mode==='ended';$('start').disabled=mode!=='prep';$('pause').textContent=paused?'Resume':'Pause';$('flank').disabled=mode!=='prep';document.querySelectorAll('[data-layout]').forEach(b=>{b.disabled=mode!=='prep';b.classList.toggle('active',b.dataset.layout===layout);});}
function resize(){let rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;let dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.max(7,Math.min(W/77,H/40));}window.addEventListener('resize',resize);
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.focus();let r=canvas.getBoundingClientRect();mouse={x:e.clientX-r.left,y:e.clientY-r.top};pointer={...mouse,button:e.button,shift:e.shiftKey,type:e.pointerType};canvas.setPointerCapture(e.pointerId);if(e.button===2)rightCommand(mouse);});canvas.addEventListener('pointermove',e=>{let r=canvas.getBoundingClientRect(),m={x:e.clientX-r.left,y:e.clientY-r.top};if(pointer?.button===1){pan.x+=m.x-mouse.x;pan.y+=m.y-mouse.y;}mouse=m;});canvas.addEventListener('pointerup',e=>{if(pointer?.button===0){let drag=Math.hypot(mouse.x-pointer.x,mouse.y-pointer.y)>6,hits=[];for(let u of units.filter(u=>!u.team)){let p=project(u.x,u.z);if(drag?p.x>=Math.min(mouse.x,pointer.x)&&p.x<=Math.max(mouse.x,pointer.x)&&p.y>=Math.min(mouse.y,pointer.y)&&p.y<=Math.max(mouse.y,pointer.y):Math.hypot(p.x-mouse.x,p.y-8*zoom-mouse.y)<18*zoom)hits.push(u);}if(!drag)hits=hits.sort((a,b)=>{let pa=project(a.x,a.z),pb=project(b.x,b.z);return Math.hypot(pa.x-mouse.x,pa.y-mouse.y)-Math.hypot(pb.x-mouse.x,pb.y-mouse.y);}).slice(0,1);if(pointer.type==='touch'&&!hits.length&&selected.size)rightCommand(mouse);else{if(!pointer.shift)selected.clear();hits.forEach(u=>selected.add(u.id));}}pointer=null;updateUI();});canvas.addEventListener('pointerleave',()=>{if(!pointer)mouse={x:-100,y:-100};});canvas.addEventListener('pointercancel',()=>pointer=null);canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.9:1.1),.6,2.5);},{passive:false});
$('siege').onclick=toggleSiege;$('all').onclick=()=>{selected=new Set(units.filter(u=>!u.team).map(u=>u.id));updateUI();};$('stop').onclick=()=>units.filter(u=>selected.has(u.id)).forEach(u=>{u.path=[];u.manualTarget=null;});$('start').onclick=launch;$('pause').onclick=()=>{paused=!paused;updateUI();};$('reset').onclick=()=>reset(true);$('retryResult').onclick=()=>reset(true);$('zoomIn').onclick=()=>zoom=clamp(zoom*1.2,.6,2.5);$('zoomOut').onclick=()=>zoom=clamp(zoom/1.2,.6,2.5);$('home').onclick=()=>{zoom=1;pan={x:0,y:0};};$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{layout=b.dataset.layout;reset();});
window.addEventListener('keydown',e=>{if($('helpDialog').open||document.activeElement.tagName==='INPUT')return;let k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(e.repeat)return;if(k==='e')toggleSiege();if(k==='a'&&!e.shiftKey)$('all').click();if(k==='s'&&!e.shiftKey)$('stop').click();if(k===' ')$('pause').click();if(k==='enter')launch();if(k==='escape')selected.clear();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();mouse={x:-100,y:-100};pointer=null;if(mode==='fight'){paused=true;updateUI();}});
let last=performance.now(),uiClock=0;function frame(now){let dt=Math.min((now-last)/1000,.05);last=now;let speed=400*dt;if(!$('helpDialog').open){if(keys.has('arrowleft')||keys.has('a')&&keys.has('shift')||mouse.x>=0&&mouse.x<14)pan.x+=speed;if(keys.has('arrowright')||keys.has('d')||mouse.x>W-14&&mouse.x<=W)pan.x-=speed;if(keys.has('arrowup')||keys.has('w')||mouse.y>=0&&mouse.y<12)pan.y+=speed;if(keys.has('arrowdown')||keys.has('s')&&keys.has('shift')||mouse.y>H-12&&mouse.y<=H)pan.y-=speed;pan.x=clamp(pan.x,-W*.8,W*.8);pan.y=clamp(pan.y,-H*.8,H*.8);step(dt);}if(now>toastUntil)$('toast').style.opacity=0;render();uiClock+=dt;if(uiClock>.15){updateUI();uiClock=0;}requestAnimationFrame(frame);}resize();reset();requestAnimationFrame(frame);
