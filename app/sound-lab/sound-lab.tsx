'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SoundLabEngine, type NoteEvent } from './engine';
import { DEFAULTS, GROUPS, PRESETS, TUNINGS, frequencies, sanitizeParameters, type Parameters, type SliderSpec } from './parameters';
import { MusicPanel } from './music-panel';
import { noteName, type MusicSettings } from './music';
import './sound-lab.css';

type Saved = { id: string; name: string; parameters: Parameters };
type Status = 'off' | 'loading' | 'on' | 'error' | 'resetting';
const STORAGE = 'chroma-glider-sound-lab-v1';
const fmt = (n: number, unit = '') => unit === 'Hz' ? `${n >= 1000 ? (n / 1000).toFixed(2) + 'k' : n.toFixed(n < 300 ? 1 : 0)} Hz` : unit === 's' ? `${n < .1 ? (n * 1000).toFixed(0) + ' ms' : n.toFixed(2) + ' s'}` : unit === 'st' ? `${n > 0 ? '+' : ''}${n.toFixed(1)} st` : n.toFixed(2);

function Slider({ spec, value, onChange }: { spec: SliderSpec; value: number; onChange: (value: number) => void }) {
  const id = `sl-${spec.key}`;
  const position = spec.log ? Math.log(value / spec.min) / Math.log(spec.max / spec.min) * 1000 : value;
  return <div className="sl-control">
    <div className="sl-control-label"><label htmlFor={id}>{spec.label}</label><output htmlFor={id}>{fmt(value, spec.unit)}</output></div>
    <input id={id} type="range" min={spec.log ? 0 : spec.min} max={spec.log ? 1000 : spec.max} step={spec.log ? 1 : spec.step}
      value={position} aria-valuetext={fmt(value, spec.unit)} aria-describedby={`${id}-hint`}
      onChange={e => onChange(spec.log ? Math.round(spec.min * (spec.max / spec.min) ** (Number(e.target.value) / 1000) / spec.step) * spec.step : Number(e.target.value))} />
    <p id={`${id}-hint`} className="sl-hint">{spec.hint}</p>
  </div>;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Field({ engine, enabled, resolved }: { engine: React.RefObject<SoundLabEngine | null>; enabled: boolean; resolved: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const held = useRef(false);
  const position = useRef({ x: .5, y: .5 });
  const particles = useRef<(NoteEvent & { born: number })[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    return e.subscribeNotes(note => {
      particles.current.push({ ...note, born: performance.now() });
      setLast(note.hz); setCount(n => n + 1);
    });
  }, [engine, enabled]);
  useEffect(() => {
    let frame = 0;
    const data = new Float32Array(1024);
    const draw = (time: number) => {
      const c = canvas.current, ctx = c?.getContext('2d');
      if (c && ctx) {
        const width = c.clientWidth, height = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
        if (c.width !== Math.round(width * dpr) || c.height !== Math.round(height * dpr)) { c.width = Math.round(width * dpr); c.height = Math.round(height * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
        const guide = resolved ? '147,212,192' : '160,179,197';
        ctx.strokeStyle = `rgba(${guide},.1)`; ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(width * i / 6, 18); ctx.lineTo(width * i / 6, height - 55); ctx.stroke(); }
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(18, height * i / 4); ctx.lineTo(width - 18, height * i / 4); ctx.stroke(); }
        particles.current = particles.current.filter(p => time - p.born < 4200);
        for (const p of particles.current) {
          const age = (time - p.born) / 4200, x = 24 + p.x * (width - 48), y = 25 + p.y * (height - 105);
          ctx.strokeStyle = `rgba(${resolved ? '147,212,192' : '176,192,230'},${(1 - age) * .48})`;
          ctx.beginPath(); ctx.ellipse(x, y, 7 + age * 66, 7 + age * 26, -.12, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = `rgba(${guide},${(1 - age) * .8})`;
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        const analyser = engine.current?.analyser;
        if (analyser && enabled) analyser.getFloatTimeDomainData(data); else data.fill(0);
        ctx.strokeStyle = `rgba(${guide},.72)`; ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = i / (data.length - 1) * width, y = height - 29 + data[i] * 115;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [engine, enabled, resolved]);
  const playAt = (x: number, y: number) => {
    position.current = { x: Math.max(0, Math.min(.999, x)), y: Math.max(0, Math.min(1, y)) };
    engine.current?.touch(position.current.x, position.current.y);
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
    event.preventDefault();
    const { x, y } = position.current;
    playAt(x + (event.key === 'ArrowRight' ? .17 : event.key === 'ArrowLeft' ? -.17 : 0), y + (event.key === 'ArrowDown' ? .2 : event.key === 'ArrowUp' ? -.2 : 0));
  };
  return <div className={`sl-field ${enabled ? 'enabled' : ''} ${resolved ? 'resolved' : ''}`} tabIndex={enabled ? 0 : -1} role="group"
    aria-label="Audition field. Drag to scatter tones. Arrow keys change the position; space plays a note."
    onKeyDown={keys}
    onPointerDown={event => {
      if (!enabled) return;
      held.current = true; event.currentTarget.setPointerCapture(event.pointerId);
      const box = event.currentTarget.getBoundingClientRect(); playAt((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    }}
    onPointerMove={event => {
      if (!held.current || !enabled) return;
      const box = event.currentTarget.getBoundingClientRect(); playAt((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
    }}
    onPointerUp={() => { held.current = false; }} onPointerCancel={() => { held.current = false; }} onLostPointerCapture={() => { held.current = false; }}>
    <canvas ref={canvas} aria-hidden="true" />
    <div className="sl-field-caption"><span>{resolved ? 'Settling into home' : enabled ? 'Move to scatter' : 'A space to listen'}</span><small>{enabled ? 'Across: tones · Up: higher, stronger excitation' : 'Enable sound, then touch or drag through the field.'}</small></div>
    <div className="sl-field-readout" aria-hidden="true"><span>{last ? noteName(69+12*Math.log2(last/440)) : '— Hz'}</span><span>{count} notes · live output below</span></div>
  </div>;
}

export default function SoundLab() {
  const [p, setP] = useState<Parameters>(() => sanitizeParameters(DEFAULTS));
  const [status, setStatus] = useState<Status>('off');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [ambient, setAmbient] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [selected, setSelected] = useState('Submerged glass');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [name, setName] = useState('');
  const [recording, setRecording] = useState(false);
  const [musicStep, setMusicStep] = useState(0);
  const [motifPlaying, setMotifPlaying] = useState(false);
  const engine = useRef<SoundLabEngine | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    const e = new SoundLabEngine(); engine.current = e;
    e.onError = text => { if (alive.current) { setError(text); setStatus('error'); setRecording(false); } };
    queueMicrotask(() => {
      if (!alive.current) return;
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE) || '[]');
        if (Array.isArray(raw)) setSaved(raw.slice(0, 30).filter(v => typeof v?.name === 'string' && typeof v?.id === 'string').map(v => ({ id: v.id, name: v.name.slice(0, 60), parameters: sanitizeParameters(v.parameters) })));
      } catch { /* A corrupt or unavailable local store must not prevent listening. */ }
    });
    const hide = () => {
      if (document.hidden) { engine.current?.stop(); setStatus('off'); setResolved(false); setRecording(false); }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      alive.current = false; document.removeEventListener('visibilitychange', hide);
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      void engine.current?.dispose(); engine.current = null;
    };
  }, []);
  useEffect(() => engine.current?.subscribeMusic((step,playing)=>{setMusicStep(step);setMotifPlaying(playing);}), [status]);
  useEffect(() => { engine.current?.update(p); }, [p]);
  useEffect(() => { engine.current?.setAmbient(ambient); }, [ambient]);

  const stop = useCallback(() => {
    engine.current?.stop(); setStatus('off'); setResolved(false); setRecording(false);
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
  }, []);
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') stop(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [stop]);

  const start = async () => {
    const e = engine.current; if (!e) return;
    setStatus('loading'); setError(''); setResolved(false); e.parameters = sanitizeParameters(p); e.ambient = ambient;
    try { await e.start(); if (alive.current) setStatus(e.running ? 'on' : 'off'); }
    catch (err) { if (alive.current) { setStatus('error'); setError(err instanceof Error ? err.message : String(err)); } }
  };
  const change = (key: keyof Parameters, value: number | number[]) => { setP(old => sanitizeParameters({ ...old, [key]: value, ...(['intervals','root'].includes(key)?{music:{...old.music,source:'custom'}}:{}) })); setSelected('Custom sound'); };
  const changeMusic = (music: MusicSettings) => { setP(old=>sanitizeParameters({...old,music})); setSelected('Custom music'); };
  const resetAudio = async () => {
    setStatus('resetting'); setError(''); setResolved(false); setRecording(false); setMotifPlaying(false); setMusicStep(0);
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    const previous = engine.current; engine.current = null;
    try { await previous?.dispose(); } finally {
      if (alive.current) {
        const fresh = new SoundLabEngine(); engine.current = fresh;
        fresh.onError = text => { if (alive.current) { setError(text); setStatus('error'); setRecording(false); } };
        setP(old=>sanitizeParameters({...old,freeze:0,music:{...old.music,sustain:false}}));
        setStatus('off'); setMessage('Audio memory cleared. Sustained harmony and freeze are off. Your other settings are kept.');
      }
    }
  };
  const load = (values: Parameters, title: string) => { engine.current?.stopMotif(); engine.current?.explore(); setResolved(false); setP(sanitizeParameters(values)); setSelected(title); setMessage(''); };
  const persist = (next: Saved[]) => {
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setSaved(next); return true; }
    catch { setMessage('Browser storage is unavailable. Export the settings to keep them.'); return false; }
  };
  const save = () => {
    if (!name.trim()) { setMessage('Give this sound a name first.'); return; }
    if (saved.length >= 30) { setMessage('You have 30 saved sounds. Remove one or export your settings.'); return; }
    if (persist([...saved, { id: crypto.randomUUID(), name: name.trim().slice(0, 60), parameters: sanitizeParameters(p) }])) { setMessage('Saved in this browser.'); setName(''); }
  };
  const capture = () => {
    if (recording) {
      engine.current?.stopRecording(); setRecording(false);
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      return;
    }
    const started = engine.current?.startRecording(blob => {
      download(blob, `chroma-listening-${Date.now()}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`);
      setRecording(false); setMessage('Listening clip downloaded.');
    });
    if (!started) { setMessage('Audio recording is not available in this browser. You can still export settings.'); return; }
    setRecording(true); setMessage('Recording the lab output. Stops after 60 seconds.');
    recordingTimer.current = setTimeout(() => { engine.current?.stopRecording(); if (alive.current) setRecording(false); }, 60000);
  };
  const enabled = status === 'on';
  return <main className="sl-root">
    <header className="sl-header">
      <Link className="sl-back" href="/?mode=play"><span aria-hidden="true">←</span> Munsell Eye</Link>
      <span className="sl-status"><i className={enabled ? 'live' : ''} />{status === 'loading' ? 'Starting audio…' : enabled ? 'Sound enabled' : 'Sound off'}</span>
    </header>
    <div className="sl-workspace">
      <div className="sl-title-row"><div><p className="sl-eyebrow">Chroma Glider / listening studies</p><h1>Sound lab<span>.</span></h1><p className="sl-intro">Shape a tone. Follow its wake. Find the way home.</p></div>
        <div className="sl-power">{!enabled ? <button className="sl-primary" onClick={start} disabled={status === 'loading' || status === 'resetting'}>{status === 'resetting' ? 'Clearing audio…' : status === 'loading' ? 'Starting…' : status === 'error' ? 'Retry sound' : 'Enable sound'} <span aria-hidden="true">↗</span></button> : <button className="sl-stop" onClick={stop}>■ Stop sound <kbd>esc</kbd></button>}
          <button className="sl-reset-audio" disabled={status==='resetting'} onClick={resetAudio}>Reset audio · clear all tails</button>
          {status === 'loading' && <button className="sl-link-button" onClick={stop}>Cancel</button>}
          <label className="sl-volume">Output <input aria-label="Output volume" type="range" min="0" max="0.8" step="0.01" value={p.volume} onChange={e => change('volume', Number(e.target.value))} /><output>{Math.round(p.volume * 100)}%</output></label>
        </div>
      </div>
      {status === 'error' && <div className="sl-error" role="alert">The audio engine could not start. Try again or open this page in a current Chrome or Safari browser.<details><summary>Error details</summary>{error}</details></div>}
      <MusicPanel value={p.music} onChange={changeMusic} enabled={enabled} playing={motifPlaying} step={musicStep} onPlay={()=>engine.current?.playMotif()} onStop={()=>engine.current?.stopMotif()} onNext={()=>{engine.current?.nextHarmony();setResolved(false);}} />
      <p className="sl-sound-design-label">Sound character · keeps your musical system</p>
      <div className="sl-preset-grid" aria-label="Starting sounds">{PRESETS.map(preset => <button key={preset.name} className={selected === preset.name ? 'active' : ''} aria-pressed={selected === preset.name} onClick={() => load({...preset.values,music:p.music,root:p.root,intervals:p.intervals}, preset.name)}><i style={{ background: preset.color }} /><span><strong>{preset.name}</strong><small>{preset.description}</small></span></button>)}</div>
      <div className="sl-listening-grid">
        <section className="sl-audition" aria-label="Listen and gesture">
          <Field engine={engine} enabled={enabled} resolved={resolved} />
          <div className="sl-actions"><button disabled={!enabled} onClick={() => engine.current?.note(0, 1, .8, 0)}>Strike a note</button><button disabled={!enabled} onClick={() => engine.current?.scatter()}>Scatter an arc <span aria-hidden="true">↝</span></button><button className={resolved ? 'sl-resolved' : 'sl-resolve'} disabled={!enabled} onClick={() => { if (resolved) engine.current?.explore(); else engine.current?.resolve(); setResolved(!resolved); }}>{resolved ? 'Return to suspension' : 'Resolve'} <span aria-hidden="true">{resolved ? '↺' : '◎'}</span></button></div>
          <div className="sl-listen-bottom"><label className="sl-toggle"><input type="checkbox" checked={ambient} onChange={e => setAmbient(e.target.checked)} />Ambient currents</label><button disabled={!enabled} className={`sl-record ${recording ? 'recording' : ''}`} onClick={capture}><i />{recording ? 'Finish recording' : 'Record a clip'}</button></div>
        </section>
        <aside className="sl-harmonic-card"><div className="sl-section-number">01 / destination</div><h2>A harmony to return to</h2><p>The field stays open until you choose to resolve it. Try the same arc before and after settling.</p>
          <div className="sl-tone-stack">{frequencies(p, true).map((hz, i) => <div key={i}><span>{String(i + 1).padStart(2, '0')}</span><i style={{ width: `${24 + Math.min(1, (p.intervals[i] + 1200) / 4800) * 76}%` }} /><strong>{noteName(69+12*Math.log2(hz/440))}<small> · {hz.toFixed(0)} Hz</small></strong></div>)}</div>
          <details className="sl-tuning"><summary>Advanced: custom cents</summary><label>Tuning<select value={TUNINGS.findIndex(t => t.intervals.every((v, i) => v === p.intervals[i]))} onChange={e => { const t = TUNINGS[Number(e.target.value)]; if (t) change('intervals', t.intervals); }}><option value="-1" disabled>Custom intervals</option>{TUNINGS.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}</select></label><p>Intervals above the foundation, in cents. 1,200 cents = one octave.</p><div className="sl-intervals">{p.intervals.map((v, i) => <label key={i}>Tone {i + 1}<input type="number" min="-1200" max="3600" step="0.01" value={v} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) change('intervals', p.intervals.map((x, j) => i === j ? n : x)); }} /></label>)}</div></details>
        </aside>
      </div>
      <div className="sl-control-heading"><h2>Make it yours</h2><p>New notes follow your system. Older echoes keep their pitches; Reset audio clears them.</p></div>
      <div className="sl-controls-grid">{GROUPS.map((group, i) => <section className="sl-control-group" key={group.name}><div className="sl-section-number">0{i + 2} / shaping</div><h3>{group.name}</h3><p className="sl-group-subtitle">{group.subtitle}</p>{group.sliders.map(spec => <Slider key={spec.key} spec={spec} value={p[spec.key]} onChange={v => change(spec.key, v)} />)}</section>)}</div>
      <section className="sl-save"><div><div className="sl-section-number">05 / keep a discovery</div><h2>{selected}</h2><p>Saved sounds stay in this browser. Export settings to share or keep a copy.</p></div><div className="sl-save-controls"><div className="sl-name-row"><input aria-label="Name this sound" maxLength={60} placeholder="Name this sound" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} /><button onClick={save}>Save sound</button></div><div className="sl-file-actions"><button onClick={() => download(new Blob([JSON.stringify({ version: 1, name: name.trim() || selected, parameters: p }, null, 2)], { type: 'application/json' }), 'chroma-sound.json')}>Export settings ↗</button><button onClick={() => input.current?.click()}>Import settings</button><button onClick={() => load(DEFAULTS, PRESETS[0].name)}>Reset controls</button></div><input ref={input} type="file" accept="application/json,.json" hidden onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          try {
            if (file.size > 64000) throw new Error('Settings file is too large.');
            const data = JSON.parse(await file.text());
            if (data.version !== 1 || !data.parameters || typeof data.parameters !== 'object') throw new Error('Choose an exported Chroma sound settings file.');
            load(sanitizeParameters(data.parameters), typeof data.name === 'string' ? data.name.slice(0, 60) : 'Imported sound'); setMessage('Settings imported.');
          } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not read those settings.'); }
        }} /></div>
        <p className="sl-message" role="status">{message}</p>
        {!!saved.length && <div className="sl-saved-list">{saved.map(sound => <div key={sound.id}><button onClick={() => load(sound.parameters, sound.name)}>{sound.name}</button><button aria-label={`Remove saved sound ${sound.name}`} onClick={() => persist(saved.filter(s => s.id !== sound.id))}>×</button></div>)}</div>}
      </section>
      <footer className="sl-footer"><span>Browser SuperCollider · SuperSonic 0.80.0</span><span>Independent listening lab · game integration comes later</span><a href="/sound-lab/runtime/LICENSE" target="_blank" rel="noreferrer">Engine license</a></footer>
    </div>
  </main>;
}
