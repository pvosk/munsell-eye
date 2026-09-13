import {mixPigmentRGB,rgbToOklab,type PigmentSnapshot} from '../pigment-color';
import type {AtlasCase,AtlasNode,AtlasPoint} from './types';
export const LIVE_ATLAS_VERSION='atlas-live-1-spectral3';
export type Leg={paint:number;share:number};
export type LiveInput={start:number[];target:number[];legs:Leg[]};
export type Trace={states:AtlasPoint[];arcs:number[][][];error:number;capture:number|null;legs:Leg[]};
export type LiveResult={key:string;target:number[];phase:'warm'|'search'|'done';best:Leg[]|null;bestError:number;shortest:number|null;checkedDepth:number;nodes:AtlasNode[];landingRecipe:number[]|null;closestError:number;cacheHit:boolean};
export const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function normalize(q:number[]){const s=q.reduce((a,b)=>a+b,0);if(!(s>0)||q.some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid recipe');return q.map(v=>v/s);}
export function changeFraction(q:number[],index:number,value:number){value=Math.max(0,Math.min(1,value));const rest=q.reduce((s,v,i)=>s+(i===index?0:v),0);return q.map((v,i)=>i===index?value:(1-value)*(rest>1e-12?v/rest:1/(q.length-1)));}
export function step(q:number[],leg:Leg){if(!Number.isInteger(leg.paint)||leg.paint<0||leg.paint>=q.length||!Number.isFinite(leg.share)||leg.share<0||leg.share>1)throw Error('Invalid leg');return normalize(q).map((v,i)=>(1-leg.share)*v+(i===leg.paint?leg.share:0));}
export const point=(paints:readonly PigmentSnapshot[],recipe:number[]):AtlasPoint=>{const rgb=mixPigmentRGB(paints,recipe);return {recipe,rgb,lab:rgbToOklab(rgb)};};
export function canonical(legs:Leg[]){const out:Leg[]=[];for(const l of legs){if(l.share<1e-9)continue;const last=out.at(-1);if(last?.paint===l.paint)last.share=1-(1-last.share)*(1-l.share);else out.push({...l});}return out;}
export function replay(paints:readonly PigmentSnapshot[],start:number[],legs:Leg[],target:number[],tolerance:number,samples=12):Trace {
 let q=normalize(start);const states=[point(paints,q)],arcs:number[][][]=[];let capture:number|null=distance(states[0].lab,target)<=tolerance?0:null;
 for(const [i,l] of legs.entries()){const before=q;arcs.push(samples?Array.from({length:samples+1},(_,n)=>{const c=point(paints,step(before,{...l,share:l.share*n/samples}));return [...c.lab,...c.rgb];}):[]);q=step(before,l);const c=point(paints,q);states.push(c);if(capture===null&&distance(c.lab,target)<=tolerance)capture=i+1;}
 return {states,arcs,error:distance(states.at(-1)!.lab,target),capture,legs};
}
export function nodeRoute(nodes:AtlasNode[],id:number){const legs:Leg[]=[];let at=nodes[id];const start=at.recipe;while(at.parent!==null){legs.push({paint:at.paint!,share:at.share});at=nodes[at.parent];}return {start,legs};}
export const exactKey=(data:Pick<AtlasCase,'cacheKey'|'paints'|'tolerance'>,input:Pick<LiveInput,'start'|'target'>)=>JSON.stringify([LIVE_ATLAS_VERSION,data.cacheKey,data.paints.map(p=>[p.id,p.rgb,p.strength]),data.tolerance,input.start,input.target]);
export const labToLch=(lab:number[])=>[lab[0],Math.hypot(lab[1],lab[2]),(Math.atan2(lab[2],lab[1])*180/Math.PI+360)%360];
export const lchToLab=([l,c,h]:number[])=>[l,c*Math.cos(h*Math.PI/180),c*Math.sin(h*Math.PI/180)];
export function displayLab([l,a,b]:number[]){const x=(l+.3963377774*a+.2158037573*b)**3,y=(l-.1055613458*a-.0638541728*b)**3,z=(l-.0894841775*a-1.291485548*b)**3;const linear=[4.0767416621*x-3.3077115913*y+.2309699292*z,-1.2684380046*x+2.6097574011*y-.3413193965*z,-.0041960863*x-.7034186147*y+1.707614701*z];return {clipped:linear.some(v=>v< -1e-6||v>1+1e-6),rgb:linear.map(v=>{v=Math.max(0,Math.min(1,v));return 255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);})};}
// A bounded session cache: exact hits reuse results; nearby entries are only
// warm starts, never evidence of reachability or difficulty at the new query.
export class QueryCache {
 private entries=new Map<string,{input:LiveInput;result:LiveResult}>();
 constructor(private limit=48){}
 get(key:string){const entry=this.entries.get(key);if(entry){this.entries.delete(key);this.entries.set(key,entry);}return entry?.result;}
 put(key:string,input:LiveInput,result:LiveResult){this.entries.delete(key);this.entries.set(key,{input:structuredClone(input),result:structuredClone(result)});while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value!);}
 near(input:LiveInput){return [...this.entries.values()].sort((a,b)=>(distance(a.input.target,input.target)+.2*distance(a.input.start,input.start))-(distance(b.input.target,input.target)+.2*distance(b.input.start,input.start))).slice(0,4);}
 get size(){return this.entries.size;}
}
