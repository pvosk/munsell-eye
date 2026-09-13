// Shared lightweight physical color calculation. No courses, renderer or controls.
import {Color,mix} from 'spectral.js';
export type PigmentSnapshot={id:string;rgb:readonly number[];strength:number};
export type Triple=[number,number,number];
export function rgbToOklab(rgb:readonly number[]):Triple {
 const [r,g,b]=rgb.map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const cache=new Map<string,Color>();
export function mixPigmentRGB(paints:readonly PigmentSnapshot[],quantities:readonly number[]):Triple {
 const mass=quantities.reduce((sum,v)=>sum+v,0);
 if(!Number.isFinite(mass)||mass<=0||quantities.some(q=>!Number.isFinite(q)||q<0))throw Error('Invalid paint quantities');
 const active=paints.map((p,i)=>{const key=`${p.id}:${p.rgb}:${p.strength}`;let c=cache.get(key);if(!c){c=new Color([...p.rgb]);c.tintingStrength=p.strength;cache.set(key,c);}return [c,(quantities[i]??0)/mass] as [Color,number];}).filter(([,q])=>q>0);
 const result=active.length===1?active[0][0]:mix(...active);
 return result.lRGB.map(v=>{const linear=Math.max(0,Math.min(1,v));return 255*(linear<=.0031308?linear*12.92:1.055*linear**(1/2.4)-.055);}) as Triple;
}
