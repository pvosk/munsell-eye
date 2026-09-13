// Exercises the actual bundled browser-worker message protocol in a Node worker
// adapter. This is not a substitute for browser or physical-device UI testing.
import {Worker} from 'node:worker_threads';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const filename=readdirSync('dist/client/_next/static').find(n=>/^live\.worker-.*\.js$/.test(n));
assert(filename,'Run the production build first');
const url=pathToFileURL(resolve('dist/client/_next/static',filename)).href;
const data=JSON.parse(readFileSync('public/atlas/case-0.json','utf8'));
let at=data.nodes[data.defaultNode];const input={start:at.recipe,target:data.target.lab,legs:[]};while(at.parent!==null){input.legs.push({paint:at.paint,share:at.share});at=data.nodes[at.parent];}
const w=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
const begin=performance.now();let superseded=false,completed=false;
await new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(Error('Worker query timed out')),15000);
 w.on('error',reject);
 w.on('message',message=>{
  try{
   if(message.ready){w.postMessage({type:'init',data});w.postMessage({type:'query',id:1,input});return;}
   assert(!message.error,message.error);
   if(message.id===1&&!superseded){superseded=true;w.postMessage({type:'query',id:2,input:{...input,target:input.target.map((v,i)=>v+(i===0?.004:0))}});}
   if(message.id===2&&message.result.phase==='done'){
    assert(message.result.shortest!==null);assert(message.result.nodes.length>0);assert(!message.result.cacheHit);completed=true;
    w.postMessage({type:'query',id:3,input:{...input,target:input.target.map((v,i)=>v+(i===0?.004:0))}});
   }
   if(message.id===3){assert(completed);assert(message.result.cacheHit);assert.equal(message.result.phase,'done');console.log(JSON.stringify({bundledWorker:true,cancellationMessageDelivered:superseded,cacheHit:true,elapsedMs:Math.round(performance.now()-begin),nodes:message.result.nodes.length}));clearTimeout(timeout);resolve();}
  }catch(e){clearTimeout(timeout);reject(e);}
 });
}).finally(()=>w.terminate());
