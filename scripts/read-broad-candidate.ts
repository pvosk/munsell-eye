// Retrieve an exact archived proposal without rerunning the search.
// node --import tsx scripts/read-broad-candidate.ts mine-11-19-27-8
import {readFileSync,createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
const id=process.argv[2];if(!/^mine-(\d+-){3,8}\d+$/.test(id??''))throw Error('Supply an archived mine-... candidate ID');
const parts=id.split('-').slice(1).map(Number),sample=parts.pop()!,indices=parts;
const index=JSON.parse(readFileSync('docs/play-broad-bank-index.json','utf8')),shard=index.shards.find((s:any)=>s.size===indices.length);if(!shard)throw Error('Unsupported archived size');
const lines=createInterface({input:createReadStream(shard.path).pipe(createGunzip()),crlfDelay:Infinity});let found=false;
for await(const line of lines){const row=JSON.parse(line);if(row[1]===sample&&row[0].join()===indices.join()){
 console.log(JSON.stringify({id,sourceHash:index.sourceHash,status:index.status,paints:indices.map(i=>index.pigments[i]),order:row[2],times:row[3],recipe:row[4],targetRGB:row[5]},null,2));found=true;break;
}}if(!found)throw Error('Candidate not in bank');
