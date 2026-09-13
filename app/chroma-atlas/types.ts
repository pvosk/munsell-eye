export type AtlasPaint={id:string;name:string;rgb:number[];strength:number};
export type AtlasPoint={recipe:number[];rgb:number[];lab:number[]};
export type AtlasNode=AtlasPoint&{id:number;stage:number;parent:number|null;paint:number|null;share:number;known:boolean;arc?:number[][];shareWindow?:[number,number]};
export type AtlasCase={id:string;name:string;request:string;paints:AtlasPaint[];target:{rgb:number[];lab:number[]};tolerance:number;field:AtlasPoint[];nodes:AtlasNode[];defaultNode:number;knownRoutes:{node:number;minimum:number|null;regionMinimum:number|null;styles:string[];shorterMargin:number|null}[];cacheKey:string;stats:{seconds:number;counts:number[];discarded:number;maxReplayError:number;validatedPaths:number}};
export type AtlasData={version:string;cases:AtlasCase[];notes:string[]};
