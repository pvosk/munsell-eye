import {LiveSolver} from './live-search';
import type {AtlasCase} from './types';
import type {LiveInput} from './live-model';
// Jobs yield between small solver steps. A new slider position supersedes the
// previous job; old results carry their request id and are ignored by the UI.
const scope=self as unknown as {onmessage:((e:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void};
let solver:LiveSolver|null=null,generation=0;
scope.onmessage=(event:MessageEvent<{type:'init';data:AtlasCase}|{type:'query';id:number;input:LiveInput}|{type:'cancel'}>)=>{
 const message=event.data;
 if(message.type==='init'){generation++;solver=new LiveSolver(message.data);return;}
 if(message.type==='cancel'){generation++;return;}
 const current=++generation,id=message.id;
 if(!solver)return;
 void solver.solve(message.input,result=>scope.postMessage({id,result}),()=>current!==generation).catch(error=>{if(current===generation)scope.postMessage({id,error:String(error)});});
};
