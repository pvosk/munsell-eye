// Portable shards retain exact target, recipe, and controls for EVERY proposal.
// Verbose discovery descriptors remain reproducible from the fixed source/seed.
import {createReadStream,createWriteStream,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createGunzip,createGzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
const manifest='docs/play-broad-bank-index.json';if(existsSync(manifest))throw Error('Preserve existing bank index');
const source=JSON.parse(readFileSync('docs/play-broad-palette-screen.json','utf8'));
const shards=[3,4,5,6,8].map(size=>{const path=`docs/play-broad-bank-${size}.jsonl.gz`;if(existsSync(path))throw Error('Preserve existing shard');const gzip=createGzip(),file=createWriteStream(path);gzip.pipe(file);return {size,path,gzip,file,count:0};});
for await(const line of createInterface({input:createReadStream(source.archive).pipe(createGunzip()),crlfDelay:Infinity})){
 const p=JSON.parse(line),s=shards.find(s=>s.size===p.indices.length)!;s.count++;
 if(!s.gzip.write(JSON.stringify([p.indices,p.sample,p.order,p.times,p.recipe,p.target.rgb])+'\n'))await once(s.gzip,'drain');
}
await Promise.all(shards.map(async s=>{s.gzip.end();await once(s.file,'finish');}));
writeFileSync(manifest,JSON.stringify({version:'broad-portable-bank-1',sourceHash:source.sourceHash,policy:source.policy,pigments:source.pigments,
 fields:['pigmentPoolIndices','sample','order','timesSeconds','originalPigmentQuantities','fixedTargetRGB'],status:'discovery proposals, not certified holes',
 shards:shards.map(s=>({size:s.size,path:s.path,count:s.count,sha256:createHash('sha256').update(readFileSync(s.path)).digest('hex')}))},null,2));
console.log('Portable bank written. Verbose original is preserved separately.');
