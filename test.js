// headless sim test: node test.js
const g=require('./game.js');g.init();
// give player a minimal economy so AI has a target
for(let t=0;t<20000&&!g.over;t++){g.step();if(t===10)g.addB('refinery',0,9,9);}
const c=t=>g.ents.filter(e=>e.team===t).map(e=>e.t).join(',');
console.log('over:',g.over,'credits',g.players.map(p=>p.cr));console.log('P0:',c(0));console.log('AI:',c(1));
