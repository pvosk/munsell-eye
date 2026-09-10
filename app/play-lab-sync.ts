'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {type LabEvent,validLabEvent} from './play-lab-model';

export function usePlayLabSync(enabled:boolean) {
  const [events,setEvents]=useState<LabEvent[]>([]),[status,setStatus]=useState('Sign in to sync'),[signedIn,setSignedIn]=useState(false);
  const remote=useRef<LabEvent[]>([]),pending=useRef<LabEvent[]>([]),busy=useRef(false),loading=useRef(false);
  const redraw=useCallback(()=>{
    const seen=new Set(remote.current.map(e=>e.id));
    setEvents([...remote.current,...pending.current.filter(e=>!seen.has(e.id))]);
  },[]);
  const refresh=useCallback(async()=>{
    if(loading.current)return;loading.current=true;
    try {
      const all:LabEvent[]=[];let after=0,more=true;
      while(more){
        const response=await fetch(`/api/play-lab?after=${after}`,{cache:'no-store'});
        if(response.status===401){setSignedIn(false);setStatus('Sign in to sync');return;}
        if(!response.ok)throw new Error('Sync unavailable — retry');
        const body=await response.json() as {events:LabEvent[];cursor:number;more:boolean};all.push(...body.events);after=body.cursor;more=body.more;
      }
      remote.current=all;setSignedIn(true);redraw();setStatus(pending.current.length?'Changes waiting to sync':'Synced');
    }catch{setStatus('Sync unavailable — retry');}finally{loading.current=false;}
  },[redraw]);
  const flush=useCallback(async()=>{
    if(busy.current)return;busy.current=true;
    try {
      while(pending.current.length){
        setStatus('Saving…');const event=pending.current[0];
        const response=await fetch('/api/play-lab',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});
        if(!response.ok){if(response.status===401)setSignedIn(false);throw new Error();}
        pending.current.shift();remote.current.push(event);redraw();
      }
      setStatus('Synced');
    }catch{setStatus('Not saved — retry or export before leaving');}finally{busy.current=false;}
  },[redraw]);
  const save=useCallback((event:LabEvent)=>{pending.current.push(event);redraw();void flush();},[redraw,flush]);
  useEffect(()=>{
    if(!enabled)return;
    const initial=window.setTimeout(()=>void refresh(),0);
    const focus=()=>{void flush().then(refresh);};
    const leave=(event:BeforeUnloadEvent)=>{if(pending.current.length){event.preventDefault();event.returnValue='';}};
    window.addEventListener('focus',focus);window.addEventListener('beforeunload',leave);
    return()=>{clearTimeout(initial);window.removeEventListener('focus',focus);window.removeEventListener('beforeunload',leave);};
  },[enabled,refresh,flush]);
  const exportFile=()=>{
    const blob=new Blob([JSON.stringify({format:'chroma-lab-1',events},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='chroma-lab.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importFile=async(file:File)=>{
    try {
      if(file.size>20_000_000)throw new Error();
      const data=JSON.parse(await file.text());
      if(data.format!=='chroma-lab-1'||!Array.isArray(data.events)||data.events.length>10000||!data.events.every(validLabEvent))throw new Error();
      const known=new Set([...remote.current,...pending.current].map(e=>e.id));
      pending.current.push(...(data.events as LabEvent[]).filter(e=>!known.has(e.id)));redraw();void flush();
    }catch{setStatus('Import rejected: invalid file or different engine version');}
  };
  return {events,status,signedIn,save,exportFile,importFile,retry:()=>void flush().then(refresh)};
}
