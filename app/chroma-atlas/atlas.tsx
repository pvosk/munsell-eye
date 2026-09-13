'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {AtlasCase} from './types';
import Workspace from './workspace';
import './atlas.css';
type Index={cases:{id:string;name:string;request:string;url:string}[];notes:string[]};
const titles:Record<string,string>={'light-rise':'Light destination','dark-drop':'Dark destination','mid-balance':'Middle-value balance','vivid-ride':'Chromatic destination','fixed-hansa':'Shared target · Hansa study','fixed-ryb':'Shared target · RYB study'};
export default function ChromaAtlas(){
 const [index,setIndex]=useState<Index|null>(null),[choice,setChoice]=useState(0),[data,setData]=useState<AtlasCase|null>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/atlas/index.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error('Could not load the atlas index.');return r.json() as Promise<Index>;}).then(setIndex).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 useEffect(()=>{if(!index)return;const c=new AbortController();fetch(index.cases[choice].url,{signal:c.signal}).then(r=>{if(!r.ok)throw Error('Could not load this palette.');return r.json() as Promise<AtlasCase>;}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[index,choice]);
 return <div className="atlas-app"><header className="atlas-header"><Link href="/?mode=play" className="atlas-brand">◐ <span>Munsell Eye</span></Link><nav aria-label="App sections"><Link href="/?mode=play">Play</Link><Link href="/sound-lab">Sound Lab</Link><Link href="/chroma-atlas" aria-current="page">Chroma Atlas</Link><details><summary>More</summary><div><Link href="/?mode=practice">Practice</Link><Link href="/?mode=image">Image</Link><Link href="/?mode=mix">Mix</Link><Link href="/?mode=explore">Explore</Link><Link href="/?mode=reference">Reference</Link></div></details></nav></header>
  <main><div className="atlas-title"><h1>Chroma Atlas</h1><p>Live setup & destination studies</p></div><div className="atlas-toolbar"><label>Palette & starting study<select value={choice} onChange={e=>{setError('');setData(null);setChoice(Number(e.target.value));}} disabled={!index}>{index?.cases.map((c,i)=><option key={c.id} value={i}>{titles[c.request]??c.request} — {c.name}</option>)}</select></label></div>
   {error&&<p role="alert">{error} <button onClick={()=>window.location.reload()}>Retry</button></p>}{data?<Workspace key={data.id} data={data}/>:<p role="status">Loading computed regions…</p>}
  </main></div>;
}
