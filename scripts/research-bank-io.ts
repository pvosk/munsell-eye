import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export function readBankBytes(path:string,preferArchive=false):Buffer{
 if(existsSync(path)&&!preferArchive)return readFileSync(path);
 const manifest=JSON.parse(readFileSync(path+'.archive.json','utf8'));
 const root=resolve(dirname(path));
 const buffers=manifest.parts.map((part:{path:string})=>{
  const p=resolve(root,part.path);if(!p.startsWith(root+sep))throw Error('Invalid bank part path');
  return gunzipSync(readFileSync(p));
 });
 const bytes=Buffer.concat(buffers);
 if(bytes.length!==manifest.bytes||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Research archive integrity mismatch');
 return bytes;
}
export const readBankJson=(path:string)=>JSON.parse(readBankBytes(path).toString('utf8'));
