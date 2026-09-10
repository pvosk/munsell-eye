'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type MouseEvent } from 'react';
import { HOLES_PER_PALETTE, PLAY_LEVELS, addPaint, chargeAmount, chargePower, colorDistance, generateHole, mixtureColor, nearestNotation, pourPath, rgbStyle, rgbToLab, totalMass, type Hole, type Mixture } from './play-engine';
import type { PlayScene } from './play-scene';
import {newLabAttempt,type LabAttempt,type LabSpecimen} from './play-lab-model';
import {usePlayLabSync} from './play-lab-sync';
import {LabPicker,PlayLabPanel} from './play-lab';
import './play.css';

type Phase = 'intro' | 'seed' | 'rest' | 'flight' | 'landed';
type Charge = { index: number; started: number; source: string };
const massLabel = (mass: number) => mass < 1000 ? mass.toLocaleString(undefined, { maximumFractionDigits: mass < 10 ? 2 : 1 }) : mass.toExponential(1);

function PaletteRail({value,disabled,onChange}:{value:number;disabled:boolean;onChange:(index:number)=>void}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null);
  const keyboardOpen=useRef(false);
  useEffect(()=>{
    if(!open) return;
    if(keyboardOpen.current)root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({preventScroll:true});
    const outside=(event:globalThis.PointerEvent)=>{if(!root.current?.contains(event.target as Node)) setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  const close=()=>{setOpen(false);if(keyboardOpen.current)trigger.current?.focus({preventScroll:true});};
  // Safari may blur a button with relatedTarget=null before dispatching the
  // next touch click. That is not evidence that focus left the menu.
  return <div ref={root} className={`play-palette-rail mobile-choice-rail ${open?'open':''}`} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();keyboardOpen.current=true;close();}}} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
    <button ref={trigger} className="mobile-choice-trigger" aria-expanded={open} aria-controls="play-palette-options" disabled={disabled} tabIndex={open?-1:0} onClick={event=>{keyboardOpen.current=event.detail===0;setOpen(true);}} type="button"><span>Palette</span><strong>{PLAY_LEVELS[value].name}</strong><i aria-hidden="true">›</i></button>
    <div id="play-palette-options" className="mobile-choice-options" aria-label="Palette choices" inert={!open}>
      {PLAY_LEVELS.map((entry,index)=><button key={entry.name} className={index===value?'active':''} aria-pressed={index===value} disabled={disabled} onClick={()=>{onChange(index);close();}} type="button">{entry.name}</button>)}
      <button aria-label="Close palette choices" onClick={close} type="button">×</button>
    </div>
  </div>;
}

