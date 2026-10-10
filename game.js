// Iron Front v1 - original RTS. See NOTES.md
'use strict';
const T=24,MW=64,MH=64;
const BT={ // building types
 hq:{n:'Command Yard',w:3,h:3,hp:1500,cost:0,pow:20,c:'#888'},
 power:{n:'Power Plant',w:2,h:2,hp:500,cost:300,pow:100,c:'#cc4'},
 refinery:{n:'Refinery',w:3,h:2,hp:800,cost:1000,pow:-30,c:'#4a4'},
 barracks:{n:'Barracks',w:2,h:2,hp:600,cost:400,pow:-20,c:'#a64'},
 factory:{n:'War Factory',w:3,h:3,hp:1000,cost:1200,pow:-40,c:'#668',req:'refinery'}};
const UT={
 rifle:{n:'Rifleman',hp:60,sp:1.1,rng:4,dmg:8,cd:40,cost:100,from:'barracks',sight:6,r:5},
 tank:{n:'Light Tank',hp:300,sp:1.4,rng:5,dmg:30,cd:60,cost:700,from:'factory',sight:7,r:9},
 harv:{n:'Harvester',hp:500,sp:1.0,rng:0,dmg:0,cd:0,cost:1000,from:'factory',sight:4,r:10}};
const COL=['#39f','#e33'];
let map,ore,ents,nid,players,cam,sel,place,tick,over,fog,vis,buildQ;
const cv=typeof document!=='undefined'?document.getElementById('c'):null,ctx=cv&&cv.getContext('2d');
function rnd(a){return Math.floor(Math.random()*a)}
function init(){
 map=[];ore=[];ents=[];nid=1;tick=0;over=null;sel=[];place=null;
 for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){map.push(0);ore.push(0)}
 for(let i=0;i<30;i++){let cx=rnd(MW),cy=rnd(MH);if(Math.hypot(cx-8,cy-8)<12||Math.hypot(cx-55,cy-55)<12)continue;
  for(let j=0;j<8;j++){let x=cx+rnd(3),y=cy+rnd(3);if(x<MW&&y<MH)map[y*MW+x]=1}}
 const field=(cx,cy)=>{for(let y=cy-3;y<=cy+3;y++)for(let x=cx-3;x<=cx+3;x++)if(Math.hypot(x-cx,y-cy)<3.5){map[y*MW+x]=0;ore[y*MW+x]=300}};
 field(16,6);field(47,57);field(32,32);field(6,40);field(57,23);
 players=[{cr:3000,pow:0,ai:false},{cr:3000,pow:0,ai:true,wave:4,next:0}];
 addB('hq',0,5,5);addB('hq',1,55,55);
 addU('harv',0,10*T,10*T);addU('harv',1,53*T,53*T);
 for(let i=0;i<3;i++){addU('rifle',0,(9+i)*T,6*T);addU('rifle',1,(53-i)*T,58*T)}
 fog=new Uint8Array(MW*MH);vis=new Uint8Array(MW*MH);
 cam={x:0,y:0};buildQ={};
}
function addB(t,team,tx,ty){const d=BT[t];const b={id:nid++,b:1,t,team,tx,ty,w:d.w,h:d.h,hp:d.hp,mhp:d.hp,x:(tx+d.w/2)*T,y:(ty+d.h/2)*T,q:null};ents.push(b);return b}
function addU(t,team,x,y){const d=UT[t];const u={id:nid++,t,team,x,y,hp:d.hp,mhp:d.hp,path:[],tgt:null,cd:0,load:0,st:'idle'};ents.push(u);return u}
function blocked(x,y){if(x<0||y<0||x>=MW||y>=MH)return true;if(map[y*MW+x]===1)return true;
 for(const e of ents)if(e.b&&x>=e.tx&&x<e.tx+e.w&&y>=e.ty&&y<e.ty+e.h)return true;return false}
function blockGrid(){const g=new Uint8Array(MW*MH);for(let i=0;i<g.length;i++)g[i]=map[i]===1;
 for(const e of ents)if(e.b)for(let y=e.ty;y<e.ty+e.h;y++)for(let x=e.tx;x<e.tx+e.w;x++)g[y*MW+x]=1;return g}
