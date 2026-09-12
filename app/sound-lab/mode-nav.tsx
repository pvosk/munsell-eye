"use client";
import {useEffect,useRef,useState} from 'react';

const sections=[['practice','Practice'],['image','Image'],['mix','Mix'],['play','Play'],['explore','Explore'],['reference','Reference']] as const;
export function SoundModeNav(){
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className="sl-mode-nav" ref={root} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
    <button ref={trigger} type="button" className="sl-mode-trigger" aria-label="Play and app sections" aria-expanded={open} aria-controls="sound-app-sections" onClick={()=>setOpen(!open)}>Play <span aria-hidden="true">⌄</span></button>
    <nav id="sound-app-sections" aria-label="App sections" className="sl-mode-options" hidden={!open}>
      {sections.map(([id,label])=><a key={id} href={`/?mode=${id}`}>{label}</a>)}
      <a href="/sound-lab" aria-current="page">Sound Lab</a>
    </nav>
  </div>;
}
