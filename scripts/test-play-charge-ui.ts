import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../app/play.tsx',import.meta.url),'utf8');
function harness(type='touch') {
 const charge:{current:unknown}={current:null},paintPress:{current:any}={current:null};
 let timer=()=>{},pours=0;
 const window={scrollY:0,scrollTo:()=>{}};
 const code=source.slice(source.indexOf('  const controls ='),source.indexOf('  const power ='));
 const controls=new Function('charge','paintPress','begin','release','cancelCharge','setSelected','window','setTimeout','clearTimeout',transformSync(code,{loader:'ts'}).code+';return controls;')(
  charge,paintPress,()=>{charge.current={};},()=>{pours++;charge.current=null;},()=>{charge.current=null;if(paintPress.current)paintPress.current.cancelled=true;},()=>{},window,(fn:()=>void)=>{timer=fn;},()=>{}
 )(0);
 const event=(x=0,y=0)=>({button:0,isPrimary:true,pointerId:1,pointerType:type,clientX:x,clientY:y,preventDefault(){},currentTarget:{focus(){},closest(){return null;},setPointerCapture(){}}});
 return {controls,event,charge,paintPress,hold:()=>timer(),pours:()=>pours};
}
test('mouse drag outside the paint remains a pour',()=>{
 const h=harness('mouse');h.controls.onPointerDown(h.event());h.controls.onPointerMove(h.event(300,200));
 assert.ok(h.charge.current);h.controls.onPointerUp(h.event(300,200));assert.equal(h.pours(),1);
});
test('thumb drift before and after hold does not cancel',()=>{
 const h=harness();h.controls.onPointerDown(h.event());h.controls.onPointerMove(h.event(12,8));h.hold();
 h.controls.onPointerMove(h.event(40,30));assert.ok(h.charge.current);h.controls.onPointerUp(h.event(40,30));assert.equal(h.pours(),1);
});
test('deliberate early swipe scrolls without pouring; quick tap still pours',()=>{
 const h=harness();h.controls.onPointerDown(h.event());h.controls.onPointerMove(h.event(0,40));h.hold();h.controls.onPointerUp(h.event(0,40));assert.equal(h.pours(),0);
 const tap=harness();tap.controls.onPointerDown(tap.event());tap.controls.onPointerUp(tap.event());assert.equal(tap.pours(),1);
});
test('escape and flight hint cannot undo a released shot',()=>{
 assert.match(source,/event.key === 'Escape'\) \{ cancelCharge\(\); setHelp\(false\); return;/);
 assert.doesNotMatch(source,/onClick=\{cancelShot\}/);
});