// A* on 8-dir grid; if goal blocked, path to nearest reachable tile
function astar(sx,sy,gx,gy){const g=blockGrid();gx=Math.max(0,Math.min(MW-1,gx));gy=Math.max(0,Math.min(MH-1,gy));
 const N=MW*MH,gs=new Float32Array(N).fill(1e9),par=new Int32Array(N).fill(-1),cl=new Uint8Array(N);
 const s=sy*MW+sx,goal=gy*MW+gx;gs[s]=0;let open=[[Math.hypot(gx-sx,gy-sy),s]],best=s,bh=1e9,it=0;
 while(open.length&&it++<4000){let bi=0;for(let i=1;i<open.length;i++)if(open[i][0]<open[bi][0])bi=i;
  const c=open[bi][1];open[bi]=open[open.length-1];open.pop();if(cl[c])continue;cl[c]=1;
  const cx=c%MW,cy=(c/MW)|0,h=Math.hypot(gx-cx,gy-cy);if(h<bh){bh=h;best=c}if(c===goal)break;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;
   if(nx<0||ny<0||nx>=MW||ny>=MH)continue;const n=ny*MW+nx;if(g[n]&&n!==goal||cl[n])continue;
   if(g[n])continue;if(dx&&dy&&(g[cy*MW+nx]||g[ny*MW+cx]))continue;
   const ng=gs[c]+(dx&&dy?1.414:1);if(ng<gs[n]){gs[n]=ng;par[n]=c;open.push([ng+Math.hypot(gx-nx,gy-ny),n])}}}
 const p=[];let c=best;while(c!==s&&c>=0){p.push({x:(c%MW+.5)*T,y:(((c/MW)|0)+.5)*T});c=par[c]}return p.reverse()}
function moveTo(u,x,y){u.path=astar(Math.floor(u.x/T),Math.floor(u.y/T),Math.floor(x/T),Math.floor(y/T))}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function edist(u,e){if(!e.b)return dist(u,e);const cx=Math.max(e.tx*T,Math.min(u.x,(e.tx+e.w)*T)),cy=Math.max(e.ty*T,Math.min(u.y,(e.ty+e.h)*T));return Math.hypot(u.x-cx,u.y-cy)}
function power(team){let p=0;for(const e of ents)if(e.b&&e.team===team)p+=BT[e.t].pow;return p}
function has(team,t){return ents.some(e=>e.b&&e.team===team&&e.t===t)}
function canPlace(t,team,tx,ty){const d=BT[t];for(let y=ty;y<ty+d.h;y++)for(let x=tx;x<tx+d.w;x++)if(blocked(x,y)||ore[y*MW+x])return false;
 return ents.some(e=>e.b&&e.team===team&&Math.abs(e.tx+e.w/2-(tx+d.w/2))<9&&Math.abs(e.ty+e.h/2-(ty+d.h/2))<9)}
function canBuild(team,t){const d=BT[t];return has(team,'hq')&&(!d.req||has(team,d.req))}
function train(team,t){const d=UT[t],P=players[team];const fac=ents.filter(e=>e.b&&e.team===team&&e.t===d.from);
 if(!fac.length||P.cr<d.cost)return false;const f=fac.find(f=>!f.q)||fac[0];if(f.q)return false;P.cr-=d.cost;f.q={t,left:d.cost/4};return true}
function nearest(u,f){let b=null,bd=1e9;for(const e of ents)if(f(e)){const d=edist(u,e);if(d<bd){bd=d;b=e}}return b}
function nearestOre(u){let b=-1,bd=1e9;for(let i=0;i<ore.length;i++)if(ore[i]>0){const d=Math.hypot((i%MW+.5)*T-u.x,(((i/MW)|0)+.5)*T-u.y);if(d<bd){bd=d;b=i}}return b}
function step(){tick++;
 for(let t=0;t<2;t++)players[t].pow=power(t);
 for(const e of ents){if(e.hp<=0)continue;
  if(e.b){if(e.q){e.q.left-=players[e.team].pow<0?.5:1;if(e.q.left<=0){const u=addU(e.q.t,e.team,(e.tx+e.w/2)*T,(e.ty+e.h)*T+T/2);
     if(e.rally)moveTo(u,e.rally.x,e.rally.y);e.q=null}}continue}
  const d=UT[e.t];if(e.cd>0)e.cd--;
  if(e.t==='harv')harvest(e);
  else{if(e.tgt&&e.tgt.hp<=0)e.tgt=null;
   if(!e.tgt&&!e.forced){const en=nearest(e,o=>o.team!==e.team&&o.hp>0);if(en&&edist(e,en)<d.sight*T)e.tgt=en}
   if(e.tgt){const r=edist(e,e.tgt);if(r<=d.rng*T){e.path=[];e.forced=false;if(e.cd<=0){e.tgt.hp-=d.dmg;e.cd=d.cd;e.shot={x:e.tgt.x,y:e.tgt.y,t:6};if(e.tgt.hp<=0)e.tgt=null}}
    else if(!e.path.length||tick%30===0&&e.id%3===tick%3)moveTo(e,e.tgt.x,e.tgt.y)}}
  if(e.path.length){const p=e.path[0],dd=Math.hypot(p.x-e.x,p.y-e.y);if(dd<d.sp){e.x=p.x;e.y=p.y;e.path.shift()}else{e.x+=(p.x-e.x)/dd*d.sp;e.y+=(p.y-e.y)/dd*d.sp}}
  else if(!e.b&&e.t!=='harv'){e.forced=false}
  if(e.shot&&--e.shot.t<=0)e.shot=null}
 // simple separation
 for(const a of ents)if(!a.b)for(const b of ents)if(!b.b&&a!==b){const dd=dist(a,b);if(dd<8&&dd>0){a.x+=(a.x-b.x)/dd*.3;a.y+=(a.y-b.y)/dd*.3}}
 for(const e of ents)if(e.hp<=0&&sel.includes(e))sel.splice(sel.indexOf(e),1);
 ents=ents.filter(e=>e.hp>0);
 if(!over){if(!has(0,'hq'))over='DEFEAT';else if(!has(1,'hq'))over='VICTORY'}
 if(tick%60===0)ai(1);
 if(tick%10===0)updFog()}
