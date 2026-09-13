import {Color,mix} from 'spectral.js';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {mixtureColor} from '../app/play-engine';
import {recipeContributions,contributionLegs,legReplay} from '../app/play-pigment-legs';
import {rng} from './premix-hybrid';
import {sampleRecipe} from './pigment-leg-proposals';
type Spectral=Color&{KS:number[];luminance:number;R:number[]};
function rank(columns:number[][]){const basis:number[][]=[];for(const column of columns){let v=[...column];const initial=Math.hypot(...v);if(!initial)continue;for(let pass=0;pass<2;pass++)for(const b of basis){const dot=v.reduce((s,x,i)=>s+x*b[i],0);v=v.map((x,i)=>x-dot*b[i]);}const norm=Math.hypot(...v);if(norm>initial*1e-8)basis.push(v.map(x=>x/norm));}return basis.length;}
const random=rng(731991),records:{n:number;paints:string[];ksAffineRank:number;colorJacobianRank:number;recipeLegs:number}[]=[];let maxSpectralError=0,maxRecipeReplayError=0;
for(const n of [4,5,6,7])for(let trial=0;trial<20;trial++){
 const paints:PaintColor[]=[];while(paints.length<n){const p=PAINTS[Math.floor(random()*PAINTS.length)];if(!paints.some(x=>x.id===p.id))paints.push(p);}
 const colors=paints.map(p=>{const c=new Color(p.rgb) as Spectral;c.tintingStrength=p.strength;return c;}),q=sampleRecipe(n,random),s=sampleRecipe(n,random),w=q.map((v,i)=>v*v*paints[i].strength**2*colors[i].luminance),total=w.reduce((a,b)=>a+b),ks=colors[0].KS.map((_,j)=>colors.reduce((sum,c,i)=>sum+c.KS[j]*w[i]/total,0)),R=ks.map(k=>1+k-Math.sqrt(k*k+2*k));
 const reconstructed=new Color(R),actual=mix(...colors.map((c,i)=>[c,q[i]] as [Color,number]));maxSpectralError=Math.max(maxSpectralError,...actual.lRGB.map((v,i)=>Math.abs(v-reconstructed.lRGB[i])));
 const h=1e-6,jac=Array.from({length:n-1},(_,i)=>{const a=[...q],b=[...q];a[i]+=h;a[n-1]-=h;b[i]-=h;b[n-1]+=h;const ca=mixtureColor(paints,a).lab,cb=mixtureColor(paints,b).lab;return ca.map((v,k)=>(v-cb[k])/(2*h));});
 const c=recipeContributions(s,q),legs=contributionLegs(c.paints,c.weights),replay=legReplay(s,legs);maxRecipeReplayError=Math.max(maxRecipeReplayError,...replay.map((v,i)=>Math.abs(v-q[i])));
 records.push({n,paints:paints.map(p=>p.id),ksAffineRank:rank(colors.slice(1).map(c=>c.KS.map((v,i)=>v-colors[0].KS[i]))),colorJacobianRank:rank(jac),recipeLegs:legs.length});
}
if(maxRecipeReplayError>1e-9||maxSpectralError>1e-6)throw Error('Model reconstruction mismatch');
mkdirSync('docs/leg-dimension-study',{recursive:true});writeFileSync('docs/leg-dimension-study/results.json',JSON.stringify({spectralBands:38,dependencyHash:createHash('sha256').update(readFileSync('node_modules/spectral.js/spectral.js')).digest('hex'),maxSpectralError,maxRecipeReplayError,records},null,2));
const groups=[4,5,6,7].map(n=>({n,ksRanks:[...new Set(records.filter(r=>r.n===n).map(r=>r.ksAffineRank))],jacobianRanks:[...new Set(records.filter(r=>r.n===n).map(r=>r.colorJacobianRank))]}));
console.log(JSON.stringify({maxSpectralError,maxRecipeReplayError,groups}));