export default function PlayView() {
  const [lab,setLab]=useState(false);
  const sync=usePlayLabSync(lab);
  const [attempt,setAttempt]=useState<LabAttempt|null>(null);
  const attemptRef=useRef<LabAttempt|null>(null);
  const labLive=useRef({enabled:lab,signedIn:sync.signedIn});
  useEffect(()=>{labLive.current={enabled:lab,signedIn:sync.signedIn};},[lab,sync.signedIn]);
  const saveLabEvent=sync.save;
  const record=useCallback((next:LabAttempt)=>{
    attemptRef.current=next;setAttempt(next);
    saveLabEvent({id:crypto.randomUUID(),attemptId:next.id,type:'attempt',attempt:next});
  },[saveLabEvent]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setLab(new URLSearchParams(location.search).get('lab')==='1'));return()=>cancelAnimationFrame(frame);},[]);
  const [levelIndex, setLevelIndex] = useState(0);
  const [hole, setHole] = useState<Hole>(() => generateHole(0, 190926));
  const [quantities, setQuantities] = useState<Mixture>([0, 0, 0]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [pours, setPours] = useState(0);
  const [selected, setSelected] = useState(0);
  const [charged, setCharged] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [help, setHelp] = useState(false);
  const [, setResults] = useState<(number | null)[][]>(PLAY_LEVELS.map(() => Array(HOLES_PER_PALETTE).fill(null)));
  const [finishPaused,setFinishPaused]=useState(false);
  const [announcement, setAnnouncement] = useState('Choose your first paint.');
  const host = useRef<HTMLDivElement>(null);
  const targetLabel = useRef<HTMLDivElement>(null);
  const scene = useRef<PlayScene | null>(null);
  const charge = useRef<Charge | null>(null);
  const rollback=useRef<{quantities:Mixture;pours:number;phase:Phase}|null>(null);
  const paintPress = useRef<{ id: number; x: number; y: number; started: number; scroll: number; rail: HTMLElement | null; cancelled: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const level = PLAY_LEVELS[levelIndex];
  useEffect(()=>{
    if(lab&&sync.signedIn&&!attemptRef.current)record(newLabAttempt({levelIndex,hole},crypto.randomUUID()));
  },[lab,sync.signedIn,levelIndex,hole,record]);
  const point = useMemo(() => mixtureColor(level.paints, quantities), [level.paints, quantities]);
  const notation = useMemo(() => nearestNotation(point), [point]);
  const mass = totalMass(quantities);
  const distance = colorDistance(point, hole.target);
  const live = useRef({ levelIndex, hole, quantities, phase, selected, ready, pours, help, error });
  useEffect(() => { live.current = { levelIndex, hole, quantities, phase, selected, ready, pours, help, error }; });

  useEffect(() => {
    let cancelled = false;
    let mounted: PlayScene | null = null;
    import('./play-scene').then(({ createPlayScene }) => {
      if (cancelled || !host.current) return;
      try {
        mounted = createPlayScene(host.current, hole, {
          targetPosition(x, y, offscreen, angle) {
            if (!targetLabel.current) return;
            targetLabel.current.style.transform = `translate(${x}px, ${y}px)`;
            targetLabel.current.dataset.offscreen = String(offscreen);
            targetLabel.current.style.setProperty('--bearing', `${angle}rad`);
          },
          onError() { charge.current = null; setCharged(null); setReady(false); setError(true); },
          onIntroEnd() { setPhase('seed'); setAnnouncement('Choose your first paint.'); },
        });
        scene.current = mounted; setError(false); setReady(true);
      } catch { setError(true); setReady(false); }
    }).catch(() => { if (!cancelled) { setError(true); setReady(false); } });
    return () => { cancelled = true; mounted?.dispose(); if (scene.current === mounted) scene.current = null; };
  }, [hole]);

  const cancelCharge = useCallback(() => {
    if (paintPress.current) { paintPress.current.cancelled = true; clearTimeout(paintPress.current.timer); }
    charge.current = null; setCharged(null); scene.current?.cancelCharge();
  }, []);
  const cancelShot=useCallback(()=>{
    const before=rollback.current;
    if(!before || !scene.current?.cancelFlight())return;
    rollback.current=null;
    live.current={...live.current,...before};
    setQuantities(before.quantities);setPours(before.pours);setPhase(before.phase);
    const active=attemptRef.current;
    if(labLive.current.enabled&&active&&active.shots.length)record({...active,shots:active.shots.map((s,i)=>i===active.shots.length-1?{...s,cancelled:true}:s)});
    setAnnouncement('Shot cancelled. Previous mixture and shot count restored.');
  },[record]);
  const begin = useCallback((index: number, source: string, started = performance.now()) => {
    const s = live.current;
    if(labLive.current.enabled&&(!labLive.current.signedIn||(attemptRef.current?.shots.length??0)>=200))return;
    if (!s.ready || s.error || s.help || s.phase === 'intro' || s.phase === 'flight' || s.phase === 'landed' || charge.current) return;
    charge.current = { index, started, source };
    setSelected(index); setCharged(0);
  }, []);
  const release = useCallback((source: string) => {
    const held = charge.current;
    if (!held || held.source !== source || !scene.current) return;
    const s = live.current;
    charge.current = null; setCharged(null); scene.current.cancelCharge();
    const palette = PLAY_LEVELS[s.levelIndex].paints;
    const before = s.quantities;
    const beforeMass = totalMass(before);
    const seconds=(performance.now()-held.started)/1000;
    const amount = chargeAmount(beforeMass, seconds);
    const after = addPaint(before, held.index, amount);
    const path = pourPath(palette, before, held.index, amount);
    const nextPours = s.pours + (beforeMass ? 1 : 0);
    rollback.current={quantities:[...before],pours:s.pours,phase:beforeMass?'rest':'seed'};
    // Lock before React renders so overlapping key/pointer events cannot pour twice.
    live.current = { ...s, phase: 'flight', pours: nextPours, quantities: after };
    setPhase('flight'); setPours(nextPours);
    setAnnouncement(`Pour ${nextPours}: ${palette[held.index].name}.`);
    if(labLive.current.enabled&&attemptRef.current)record({...attemptRef.current,shots:[...attemptRef.current.shots,{paint:held.index,seconds,amount,before:[...before],after:[...after],cancelled:false}]});
    scene.current.launch(path, beforeMass, totalMass(after), () => {
      rollback.current=null;
      const result = mixtureColor(palette, after);
      const landed = colorDistance(result, s.hole.target) <= s.hole.tolerance;
      setQuantities(after); setPhase(landed ? 'landed' : 'rest');
      if (landed) {
        if(labLive.current.enabled&&attemptRef.current)record({...attemptRef.current,outcome:'landed'});
        scene.current?.celebrate();
        setResults((current) => current.map((round, i) => i === s.levelIndex ? round.map((score, j) => j === s.hole.stage ? Math.min(score ?? Infinity, nextPours) : score) : round));
        setAnnouncement(`Landed in ${nextPours} pours. Player par ${s.hole.par}.`);
      } else setAnnouncement(`${beforeMass ? 'Settled' : 'Base chosen'}. ${nearestNotation(result)}. Choose a paint and hold to pour.`);
    });
  }, [record]);

  useEffect(() => {
    let frame = 0; let lastUI = 0;
    let cachedCharge: Charge | null = null;
    let tangent: ReturnType<typeof mixtureColor> | undefined;
    const tick = (now: number) => {
      const held = charge.current;
      if (held && scene.current) {
        const seconds = (now - held.started) / 1000;
        const s = live.current;
        const palette = PLAY_LEVELS[s.levelIndex].paints;
        const mass = totalMass(s.quantities);
        if (cachedCharge !== held) {
          cachedCharge = held;
          tangent = mass ? mixtureColor(palette, addPaint(s.quantities, held.index, mass * .03)) : undefined;
        }
        scene.current.charge(palette[held.index].rgb, chargeAmount(mass, seconds) / Math.max(1, mass), chargePower(seconds), palette[held.index].strength, tangent);
        if (now - lastUI > 25) { setCharged(seconds); lastUI = now; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancelCharge(); cancelShot(); setHelp(false); return; }
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select') || target?.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return;
      const index = Number(event.key) - 1;
      const digit = /^[1-9]$/.test(event.key) && index < PLAY_LEVELS[live.current.levelIndex].paints.length;
      const action = event.code === 'Space' && (!target?.closest('button') || !!target.closest('[data-pour]'));
      if (!digit && !action) return;
      event.preventDefault(); if (!event.repeat) begin(digit ? index : live.current.selected, `key:${event.code}`);
    };
    const keyUp = (event: KeyboardEvent) => { if (charge.current?.source === `key:${event.code}`) { event.preventDefault(); release(`key:${event.code}`); } };
    const visibility = () => { if (document.hidden) cancelCharge(); };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', cancelCharge);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', cancelCharge); document.removeEventListener('visibilitychange', visibility); cancelCharge(); };
  }, [begin, release, cancelCharge, cancelShot]);

  const startHole = (index: number, same = false, stage = index === levelIndex ? hole.stage : 0, exact?:Hole, comparison?:LabSpecimen['comparison']) => {
    cancelShot();
    scene.current?.cancelFlight();
    rollback.current=null;
    setFinishPaused(false);
    cancelCharge(); setReady(false); setError(false); setSelected(0); setPours(0); setPhase('intro'); setHelp(false);
    setQuantities(PLAY_LEVELS[index].paints.map(() => 0)); setLevelIndex(index);
    // Keep a round's seed through all five holes. A requested new target should
    // not immediately repeat the same bank entry when the random variant repeats.
    let next=exact??(same&&index===levelIndex&&stage===hole.stage?{...hole}:generateHole(index,same?hole.seed:crypto.getRandomValues(new Uint32Array(1))[0],stage));
    if(!exact&&!same && index===levelIndex)for(let attempt=0;attempt<32 && next.courseId===hole.courseId;attempt++)next=generateHole(index,crypto.getRandomValues(new Uint32Array(1))[0],stage);
    if(lab&&sync.signedIn){
      const previous=attemptRef.current;
      if(previous&&previous.outcome==='playing')record({...previous,outcome:previous.specimen.hole.courseId===next.courseId?'replayed':'left'});
      record(newLabAttempt({levelIndex:index,hole:next,...(comparison?{comparison}:{})},crypto.randomUUID()));
    }
    setHole(next);
    setAnnouncement(`Hole ${stage + 1} of ${HOLES_PER_PALETTE}. Arriving in color space.`);
  };
  const replaySpecimen=(specimen:LabSpecimen)=>startHole(specimen.levelIndex,true,specimen.hole.stage,{...specimen.hole},specimen.comparison);
  const toggleLab=()=>{
    cancelCharge();cancelShot();
    if(lab&&attemptRef.current&&attemptRef.current.outcome==='playing')record({...attemptRef.current,outcome:'left'});
    attemptRef.current=null;setAttempt(null);
    const next=!lab;setLab(next);labLive.current.enabled=next;
    const url=new URL(location.href);if(next)url.searchParams.set('lab','1');else url.searchParams.delete('lab');history.replaceState(null,'',url);
    // Enter with a clean start so every recorded route includes its free base.
    if(next)startHole(levelIndex,true);
  };
  const reveal=()=>{if(attemptRef.current&&!attemptRef.current.revealed)record({...attemptRef.current,revealed:true});};
  const nextHole = () => hole.stage < HOLES_PER_PALETTE - 1
    ? startHole(levelIndex, true, hole.stage + 1)
    : startHole((levelIndex + 1) % PLAY_LEVELS.length, false, 0);
  const controls = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !event.isPrimary || charge.current) return;
      if (event.pointerType !== 'touch') event.preventDefault();
      if (event.pointerType !== 'touch') event.currentTarget.focus({ preventScroll: true });
      clearTimeout(paintPress.current?.timer);
      const rail = event.currentTarget.closest<HTMLElement>('.play-paints[data-wide=true]');
      const press = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), scroll: rail?.scrollLeft ?? 0, rail, cancelled: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
      paintPress.current = press;
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelected(index);
      if (event.pointerType === 'touch') {
        // Let native scrolling win before committing to a hold. Moving later
        // still cancels the pour, even after the charge animation has begun.
        press.timer = setTimeout(() => {
          if (paintPress.current === press && !press.cancelled) begin(index, `pointer:${press.id}`, press.started);
        }, 150);
      } else begin(index, `pointer:${event.pointerId}`);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const press = paintPress.current;
      if (!press || press.id !== event.pointerId) return;
      const dx = event.clientX - press.x, dy = event.clientY - press.y;
      if (Math.hypot(dx,dy) > 8) cancelCharge();
      if (press.cancelled && event.pointerType === 'mouse' && press.rail && Math.abs(dx) > Math.abs(dy)) {
        press.rail.scrollLeft = press.scroll - dx;
      }
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      const press = paintPress.current;
      if (!press || press.id !== event.pointerId) return;
      clearTimeout(press.timer);
      if (!press.cancelled) {
        // A clean short tap is a small pour, not a discarded hold. Charge time
        // always starts at contact, including the scroll-intent delay.
        if (!charge.current) begin(index, `pointer:${event.pointerId}`, press.started);
        release(`pointer:${event.pointerId}`);
      }
      paintPress.current = null;
    },
    onPointerCancel: cancelCharge,
    onLostPointerCapture: () => { if (paintPress.current) { cancelCharge(); paintPress.current = null; } },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 && !charge.current) { begin(index, 'accessible'); release('accessible'); }
    },
  });
  const power = charged === null ? 0 : chargePower(charged);
  const advance = useRef(nextHole);
  useEffect(() => { advance.current = nextHole; });
  useEffect(() => {
    if (lab || phase !== 'landed' || help || finishPaused) return;
    const timer = window.setTimeout(() => advance.current(), 5200);
    return () => window.clearTimeout(timer);
  }, [phase, help, hole, finishPaused,lab]);
  const amount = charged === null ? 0 : chargeAmount(mass, charged);
  const paintLab=rgbToLab(level.paints[selected].rgb);
  const mutedPaint=`oklab(${paintLab[0]} ${paintLab[1]*.08} ${paintLab[2]*.08})`;
  const disabled = !ready || error || phase === 'intro' || phase === 'flight' || phase === 'landed' || help || (lab&&!sync.signedIn);
  const status = phase === 'intro' ? 'Arriving' : phase === 'seed' ? 'Choose Your Base' : phase === 'flight' ? 'In Motion' : phase === 'landed' ? 'Landed' : distance < hole.tolerance * 1.6 ? 'Just Outside the Landing Zone' : 'Choose Your Next Pour';

  return <section className="paint-play" aria-label="Paint mixing game">
    <div className="play-topline">
      <div className="play-name"><h1>Chroma Glider</h1></div>
      <PaletteRail value={levelIndex} disabled={phase === 'flight' || charged !== null} onChange={index=>startHole(index)} />
      <div className="play-upper-actions"><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex, true)}>Restart</button><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex)}>New Target ↗</button><button className="play-help-button" aria-label="How to play" aria-expanded={help} onClick={() => { cancelCharge(); setHelp(!help); }} type="button">?</button></div>
    </div>
    <div className="play-lab-bar"><button type="button" aria-pressed={lab} onClick={toggleLab} disabled={phase==='flight'}>{lab?'Return to course':'Hole Lab'}</button>{lab&&<><LabPicker current={{levelIndex,hole}} disabled={phase==='flight'||!sync.signedIn} onChoose={replaySpecimen}/><button type="button" disabled={phase==='flight'||!sync.signedIn} onClick={()=>startHole(levelIndex,true)}>Replay hole</button></>}</div>
    <div className="play-world">
      <div className="play-canvas" ref={host} /><div className="play-world-vignette" />
      <div className="play-hud"><div className="play-target-swatch play-guess-swatch"><i style={{ background: mass ? rgbStyle(point.rgb) : '#e2dfd0' }} /><div><span className="play-eyebrow">Your Mixture</span><strong>{mass ? `≈ ${notation}` : 'No Paint Yet'}</strong></div></div><div className="play-target-swatch"><div><span className="play-eyebrow">Destination</span><strong>≈ {hole.notation}</strong></div><i style={{ background: rgbStyle(hole.target.rgb) }} /></div></div>
      <div ref={targetLabel} className="play-target-label" aria-hidden="true"><span className="play-target-arrow">➤</span><span>Destination</span></div>
      <div className="play-score"><span><b>{hole.stage + 1}/{HOLES_PER_PALETTE}</b> Hole</span><span><b>{String(pours).padStart(2, '0')}</b> Pours</span>{(!lab||attempt?.revealed)&&<span><b>{hole.par}</b> Par</span>}<span><b>{massLabel(mass)}</b> Parts</span></div>
      <div className="play-world-caption"><span>{status}</span><i /><span>{phase === 'seed' ? 'Your first paint starts pure' : 'The mixture carries every pour'}</span></div>
      {!ready && !error && <div className="play-loading">Opening Color Space<span /></div>}
      {error && <div className="play-message"><h2>The 3D View Couldn’t Open</h2><p>Try reopening the view, or use a browser with hardware acceleration enabled.</p><button type="button" onClick={() => startHole(levelIndex, true)}>Reopen View</button></div>}
{help && <div className="play-message play-instructions"><button className="play-close-help" aria-label="Close instructions" onClick={() => setHelp(false)} type="button">×</button><span className="play-eyebrow">How to Play</span><h2>A Little Paint. A Long Way.</h2><p>Hold a paint, then release. Your first shot carries you from the empty neutral starting point to that pure paint, free of the pour count. Every later pour blends into everything you’ve already added.</p><p>The meter sweeps up and returns. Release at the amount you want. A light touch adds a trace; a well-timed full charge adds a large pour. As your mixture grows, the same charge has less influence.</p><p>Aim for the center of the destination sphere and settle close to its color. The outline is a guide; passing through it doesn’t count. Use keys 1–{level.paints.length}, or hold Space for your selected paint. Escape cancels a charge. Drag the view between shots to look around.</p><p>The original palettes draw from four evaluated five-hole rounds; the two experimental palettes each have one. Courses have their own balance of colorful rides, value changes and quieter mixtures. The final hole carries the round’s toughest par or timing margin. A qualifying endpoint is drawn into the cup, then advances automatically. All palettes are available to explore.</p><p className="play-fineprint">Player par includes room for adjustment; it is not the fewest possible shots. It is provisionally calibrated from sampled routes and timing margins. Every starting paint is checked for one- and two-pour alternatives, but the search is not a mathematical proof. Landing tolerance stays fixed within each palette. Landing uses OKLab color difference; the map uses a smooth Munsell-calibrated projection. Paint colors and tinting strengths remain approximations.</p><button onClick={() => setHelp(false)} type="button">Back to Gliding</button></div>}
      {phase === 'landed' && !help && <div className="play-arrival" data-result={pours<=hole.par?'within':'over'} onFocus={()=>setFinishPaused(true)} onPointerDown={()=>setFinishPaused(true)}>
        <div className="play-finish-numbers"><div><strong>{String(pours).padStart(2,'0')}</strong><span>Shots</span></div><div><strong>{massLabel(mass)}</strong><span>Total parts</span></div></div>
        {(!lab||attempt?.revealed)&&<p className="play-par-difference">{pours===hole.par?'On par':`${pours>hole.par?'+':''}${pours-hole.par} vs par`} <span>· Player par {hole.par}</span></p>}
        <span className="play-eyebrow">{hole.stage === HOLES_PER_PALETTE - 1 ? 'Palette Complete' : `Hole ${hole.stage + 1} Complete`}</span>
        <h2>{lab?'Route complete.':pours < hole.par ? 'Beautifully Judged.' : pours === hole.par ? 'Right on Par.' : 'Found Your Way.'}</h2>
        <div>{!lab&&<button type="button" onClick={nextHole}>{hole.stage < HOLES_PER_PALETTE - 1 ? 'Next Hole' : 'Next Palette'} <span>↗</span></button>}<button type="button" className="play-arrival-secondary" onClick={() => startHole(levelIndex, true)}>Replay</button>{lab&&<button type="button" onClick={()=>document.querySelector('.play-lab-panel')?.scrollIntoView({behavior:'smooth'})}>Review below ↓</button>}</div>
      </div>}
    </div>
    <div className="play-dock">
      <div className="play-dock-status"><div className="play-charge-control"><div className="play-charge-caption"><span>{charged === null ? 'Hold & Release' : !mass ? 'Pure Base' : power > .8 ? 'Power Pour' : 'Loading Paint'}</span><strong>{charged === null ? '' : `+ ${massLabel(amount)} parts`}</strong></div><div className="play-charge-meter" role="meter" aria-label="Pour power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power * 100)} style={{ '--power': power, '--paint': rgbStyle(level.paints[selected].rgb), '--paint-muted':mutedPaint } as CSSProperties}><i /><b /></div></div></div>
      <div className="play-paints" data-wide={level.paints.length > 4} role="group" aria-label="Paint palette" onScroll={() => { if (paintPress.current) cancelCharge(); }} style={{ '--paint-count': level.paints.length } as CSSProperties}>{level.paints.map((entry, i) => <button {...controls(i)} data-pour="true" key={entry.id} type="button" disabled={disabled} className={`play-paint ${selected === i ? 'selected' : ''} ${charged !== null && selected === i ? 'charging' : ''}`} style={{ '--paint': rgbStyle(entry.rgb) } as CSSProperties} aria-label={`${i + 1}: ${entry.name}. Hold and release to pour.`} aria-pressed={selected === i}><span className="play-paint-color" /><span className="play-paint-name">{entry.name.replace(' (Green Shade)', '').replace(' (Yellow Shade)', '')}</span></button>)}</div>
      <div className="play-control-hint"><span>{phase === 'flight' ? <button type="button" onClick={cancelShot}>Cancel shot · Esc</button> : charged !== null ? 'Release to pour · Escape to cancel' : 'Hold a paint. Release to pour.'}</span><span className="play-keyboard-hint">1–{level.paints.length} to pour · Space to repeat</span></div>
      <div className="play-mobile-actions"><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex, true)}>Restart</button><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex)}>New Target ↗</button></div>
    </div>
    {lab&&<PlayLabPanel sync={sync} current={attempt} onReplay={replaySpecimen} onReveal={reveal}/>}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </section>;
}