function harvest(h){const P=players[h.team];
 if(h.st==='idle'||h.st==='toOre'&&!h.path.length){const i=nearestOre(h);if(i<0)return;const tx=i%MW,ty=(i/MW)|0;
  if(Math.floor(h.x/T)===tx&&Math.floor(h.y/T)===ty)h.st='mine';else if(h.st==='idle'||h.retry++>3){h.retry=0;h.path=astar(Math.floor(h.x/T),Math.floor(h.y/T),tx,ty);h.st='toOre'}else h.st='mine'}
 if(h.st==='mine'){const i=Math.floor(h.y/T)*MW+Math.floor(h.x/T);if(ore[i]>0){if(tick%4===0){ore[i]--;h.load++}}else if(h.load<100){h.st='idle';return}
  if(h.load>=100)h.st='ret'}
 if(h.st==='ret'){const r=nearest(h,e=>e.b&&e.team===h.team&&e.t==='refinery');if(!r)return;
  if(edist(h,r)<T*.8){P.cr+=h.load*2;h.load=0;h.st='idle'}else if(!h.path.length)moveTo(h,r.x,(r.ty+r.h)*T+T/2)}}
const AIORDER=['power','refinery','barracks','power','factory','power','barracks','refinery'];
function ai(t){const P=players[t];const mine=ents.filter(e=>e.team===t);const hq=mine.find(e=>e.t==='hq');if(!hq)return;
 const counts={};for(const e of mine)counts[e.t]=(counts[e.t]||0)+1;
 const need={};let want=null;for(const b of AIORDER){need[b]=(need[b]||0)+1;if((counts[b]||0)<need[b]){want=b;break}}
 if(want&&canBuild(t,want)&&P.cr>=BT[want].cost){for(let k=0;k<40;k++){const x=hq.tx-7+rnd(14),y=hq.ty-7+rnd(14);if(canPlace(want,t,x,y)){P.cr-=BT[want].cost;addB(want,t,x,y);break}}}
 else if(!want||P.cr>BT[want].cost+700){if((counts.harv||0)<2)train(t,'harv');else{train(t,rnd(3)?'rifle':'tank');train(t,'rifle')}}
 const army=mine.filter(e=>!e.b&&e.t!=='harv'&&!e.attacking);
 if(army.length>=P.wave){const tg=nearest(hq,e=>e.team!==t&&e.b);if(tg)for(const u of army){u.attacking=1;u.tgt=tg;moveTo(u,tg.x,tg.y)}P.wave=Math.min(P.wave+2,14)}}
function updFog(){vis.fill(0);for(const e of ents)if(e.team===0){const r=e.b?6:UT[e.t].sight,cx=Math.floor(e.x/T),cy=Math.floor(e.y/T);
 for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(x>=0&&y>=0&&x<MW&&y<MH&&(x-cx)**2+(y-cy)**2<=r*r){vis[y*MW+x]=1;fog[y*MW+x]=1}}}
