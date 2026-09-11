import type {ColorPoint} from './play-engine';
export function routeGraphBounds(played:ColorPoint[],references:ColorPoint[],example:ColorPoint[],target:ColorPoint){
 // Include the selected example even for legacy holes with no analysis bank.
 const points=[...played,...references,...example,target];
 return [0,1,2].map(axis=>{let min=Infinity,max=-Infinity;for(const p of points){min=Math.min(min,p.position[axis]);max=Math.max(max,p.position[axis]);}return[min,max];});
}
