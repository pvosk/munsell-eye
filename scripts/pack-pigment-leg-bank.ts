import {readFileSync,writeFileSync,readdirSync,statSync,mkdirSync,existsSync} from 'node:fs';
import {basename} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readBankBytes} from './research-bank-io';
// Preserve exact original bytes/hash. Local raw caches remain untouched; only
// portable chunks are versioned for archives too large for the source host.
for(const dir of readdirSync('docs').filter(d=>d.startsWith('pigment-leg-')||d.startsWith('branching-region-')||d.startsWith('conditioned-branch-')||d.startsWith('long-leg-limits-')))for(const file of readdirSync('docs/'+dir)){
 const path='docs/'+dir+'/'+file;if(!file.endsWith('.json')||statSync(path).size<=2_000_000)continue;
 if(existsSync(path+'.archive.json'))continue;
 const bytes=readFileSync(path),parts:{path:string}[]=[];mkdirSync(path+'.parts');
 for(let offset=0,i=0;offset<bytes.length;offset+=2_000_000,i++){
  const name=String(i).padStart(3,'0')+'.gz';writeFileSync(path+'.parts/'+name,gzipSync(bytes.subarray(offset,offset+2_000_000)));
  parts.push({path:basename(path)+'.parts/'+name});
 }
 writeFileSync(path+'.archive.json',JSON.stringify({version:1,original:basename(path),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),parts}));
 if(!readBankBytes(path,true).equals(bytes))throw Error('Roundtrip failed');
 console.log(JSON.stringify({path,bytes:bytes.length,parts:parts.length,verified:true}));
}