// ---------- rendering & input (browser only) ----------
let mouse={x:0,y:0,down:false,sx:0,sy:0},keys={};
function draw(){const W=cv.width,H=cv.height;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-cam.x,-cam.y);
 const x0=Math.max(0,Math.floor(cam.x/T)),y0=Math.max(0,Math.floor(cam.y/T)),x1=Math.min(MW,x0+W/T+2),y1=Math.min(MH,y0+H/T+2);
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*MW+x;if(!fog[i])continue;
  ctx.fillStyle=map[i]===1?'#556':ore[i]>0?`rgb(${150+ore[i]/3|0},${120+ore[i]/4|0},30)`:((x+y)&1?'#2c4a2c':'#2a472a');ctx.fillRect(x*T,y*T,T,T)}
 for(const e of ents){const ti=Math.floor(e.y/T)*MW+Math.floor(e.x/T);if(e.team!==0&&!(e.b?fog[ti]:vis[ti]))continue;
  if(e.b){ctx.fillStyle=BT[e.t].c;ctx.fillRect(e.tx*T+2,e.ty*T+2,e.w*T-4,e.h*T-4);ctx.strokeStyle=COL[e.team];ctx.lineWidth=3;ctx.strokeRect(e.tx*T+2,e.ty*T+2,e.w*T-4,e.h*T-4);
   ctx.fillStyle='#000';ctx.font='10px sans-serif';ctx.fillText(BT[e.t].n,e.tx*T+5,e.ty*T+14);if(e.q){ctx.fillText(UT[e.q.t].n+'…',e.tx*T+5,e.ty*T+26)}}
  else{const r=UT[e.t].r;ctx.fillStyle=COL[e.team];
   if(e.t==='rifle'){ctx.beginPath();ctx.arc(e.x,e.y,r,0,7);ctx.fill()}
   else if(e.t==='tank'){ctx.fillRect(e.x-r,e.y-r*.7,2*r,1.4*r);ctx.fillStyle='#222';ctx.beginPath();ctx.arc(e.x,e.y,4,0,7);ctx.fill()}
   else{ctx.fillRect(e.x-r,e.y-r,2*r,2*r);ctx.fillStyle='#fc3';ctx.fillRect(e.x-r+3,e.y-r+3,(2*r-6)*e.load/100,4)}
   if(e.shot){ctx.strokeStyle='#ff8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.shot.x,e.shot.y);ctx.stroke()}}
  const s=sel.includes(e),bw=e.b?e.w*T:20,bx=e.b?e.tx*T:e.x-10,by=e.b?e.ty*T-5:e.y-UT[e.t].r-6;
  if(s||e.hp<e.mhp){ctx.fillStyle='#300';ctx.fillRect(bx,by,bw,3);const f=e.hp/e.mhp;ctx.fillStyle=f>.5?'#4f4':f>.25?'#fd3':'#f33';ctx.fillRect(bx,by,bw*f,3)}
  if(s){ctx.strokeStyle='#fff';ctx.lineWidth=1;e.b?ctx.strokeRect(e.tx*T,e.ty*T,e.w*T,e.h*T):ctx.strokeRect(e.x-12,e.y-12,24,24)}}
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(fog[y*MW+x]&&!vis[y*MW+x]){ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(x*T,y*T,T,T)}
 if(place){const tx=Math.floor((mouse.x+cam.x)/T),ty=Math.floor((mouse.y+cam.y)/T),d=BT[place];ctx.fillStyle=canPlace(place,0,tx,ty)?'rgba(0,255,0,.35)':'rgba(255,0,0,.35)';ctx.fillRect(tx*T,ty*T,d.w*T,d.h*T)}
 ctx.restore();
 if(mouse.down&&!place){ctx.strokeStyle='#0f0';ctx.strokeRect(mouse.sx,mouse.sy,mouse.x-mouse.sx,mouse.y-mouse.sy)}
 // minimap
 const ms=2,mx=W-MW*ms-6,my=6;ctx.fillStyle='#000';ctx.fillRect(mx,my,MW*ms,MH*ms);
 for(let i=0;i<MW*MH;i++)if(fog[i]&&(map[i]||ore[i])){ctx.fillStyle=map[i]?'#556':'#a82';ctx.fillRect(mx+(i%MW)*ms,my+((i/MW)|0)*ms,ms,ms)}
 for(const e of ents){const ti=Math.floor(e.y/T)*MW+Math.floor(e.x/T);if(e.team!==0&&!vis[ti])continue;ctx.fillStyle=COL[e.team];ctx.fillRect(mx+e.x/T*ms-1,my+e.y/T*ms-1,e.b?4:2,e.b?4:2)}
 ctx.strokeStyle='#fff';ctx.strokeRect(mx+cam.x/T*ms,my+cam.y/T*ms,W/T*ms,H/T*ms);
 if(over){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,W,H);ctx.fillStyle=over==='VICTORY'?'#4f4':'#f44';ctx.font='48px sans-serif';ctx.fillText(over,W/2-110,H/2);ctx.font='16px sans-serif';ctx.fillText('Reload to play again',W/2-70,H/2+30)}}
