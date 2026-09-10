import { labDB } from '../../lab-db';
import { validLabEvent } from '../../play-lab-model';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request) {
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'Sign in to sync your lab.'},401);
  const cursor=Number(new URL(request.url).searchParams.get('after')??0);
  if(!Number.isSafeInteger(cursor)||cursor<0)return json({error:'Invalid cursor'},400);
  try {
    const result=await labDB().prepare('SELECT sequence, payload FROM lab_events WHERE owner = ? AND sequence > ? ORDER BY sequence LIMIT 100').bind(owner,cursor).all<{sequence:number;payload:string}>();
    return json({events:result.results.map(r=>JSON.parse(r.payload)),cursor:result.results.at(-1)?.sequence??cursor,more:result.results.length===100});
  } catch {return json({error:'Could not load the lab. Please retry.'},503);}
}
export async function POST(request:Request) {
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'Sign in to save your lab.'},401);
  // Same-origin browser writes only; never accept identity from request JSON.
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin not allowed'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing record'},400);
  let bytes=0,text='';const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>150000){await reader.cancel();return json({error:'Record too large'},413);}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
  let event:unknown;try{event=JSON.parse(text);}catch{return json({error:'Invalid record'},400);}
  if(!validLabEvent(event))return json({error:'This record does not match the current lab engine.'},400);
  try {
    await labDB().prepare('INSERT INTO lab_events (owner, event_id, attempt_id, payload) VALUES (?, ?, ?, ?) ON CONFLICT(owner, event_id) DO NOTHING').bind(owner,event.id,event.attemptId,JSON.stringify(event)).run();
    return json({saved:true});
  }catch{return json({error:'Not saved. Please retry.'},503);}
}
