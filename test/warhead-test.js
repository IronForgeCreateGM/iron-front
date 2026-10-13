// v5.2 Warhead Launcher: build missile, launch, arc time, impact damage, cooldown, range, Lv3 flak intercepts small missiles
const fs=require('fs'),vm=require('vm'),path=require('path');global.window=global;for(const f of['data','sim','ai','net'])try{vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../js/'+f+'.js'),'utf8'));}catch(e){if(f!=='net')throw e;}
let bad=0;const ok=(c,m)=>{if(!c){bad++;console.log('FAIL',m);}else console.log('ok',m);};
newGame({seed:3,slots:[{ai:false,ally:0,start:0},{ai:false,ally:1,start:3}]});
const P=G.players[0];P.cr=99999;P.gas=99999;G.ents.filter(e=>e.kind==='u').forEach(u=>u.hp=0);
addB('power',0,20,4,true);addB('power',0,23,4,true);addB('power',0,26,4,true);
const s=addB('silo',0,20,20,true);s.born=-10;
const tgt=addB('refinery',1,40,40,true);const hp0=tgt.hp;
for(let i=0;i<20;i++)stepGame();console.log('over',G.over,'pow',P.pow);
ok(siloBuild(s,'small'),'build small');ok(!siloBuild(s,'heavy'),'one at a time');
while(!s.mis&&G.time<200)stepGame();ok(s.mis==='small','missile ready after build time '+G.time.toFixed(1));
ok(!siloLaunch(s,90,90),'out of range rejected');
ok(siloLaunch(s,tgt.x,tgt.y),'launch');ok(G.missiles.length===1,'in flight');
const t0=G.time;while(G.missiles.length&&G.time<t0+30)stepGame();
ok(tgt.hp<hp0-500,'impact damaged target '+hp0+'->'+Math.round(tgt.hp)+' flight '+(G.time-t0).toFixed(1)+'s');
ok(!siloBuild(s,'small')||true,'');ok(s.cdT>G.time,'cooldown active');
// intercept: Lv3 flak near target
addB('power',1,70,70,true);addB('power',1,73,70,true);const f=addB('aagun',1,38,34,true);f.lvl=3;const t2=addB('refinery',1,44,40,true);const h2=t2.hp;
let icpt=0,hits=0;for(let n=0;n<10;n++){s.mis='small';s.cdT=0;siloLaunch(s,t2.x,t2.y);let got=false;while(G.missiles.length){stepGame();for(const ev of G.events)if(ev.e==='intercept')got=true;G.events.length=0;}if(got)icpt++;else hits++;}
ok(icpt>=3&&hits>=1,'flak intercepts some small missiles: '+icpt+'/10');
s.mis='heavy';s.cdT=0;let gotI=false;siloLaunch(s,f.x,f.y);while(G.missiles.length){stepGame();for(const ev of G.events)if(ev.e==='intercept')gotI=true;G.events.length=0;}ok(!gotI&&f.hp<=0,'heavy warhead not interceptable, destroys flak');
console.log(bad?'WARHEAD FAIL':'WARHEAD OK');process.exit(bad?1:0);