function ui(){const P=players[0];document.getElementById('stats').innerHTML=`Credits: <b>${P.cr}</b><br>Power: <b style="color:${P.pow<0?'#f55':'#5f5'}">${P.pow}</b>`;
 for(const k in BT){if(k==='hq')continue;const b=document.getElementById('b_'+k);b.disabled=!canBuild(0,k)||P.cr<BT[k].cost}
 for(const k in UT){const b=document.getElementById('u_'+k);b.disabled=!has(0,UT[k].from)||P.cr<UT[k].cost}}
function setup(){const bb=document.getElementById('bb'),tb=document.getElementById('tb');
 for(const k in BT){if(k==='hq')continue;const b=document.createElement('button');b.id='b_'+k;b.textContent=`${BT[k].n} $${BT[k].cost}`;b.onclick=()=>{place=k};bb.appendChild(b)}
 for(const k in UT){const b=document.createElement('button');b.id='u_'+k;b.textContent=`${UT[k].n} $${UT[k].cost}`;b.onclick=()=>{if(!train(0,k))msg('Producer busy or no funds')};tb.appendChild(b)}
 const rs=()=>{cv.width=innerWidth-180;cv.height=innerHeight};addEventListener('resize',rs);rs();
 cv.oncontextmenu=e=>e.preventDefault();
 cv.onmousemove=e=>{mouse.x=e.offsetX;mouse.y=e.offsetY};
 cv.onmousedown=e=>{const wx=e.offsetX+cam.x,wy=e.offsetY+cam.y;
  if(e.button===2){if(place){place=null;return}const tg=ents.find(o=>o.team!==0&&(o.b?edist({x:wx,y:wy},o)<1:dist(o,{x:wx,y:wy})<12));
   sel.forEach((u,i)=>{if(u.b){u.rally={x:wx,y:wy};return}if(u.t==='harv'){moveTo(u,wx,wy);u.st='toOre';return}
    u.attacking=0;if(tg){u.tgt=tg;u.forced=true;moveTo(u,tg.x,tg.y)}else{u.tgt=null;u.forced=true;moveTo(u,wx+(i%4)*12-18,wy+((i/4)|0)*12)}});return}
  if(place){const tx=Math.floor(wx/T),ty=Math.floor(wy/T);if(canPlace(place,0,tx,ty)&&players[0].cr>=BT[place].cost){players[0].cr-=BT[place].cost;addB(place,0,tx,ty);place=null}else msg('Cannot place there');return}
  mouse.down=true;mouse.sx=e.offsetX;mouse.sy=e.offsetY};
 cv.onmouseup=e=>{if(!mouse.down)return;mouse.down=false;const ax=Math.min(mouse.sx,e.offsetX)+cam.x,bx=Math.max(mouse.sx,e.offsetX)+cam.x,ay=Math.min(mouse.sy,e.offsetY)+cam.y,by=Math.max(mouse.sy,e.offsetY)+cam.y;
  if(bx-ax<5&&by-ay<5){const p={x:ax,y:ay};const o=ents.find(o=>o.team===0&&(o.b?edist(p,o)<1:dist(o,p)<12));sel=o?[o]:[]}
  else sel=ents.filter(o=>o.team===0&&!o.b&&o.x>=ax&&o.x<=bx&&o.y>=ay&&o.y<=by)};
 cv.onmouseleave=()=>{mouse.x=-1};
 addEventListener('keydown',e=>{keys[e.key]=1;if(e.key==='Escape')place=null});addEventListener('keyup',e=>{keys[e.key]=0})}
let mt;function msg(s){document.getElementById('msg').textContent=s;clearTimeout(mt);mt=setTimeout(()=>msg(''),2000)}
function loop(){if(!over)step();const s=10,W=cv.width,H=cv.height;
 if(keys.a||keys.ArrowLeft||mouse.x>=0&&mouse.x<8)cam.x-=s;if(keys.d||keys.ArrowRight||mouse.x>W-8)cam.x+=s;
 if(keys.w||keys.ArrowUp||mouse.x>=0&&mouse.y<8)cam.y-=s;if(keys.s||keys.ArrowDown||mouse.x>=0&&mouse.y>H-8)cam.y+=s;
 cam.x=Math.max(0,Math.min(MW*T-W,cam.x));cam.y=Math.max(0,Math.min(MH*T-H,cam.y));
 draw();if(tick%15===0)ui();requestAnimationFrame(loop)}
if(cv){init();setup();updFog();ui();loop()}
if(typeof module!=='undefined')module.exports={init,step,get ents(){return ents},get players(){return players},get over(){return over},train,addB,canPlace};
