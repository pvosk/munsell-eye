'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type MouseEvent } from 'react';
import { HOLES_PER_PALETTE, PLAY_LEVELS, addPaint, chargeAmount, chargePower, colorDistance, generateHole, mixtureColor, nearestNotation, pourPath, rgbStyle, totalMass, type Hole, type Mixture } from './play-engine';
import type { PlayScene } from './play-scene';
import './play.css';

type Phase = 'intro' | 'seed' | 'rest' | 'flight' | 'landed';
type Charge = { index: number; started: number; source: string };
const massLabel = (mass: number) => mass < 1000 ? mass.toLocaleString(undefined, { maximumFractionDigits: mass < 10 ? 2 : 1 }) : mass.toExponential(1);

export default function PlayView() {
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
  const [results, setResults] = useState<(number | null)[][]>(PLAY_LEVELS.map(() => Array(HOLES_PER_PALETTE).fill(null)));
  const [announcement, setAnnouncement] = useState('Choose your first paint.');
  const host = useRef<HTMLDivElement>(null);
  const targetLabel = useRef<HTMLDivElement>(null);
  const scene = useRef<PlayScene | null>(null);
  const charge = useRef<Charge | null>(null);
  const level = PLAY_LEVELS[levelIndex];
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
    charge.current = null; setCharged(null); scene.current?.cancelCharge();
  }, []);
  const begin = useCallback((index: number, source: string) => {
    const s = live.current;
    if (!s.ready || s.error || s.help || s.phase === 'intro' || s.phase === 'flight' || s.phase === 'landed' || charge.current) return;
    charge.current = { index, started: performance.now(), source };
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
    const amount = chargeAmount(beforeMass, (performance.now() - held.started) / 1000);
    const after = addPaint(before, held.index, amount);
    const path = pourPath(palette, before, held.index, amount);
    const nextPours = s.pours + 1;
    // Lock before React renders so overlapping key/pointer events cannot pour twice.
    live.current = { ...s, phase: 'flight', pours: nextPours, quantities: after };
    setPhase('flight'); setPours(nextPours);
    setAnnouncement(`Pour ${nextPours}: ${palette[held.index].name}.`);
    scene.current.launch(path, beforeMass, totalMass(after), () => {
      const result = mixtureColor(palette, after);
      const landed = colorDistance(result, s.hole.target) <= s.hole.tolerance;
      setQuantities(after); setPhase(landed ? 'landed' : 'rest');
      if (landed) {
        scene.current?.celebrate();
        setResults((current) => current.map((round, i) => i === s.levelIndex ? round.map((score, j) => j === s.hole.stage ? Math.min(score ?? Infinity, nextPours) : score) : round));
        setAnnouncement(`Landed in ${nextPours} pours. Guide par ${s.hole.par}.`);
      } else setAnnouncement(`${beforeMass ? 'Settled' : 'Base chosen'}. ${nearestNotation(result)}. Choose a paint and hold to pour.`);
    });
  }, []);

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
        scene.current.charge(palette[held.index].rgb, chargeAmount(mass, seconds) / Math.max(1, mass), chargePower(seconds), tangent);
        if (now - lastUI > 25) { setCharged(seconds); lastUI = now; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancelCharge(); setHelp(false); return; }
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
  }, [begin, release, cancelCharge]);

  const startHole = (index: number, same = false, stage = index === levelIndex ? hole.stage : 0) => {
    cancelCharge(); setReady(false); setError(false); setSelected(0); setPours(0); setPhase('intro'); setHelp(false);
    setQuantities(PLAY_LEVELS[index].paints.map(() => 0)); setLevelIndex(index);
    // New object also restarts an identical cached hole and its scene effect.
    setHole({ ...generateHole(index, same ? hole.seed : crypto.getRandomValues(new Uint32Array(1))[0], stage) });
    setAnnouncement(`Hole ${stage + 1} of ${HOLES_PER_PALETTE}. Arriving in color space.`);
  };
  const nextHole = () => hole.stage < HOLES_PER_PALETTE - 1
    ? startHole(levelIndex, true, hole.stage + 1)
    : startHole((levelIndex + 1) % PLAY_LEVELS.length, false, 0);
  const controls = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId); begin(index, `pointer:${event.pointerId}`);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); release(`pointer:${event.pointerId}`); },
    onPointerCancel: cancelCharge,
    onLostPointerCapture: () => { if (charge.current?.source.startsWith('pointer:')) cancelCharge(); },
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 && !charge.current) { begin(index, 'accessible'); release('accessible'); }
    },
  });
  const power = charged === null ? 0 : chargePower(charged);
  const amount = charged === null ? 0 : chargeAmount(mass, charged);
  const disabled = !ready || error || phase === 'intro' || phase === 'flight' || phase === 'landed' || help;
  const status = phase === 'intro' ? 'Arriving' : phase === 'seed' ? 'Choose Your Base' : phase === 'flight' ? 'In Motion' : phase === 'landed' ? 'Landed' : distance < hole.tolerance * 2 ? 'Within Reach' : 'Choose Your Next Pour';

  return <section className="paint-play" aria-label="Paint mixing game">
    <div className="play-topline">
      <div className="play-name"><span className="play-eyebrow">Munsell Eye / Play</span><h1>Chroma Glider</h1></div>
      <select className="play-palette-select" aria-label="Palette" value={levelIndex} disabled={phase === 'flight' || charged !== null} onChange={event => startHole(Number(event.target.value))}>{PLAY_LEVELS.map((entry, i) => <option key={entry.name} value={i}>{entry.name}</option>)}</select>
      <div className="play-levels" aria-label="Palette levels">{PLAY_LEVELS.map((entry, i) => <button key={entry.name} type="button" aria-pressed={levelIndex === i} onClick={() => startHole(i)} disabled={phase === 'flight' || charged !== null}><span>{results[i].every(score => score !== null) ? '✓' : `0${i + 1}`}</span>{entry.name}</button>)}</div>
      <div className="play-upper-actions"><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex, true)}>Restart</button><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex)}>New Target ↗</button><button className="play-help-button" aria-label="How to play" aria-expanded={help} onClick={() => { cancelCharge(); setHelp(!help); }} type="button">?</button></div>
    </div>
    <div className="play-world">
      <div className="play-canvas" ref={host} /><div className="play-world-vignette" />
      <div className="play-hud"><div className="play-target-swatch play-guess-swatch"><i style={{ background: mass ? rgbStyle(point.rgb) : '#e2dfd0' }} /><div><span className="play-eyebrow">Your Mixture</span><strong>{mass ? `≈ ${notation}` : 'No Paint Yet'}</strong></div></div><div className="play-target-swatch"><div><span className="play-eyebrow">Destination</span><strong>≈ {hole.notation}</strong></div><i style={{ background: rgbStyle(hole.target.rgb) }} /></div></div>
      <div ref={targetLabel} className="play-target-label" aria-hidden="true"><span className="play-target-arrow">➤</span><span>Destination</span></div>
      <div className="play-score"><span><b>{hole.stage + 1}/{HOLES_PER_PALETTE}</b> Hole</span><span><b>{String(pours).padStart(2, '0')}</b> Pours</span><span><b>{hole.par}</b> Par</span><span><b>{massLabel(mass)}</b> Parts</span></div>
      {phase === 'intro' && ready && <button type="button" className="play-skip-intro" onClick={() => scene.current?.skipIntro()}>Skip Fly-through</button>}
      <div className="play-world-caption"><span>{status}</span><i /><span>{phase === 'seed' ? 'Your first paint starts pure' : 'The mixture carries every pour'}</span></div>
      {!ready && !error && <div className="play-loading">Opening Color Space<span /></div>}
      {error && <div className="play-message"><h2>The 3D View Couldn’t Open</h2><p>Try reopening the view, or use a browser with hardware acceleration enabled.</p><button type="button" onClick={() => startHole(levelIndex, true)}>Reopen View</button></div>}
      {help && <div className="play-message play-instructions"><button className="play-close-help" aria-label="Close instructions" onClick={() => setHelp(false)} type="button">×</button><span className="play-eyebrow">How to Play</span><h2>A Little Paint. A Long Way.</h2><p>Hold a paint, then release. Your first shot carries you from the empty neutral starting point to that pure paint. Every later pour blends into everything you’ve already added.</p><p>The meter sweeps up and returns. Release at the amount you want. A light touch adds a trace; a well-timed full charge adds a large pour. As your mixture grows, the same charge has less influence.</p><p>Settle inside the destination’s translucent boundary. Passing through it doesn’t count. Use keys 1–{level.paints.length}, or hold Space for your selected paint. Escape cancels a charge. Drag the view between shots to look around.</p><p>Each palette has five holes, with more demanding mixtures and smaller landing zones. Landing advances you; par is a personal challenge. All palettes are available to explore.</p><p className="play-fineprint">Guide par comes from sampled recipes. Landing uses OKLab color difference; the map interpolates Munsell samples. Paint behavior uses approximate pigment colors and tinting strengths.</p><button onClick={() => setHelp(false)} type="button">Back to Gliding</button></div>}
      {phase === 'landed' && !help && <div className="play-arrival"><span className="play-eyebrow">{hole.stage === HOLES_PER_PALETTE - 1 ? 'Palette Complete' : `Hole ${hole.stage + 1} Complete`}</span><h2>{pours < hole.par ? 'Beautiful Shortcut.' : pours === hole.par ? 'Right on Par.' : 'Found Your Way.'}</h2><p>{pours} pours · Guide par {hole.par} · {massLabel(mass)} parts</p><div><button type="button" onClick={nextHole}>{hole.stage < HOLES_PER_PALETTE - 1 ? 'Next Hole' : levelIndex < PLAY_LEVELS.length - 1 ? 'Next Palette' : 'Play Again'} <span>↗</span></button><button type="button" className="play-arrival-secondary" onClick={() => startHole(levelIndex, true)}>Replay</button></div></div>}
    </div>
    <div className="play-dock">
      <div className="play-dock-status"><div className="play-charge-control"><div className="play-charge-caption"><span>{charged === null ? 'Hold & Release' : !mass ? 'Pure Base' : power > .8 ? 'Power Pour' : 'Loading Paint'}</span><strong>{charged === null ? '' : `+ ${massLabel(amount)} parts`}</strong></div><div className="play-charge-meter" role="meter" aria-label="Pour power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power * 100)} style={{ '--power': power, '--paint': rgbStyle(level.paints[selected].rgb) } as CSSProperties}><i /><b /></div></div></div>
      <div className="play-paints" data-wide={level.paints.length > 4} style={{ '--paint-count': level.paints.length } as CSSProperties}>{level.paints.map((entry, i) => <button {...controls(i)} data-pour="true" key={entry.id} type="button" disabled={disabled} className={`play-paint ${selected === i ? 'selected' : ''} ${charged !== null && selected === i ? 'charging' : ''}`} style={{ '--paint': rgbStyle(entry.rgb) } as CSSProperties} aria-label={`${i + 1}: ${entry.name}. Hold and release to pour.`} aria-pressed={selected === i}><span className="play-paint-color" /><span className="play-paint-name">{entry.name.replace(' (Green Shade)', '').replace(' (Yellow Shade)', '')}</span></button>)}</div>
      <div className="play-control-hint"><span>{phase === 'flight' ? 'Follow the color as it settles.' : charged !== null ? 'Release to pour · Escape to cancel' : 'Hold a paint. Release to pour.'}</span><span className="play-keyboard-hint">1–{level.paints.length} to pour · Space to repeat</span></div>
      <div className="play-mobile-actions"><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex, true)}>Restart</button><button type="button" disabled={phase === 'flight' || charged !== null} onClick={() => startHole(levelIndex)}>New Target ↗</button></div>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </section>;
}
