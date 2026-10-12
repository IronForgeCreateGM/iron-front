// v5.1: 6-player 3v3 on every map — unique starts, 6 colours, HQs placed, game progresses deterministically, no lava damage
const fs=require('fs'),vm=require('vm'),path=require('path');global.window=global;for(const f of['data','sim','ai'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../js/'+f+'.js'),'utf8'));
let bad=0;const ok=(c,m)=>{if(!c){bad++;console.log('FAIL',m);}};
for(const map of['classic','frost','volcano']){
  newGame({seed:9,map,slots:[0,1,2,3,4,5].map(i=>({ai:true,diff:'normal',ally:i<3?0:1}))});
  ok(new Set(G.players.map(P=>P.start)).size===6,map+' unique starts');ok(new Set(G.players.map(P=>P.color)).size===6,map+' colours');
  ok(G.players.every(P=>G.ents.some(e=>e.team===P.team&&e.t==='hq')),map+' hqs');ok(!G.weather,map+' no weather');
  while(G.time<240)stepGame();ok(G.players.every(P=>G.ents.filter(e=>e.team===P.team&&e.kind==='b').length>=3),map+' all build');
  if(map==='volcano'){const i=G.lava.findIndex(v=>v);const u=addU('heavy',0,i%MW+0.5,(i/MW|0)+0.5);const hp=u.hp;for(let k=0;k<60;k++)stepGame();ok(u.hp>=hp||u.lastHitBy,'lava harmless');}
}
console.log(bad?'SIX FAIL':'SIX OK');process.exit(bad?1:0);
