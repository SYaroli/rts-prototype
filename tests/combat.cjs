// Headless mechanics checks: no browser or rendering required.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const elements={};const el=id=>elements[id]??={textContent:'',style:{},classList:{toggle(){}},addEventListener(){},getBoundingClientRect(){return{width:1400,height:680,left:0,top:0}},getContext(){return{setTransform(){}}},checked:false,open:false};
const sandbox={console,assert,performance:{now:()=>0},document:{getElementById:el,querySelectorAll:()=>[],activeElement:{tagName:'CANVAS'}},window:{addEventListener(){}},devicePixelRatio:1,requestAnimationFrame(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8'),sandbox);
vm.runInContext(`
function empty(){units=[];effects=[];selected.clear();mode='prep';paused=false;spawnIndex=22;baseHP=1600;kills=0;}
empty();
let tank=makeUnit(43,24,'tank'),foot=makeUnit(46,24,'infantry',1),armor=makeUnit(49,24,'crawler',1);
units=[tank,foot,armor];assert.equal(acquireTarget(tank),armor,'Armor beats nearer infantry');
armor.x=53;assert.equal(acquireTarget(tank),foot,'Unreachable armor must not suppress available shots');
armor.x=49;tank.manualTarget=foot.id;assert.equal(acquireTarget(tank),foot,'Manual order overrides armor priority');
foot.hp=0;assert.equal(acquireTarget(tank),armor,'Dead manual target restores automatic acquisition');
foot.hp=95;tank.sieged=true;tank.manualTarget=foot.id;assert.equal(acquireTarget(tank),null,'Manual target inside minimum range must not be shot');
foot.x=62;assert.equal(acquireTarget(tank),armor,'Unseen manual target releases order');
mode='fight';selected.add(tank.id);const pp=project(armor.x,armor.z);rightCommand({x:pp.x,y:pp.y-8*zoom});assert.equal(tank.manualTarget,armor.id,'Right-click hit testing issues attack order');
empty();tank=makeUnit(43,24,'tank');foot=makeUnit(52,24,'infantry',1);units=[tank,foot];mode='fight';selected.add(tank.id);attackCommand(foot);for(let i=0;i<30;i++)step(.05);assert(tank.x>43,'Mobile tank approaches manual target');
empty();tank=makeUnit(43,24,'tank');tank.sieged=true;foot=makeUnit(45,24,'infantry',1);units=[tank,foot];mode='fight';selected.add(tank.id);attackCommand(foot);for(let i=0;i<20;i++)step(.05);assert.equal(tank.x,43,'Siege tank holds position for invalid target');
empty();let blocker=makeUnit(44,24,'tank'),mover=makeUnit(41,24,'tank');blocker.sieged=true;units=[blocker,mover];assert(!clearMove(mover,47,24),'Swept collision prevents tunneling');mover.path=pathfind(mover,{x:49,z:24});for(let i=0;i<300;i++){moveUnit(mover,.05);assert(distance(mover,blocker)>=radius(mover)+radius(blocker)-.002,'Bodies never overlap');}assert(mover.x>47,'Open-ground avoidance gets past stationary tank');assert.equal(blocker.x,44,'Stationary tank is not pushed');
empty();tank=makeUnit(27,24,'tank');units=[tank];tank.path=pathfind(tank,{x:26,z:17});assert(tank.path.length,'Tank ramp route exists');for(let i=0;i<250;i++)moveUnit(tank,.05);assert(hAt(tank.x,tank.z)>=2,'Tank reaches ridge via ramp');assert(!clearMove(tank,40,17),'Cliff blocks swept movement');
// Outpost sight survives the loss of all mobile defenders, but not the building.
empty();baseHP=1600;let raider=makeUnit(13,25,'crawler',1);units=[raider];
assert(spotted(raider),'Outpost reveals nearby attacker with no surviving defenders');
raider.x=23;assert(!spotted(raider),'Outpost sight has a bounded radius');
OUTPOST.x=29;OUTPOST.z=15;raider.x=40;raider.z=15;assert(distance(OUTPOST,raider)<OUTPOST.sight);assert(!spotted(raider),'Cliff blocks building sight');OUTPOST.x=10;OUTPOST.z=25;
raider.x=13;raider.z=25;baseHP=0;assert(!spotted(raider),'Destroyed outpost supplies no sight');
units.push(makeUnit(15,25,'infantry'));assert(spotted(raider),'Surviving squad retains its own sight');
// Friendly infantry only advance in response to actual damage, with unchanged ranges.
empty();let squad=makeUnit(43,24,'infantry'),gun=makeUnit(49,24,'crawler',1);units=[squad,gun];mode='fight';time=0;
assert.equal(range(squad),5.5);assert.equal(range(gun),6);
respondToFire(squad,.05);assert.equal(squad.path.length,0,'Mere enemy proximity does not trigger pursuit');
fire(gun,squad);const health=gun.hp;
for(let i=0;i<30;i++)step(.05);
assert(squad.x>43,'Infantry close the half-unit range gap after taking fire');assert(gun.hp<health,'Infantry return fire after closing');
assert(distance(squad,squad.responseAnchor)<=RESPONSE_LEASH,'Response stays inside leash');
let stopPosition={x:squad.x,z:squad.z};respondToFire(squad,.05);assert.equal(squad.path.length,0,'Stop advancing once in weapon range');
// Retreating attackers and repeated hits cannot drag the squad away from its original position.
const origin={...squad.responseAnchor};gun.hp=10000;squad.hp=10000;
for(let i=0;i<100;i++){gun.x+=.025;takeDamage(squad,1,gun);respondToFire(squad,.05);moveUnit(squad,.05);time+=.05;assert(distance(squad,origin)<=RESPONSE_LEASH+.001);}
assert.deepEqual(squad.responseAnchor,origin,'Repeated hits never reset the response origin');
clearResponse(squad,true);squad.path=[];selected=new Set([squad.id]);toggleHold();let fixed={x:squad.x,z:squad.z};takeDamage(squad,1,gun);respondToFire(squad,.05);moveUnit(squad,.05);assert.equal(squad.x,fixed.x);assert.equal(squad.z,fixed.z);assert.equal(squad.attackerId,null,'Hold blocks automatic response');
gun.x=squad.x+4;assert.equal(acquireTarget(squad),gun,'Held infantry still return fire in range');toggleHold();
// Explicit orders, tanks, dead attackers and loss of sight do not cause unwanted advances.
squad.path=[{x:42,z:24}];takeDamage(squad,1,gun);assert.equal(squad.attackerId,null,'Movement orders are not interrupted');squad.path=[];
squad.manualTarget=gun.id;takeDamage(squad,1,gun);assert.equal(squad.attackerId,null,'Manual attack orders take priority');squad.manualTarget=null;
let friendlyTank=makeUnit(41,24,'tank');takeDamage(friendlyTank,1,gun);assert.equal(friendlyTank.attackerId,null,'Tanks retain existing behavior');
gun.x=squad.x+6;takeDamage(squad,1,gun);respondToFire(squad,.05);gun.hp=0;respondToFire(squad,.05);assert.equal(squad.reacting,false);assert.equal(squad.path.length,0,'Dead attacker cancels response');
gun.hp=290;takeDamage(squad,1,gun);respondToFire(squad,.05);gun.x=61;respondToFire(squad,.05);assert.equal(squad.reacting,false,'Unseen attacker cancels response');
function noOverlap(){for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)assert(distance(units[i],units[j])>=radius(units[i])+radius(units[j])-.002,'Scenario units overlap');}
for(const name of ['open','choke','ridge'])for(const flank of [false,true]){
 layout=name;reset();$('flank').checked=flank;noOverlap();toggleSiege();for(let i=0;i<41;i++)step(.05);assert(units[0].sieged);launch();
 for(let i=0;i<8000&&mode!=='ended';i++){step(.05);noOverlap();}
 console.log(name,flank?'flank':'front',{mode,time:Math.round(time),kills,base:Math.max(0,Math.ceil(baseHP/16)),remaining:units.filter(u=>!u.team).length});
 assert.equal(mode,'ended','Battle should finish without a traffic deadlock');
}
console.log('All targeting, collision, ramp and scenario checks passed.');
`,sandbox);
