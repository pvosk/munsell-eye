'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { HUE_ORDER, MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';
import {
  PAINTS,
  paintPairPath,
  recipeMixPath,
  suggestPaintRecipe,
  type PaintPathPoint,
  type PaintRecipe,
} from './paint-mixing';
type MixerMode = 'target' | 'path';
type RGB = [number, number, number];

const rgbCss = (rgb: RGB) => `rgb(${rgb.join(',')})`;
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;
const rgbHex = (rgb: RGB) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

function rgbToOklab(rgb: RGB) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const l = .4122214708 * linear[0] + .5363325363 * linear[1] + .0514459929 * linear[2];
  const m = .2119034982 * linear[0] + .6806995451 * linear[1] + .1073969566 * linear[2];
  const s = .0883024619 * linear[0] + .2817188376 * linear[1] + .6299787005 * linear[2];
  const lr = Math.cbrt(l); const mr = Math.cbrt(m); const sr = Math.cbrt(s);
  return [
    .2104542553 * lr + .793617785 * mr - .0040720468 * sr,
    1.9779984951 * lr - 2.428592205 * mr + .4505937099 * sr,
    .0259040371 * lr + .7827717662 * mr - .808675766 * sr,
  ];
}

const CHIP_LABS = [...MUNSELL_COLORS, ...NEUTRALS].map((color) => ({ color, lab: rgbToOklab(color.rgb) }));

function nearestChip(rgb: RGB) {
  const source = rgbToOklab(rgb);
  return CHIP_LABS.reduce((best, entry) => {
    const distance = (source[0] - entry.lab[0]) ** 2 + (source[1] - entry.lab[1]) ** 2 + (source[2] - entry.lab[2]) ** 2;
    return distance < best.distance ? { color: entry.color, distance } : best;
  }, { color: CHIP_LABS[0].color, distance: Number.POSITIVE_INFINITY }).color;
}

function nearestNotation(hue: string, value: number, chroma: number) {
  if (hue === 'N') return NEUTRALS[Math.max(0, Math.min(8, value - 1))];
  const family = MUNSELL_COLORS.filter((color) => color.h === hue);
  return [...family].sort((a, b) => (
    Math.abs(a.v - value) * 7 + Math.abs(a.c - chroma)
    - Math.abs(b.v - value) * 7 - Math.abs(b.c - chroma)
  ))[0] ?? MUNSELL_COLORS[0];
}

function MiniHueFamily({ target }: { target: MunsellColor }) {
  if (target.h === 'N') {
    return (
      <section className="mixer-family-card neutral-family" aria-label="Munsell neutral value family">
        <header><div><span className="eyebrow">Family location</span><strong>Neutral</strong></div><b>{notation(target)}</b></header>
        <div className="mini-neutral-ladder">
          {[...NEUTRALS].reverse().map((color) => <span className={color.v === target.v ? 'selected' : ''} key={color.v} style={{ background: rgbCss(color.rgb) }} />)}
        </div>
      </section>
    );
  }
  const colors = MUNSELL_COLORS.filter((color) => color.h === target.h);
  const maxChroma = Math.max(2, ...colors.map((color) => color.c));
  const chromas = Array.from({ length: maxChroma / 2 }, (_, index) => (index + 1) * 2);
  return (
    <section className="mixer-family-card" aria-label={`${target.h} Munsell hue family, target at ${notation(target)}`}>
      <header><div><span className="eyebrow">Family location</span><strong>{target.h}</strong></div><b>{notation(target)}</b></header>
      <div className="mini-family-scroll">
        <div className="mini-family-grid" style={{ '--family-columns': chromas.length } as CSSProperties}>
          {[9, 8, 7, 6, 5, 4, 3, 2, 1].flatMap((value) => chromas.map((chroma) => {
            const color = colors.find((entry) => entry.v === value && entry.c === chroma);
            const selected = color && color.v === target.v && color.c === target.c;
            return color
              ? <span className={selected ? 'selected' : ''} key={`${value}-${chroma}`} style={{ background: rgbCss(color.rgb) }} title={notation(color)} />
              : <span className="empty" key={`${value}-${chroma}`} />;
          }))}
        </div>
      </div>
      <small>Value rises · chroma moves right</small>
    </section>
  );
}

function PathVisual({ points, interactive = false, compact = false }: { points: PaintPathPoint[]; interactive?: boolean; compact?: boolean }) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const samples = useMemo(() => points.map((point) => {
    const [l, a, b] = rgbToOklab(point.rgb);
    return { ...point, l, a, b };
  }), [points]);
  const chromaticPlot = useMemo(() => {
    const minA = Math.min(...samples.map((point) => point.a)); const maxA = Math.max(...samples.map((point) => point.a));
    const minB = Math.min(...samples.map((point) => point.b)); const maxB = Math.max(...samples.map((point) => point.b));
    const centerA = (minA + maxA) / 2; const centerB = (minB + maxB) / 2;
    const span = Math.max(maxA - minA, maxB - minB, .045) * 1.45 / zoom;
    return samples.map((point) => ({ ...point, x: 50 + (point.a - centerA) / span * 100, y: 50 - (point.b - centerB) / span * 100 }));
  }, [samples, zoom]);
  const valuePlot = useMemo(() => {
    const min = Math.min(...samples.map((point) => point.l)); const max = Math.max(...samples.map((point) => point.l));
    const center = (min + max) / 2; const span = Math.max(max - min, .07) * 1.4 / zoom;
    return samples.map((point, index) => ({ ...point, x: 8 + (points.length <= 1 ? .5 : index / (points.length - 1)) * 84, y: 50 - (point.l - center) / span * 86 }));
  }, [points.length, samples, zoom]);
  const updateZoom = useCallback((requested: number) => {
    const next = Math.max(1, Math.min(3, requested));
    zoomRef.current = next;
    setZoom(next);
  }, []);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !interactive) return;
    const wheel = (event: WheelEvent) => {
      const next = zoomRef.current * Math.exp(-event.deltaY * .0024);
      if ((zoomRef.current <= 1 && next <= 1) || (zoomRef.current >= 3 && next >= 3)) return;
      event.preventDefault();
      updateZoom(next);
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => surface.removeEventListener('wheel', wheel);
  }, [interactive, updateZoom]);
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== 'touch') return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)), zoom: zoomRef.current };
    }
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size < 2 || !pinchRef.current) return;
    event.preventDefault();
    const [first, second] = [...pointersRef.current.values()];
    updateZoom(pinchRef.current.zoom * Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)) / pinchRef.current.distance);
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const segments = (plot: typeof chromaticPlot, prefix: string) => plot.slice(0, -1).map((point, index) => {
    const next = plot[index + 1]; const dx = next.x - point.x; const dy = next.y - point.y;
    return <span className="mix-map-segment" key={`${prefix}-${index}`} style={{ left: `${point.x}%`, top: `${point.y}%`, width: `${Math.hypot(dx, dy)}%`, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)` }} />;
  });
  const dots = (plot: typeof chromaticPlot, prefix: string) => plot.map((point, index) => (
    <span aria-label={point.label} className={`mix-path-point ${index === 0 || index === plot.length - 1 ? 'endpoint' : ''}`} key={`${prefix}-${index}`} role="img" style={{ background: rgbCss(point.rgb), left: `${point.x}%`, top: `${point.y}%` }} title={point.label} />
  ));
  return (
    <div className={`mix-path-visual ${compact ? 'compact' : ''}`}>
      <div className="mix-path-strip" aria-label="Mixing path swatches">
        {points.map((point, index) => <span key={index} style={{ background: rgbCss(point.rgb) }} title={point.label} />)}
      </div>
      <div className={`mix-path-projections ${interactive ? 'interactive' : ''}`} onPointerCancel={pointerEnd} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} ref={surfaceRef}>
        <section className="mix-projection"><header><strong>Hue + chroma</strong><small>Chromatic plane</small></header><div className="mix-coordinate-map" aria-label="Auto-framed mixing path in a perceptual hue and chroma plane">
          <span className="mix-map-axis horizontal" /><span className="mix-map-axis vertical" />
          <span className="mix-map-grid x-one" /><span className="mix-map-grid x-two" /><span className="mix-map-grid y-one" /><span className="mix-map-grid y-two" />
          {segments(chromaticPlot, 'chroma-line')}{dots(chromaticPlot, 'chroma-point')}
          <small className="map-label top">yellow</small><small className="map-label right">magenta</small><small className="map-label bottom">blue</small><small className="map-label left">green</small>
        </div></section>
        <section className="mix-projection"><header><strong>Value</strong><small>Across the mix</small></header><div className="mix-coordinate-map value-map" aria-label="Auto-framed value change across the mixing path">
          <span className="mix-map-axis horizontal" /><span className="mix-map-grid y-one" /><span className="mix-map-grid y-two" />
          {segments(valuePlot, 'value-line')}{dots(valuePlot, 'value-point')}
          <small className="map-label top">lighter</small><small className="map-label bottom">darker</small><small className="map-label left">first</small><small className="map-label right">second</small>
        </div></section>
      </div>
      {interactive && <small className="mix-gesture-hint">Auto-framed · pinch or wheel to inspect the curve{zoom > 1.02 ? ` · ${zoom.toFixed(1)}×` : ''}</small>}
    </div>
  );
}

function Recipe({ recipe }: { recipe: PaintRecipe }) {
  return (
    <section className="mixer-recipe" aria-label="Suggested starting mix">
      <header><span className="eyebrow">Simplest close route</span><h3>Starting mix</h3></header>
      <ol>
        {recipe.ingredients.map(({ paint, parts }) => (
          <li key={paint.id}>
            <i style={{ background: rgbCss(paint.rgb) }} />
            <span><strong>{paint.name}</strong><small>{paint.pigment} · {paint.opacity.replace('-', ' ')}</small></span>
            <b>{parts} {parts === 1 ? 'part' : 'parts'}</b>
          </li>
        ))}
      </ol>
      <small className="mixer-caveat">A practical starting estimate. Brand, film thickness and lighting will still require adjustment by eye.</small>
    </section>
  );
}

export default function MixerView({ selectedPaintIds, onOpenPalette, initialTarget }: {
  selectedPaintIds: string[];
  onOpenPalette: () => void;
  initialTarget: MunsellColor;
}) {
  const [mode, setMode] = useState<MixerMode>('target');
  const [target, setTarget] = useState(initialTarget);
  const deferredTarget = useDeferredValue(target);
  const selectedPaints = useMemo(() => selectedPaintIds.map((id) => PAINTS.find((paint) => paint.id === id)).filter(Boolean), [selectedPaintIds]);
  const [firstPaint, setFirstPaint] = useState(selectedPaintIds[0] ?? PAINTS[0].id);
  const [secondPaint, setSecondPaint] = useState(selectedPaintIds[1] ?? PAINTS[1].id);

  useEffect(() => {
    const timer = window.setTimeout(() => setTarget(initialTarget), 0);
    return () => window.clearTimeout(timer);
  }, [initialTarget]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedPaintIds.includes(firstPaint)) setFirstPaint(selectedPaintIds[0] ?? PAINTS[0].id);
      if (!selectedPaintIds.includes(secondPaint) || firstPaint === secondPaint) setSecondPaint(selectedPaintIds.find((id) => id !== firstPaint) ?? selectedPaintIds[0] ?? PAINTS[1].id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [firstPaint, secondPaint, selectedPaintIds]);

  const recipe = useMemo(() => suggestPaintRecipe(deferredTarget, selectedPaintIds), [deferredTarget, selectedPaintIds]);
  const recipePath = useMemo(() => recipe ? recipeMixPath(recipe) : [], [recipe]);
  const pairPath = useMemo(() => paintPairPath(firstPaint, secondPaint), [firstPaint, secondPaint]);
  const updateTarget = (hue: string, value: number, chroma: number) => setTarget(nearestNotation(hue, value, chroma));
  const paletteLabel = selectedPaintIds.length === PAINTS.length ? 'Full catalogue' : `${selectedPaintIds.length}-paint palette`;

  const pickScreenColor = (hex: string) => {
    const rgb = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as RGB;
    setTarget(nearestChip(rgb));
  };

  return (
    <section className="mixer-view" aria-labelledby="mixer-title">
      <div className="reference-intro mixer-intro">
        <span className="eyebrow">Mix</span>
        <h1 id="mixer-title">Find a practical route to color</h1>
        <p>Choose one target, then follow the simplest close path available from the paint box you actually use.</p>
      </div>

      <div className="mixer-nav-row">
        <nav className="study-tabs mixer-tabs" aria-label="Mix workspace">
          {([['target', 'Find a mix'], ['path', 'Explore a path']] as const).map(([id, label]) => (
            <button className={mode === id ? 'active' : ''} key={id} onClick={() => setMode(id)} type="button">{label}</button>
                   ))}
        </nav>
        <button className="palette-setting" onClick={onOpenPalette} type="button"><span>{paletteLabel}</span><strong>Change</strong></button>
      </div>

      {mode === 'path' ? (
        <section className="path-workspace">
          <header>
            <div><span className="eyebrow">Two-paint path</span><h2>See what happens between the tubes</h2></div>
            <div className="paint-pair-controls">
              <select aria-label="First paint" onChange={(event) => setFirstPaint(event.target.value)} value={firstPaint}>
                {selectedPaints.map((paint) => paint && <option key={paint.id} value={paint.id}>{paint.name}</option>)}
              </select>
              <span>+</span>
              <select aria-label="Second paint" onChange={(event) => setSecondPaint(event.target.value)} value={secondPaint}>
                {selectedPaints.map((paint) => paint && <option disabled={paint.id === firstPaint} key={paint.id} value={paint.id}>{paint.name}</option>)}
              </select>
            </div>
          </header>
          <PathVisual interactive points={pairPath} />
        </section>
      ) : recipe && (
        <div className="target-mixer-grid">
          <section className="target-mixer-main">
            <div className="target-control-card">
              <div className="target-comparison">
                <div className="target-field" style={{ background: rgbCss(target.rgb) }}>
                  <span style={{ background: rgbCss(recipe.rgb) }}><small>Paint mix</small></span>
                  <b>Target</b>
                </div>
                <div className="target-readout">
                  <span className="eyebrow">Nearest Munsell target</span>
                  <strong>{notation(target)}</strong>
                  <small>{rgbHex(target.rgb)} · screen approximation</small>
                </div>
              </div>
              <div className="target-controls">
                <label className="screen-color-control"><span>Screen color</span><input aria-label="Choose a screen color" onChange={(event) => pickScreenColor(event.target.value)} type="color" value={rgbHex(target.rgb)} /></label>
                <label><span>Hue</span><select onChange={(event) => updateTarget(event.target.value, target.v, target.c)} value={target.h}><option value="N">N</option>{HUE_ORDER.map((hue) => <option key={hue}>{hue}</option>)}</select></label>
                <label><span>Value</span><select onChange={(event) => updateTarget(target.h, Number(event.target.value), target.c)} value={target.v}>{[1,2,3,4,5,6,7,8,9].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span>Chroma</span><select disabled={target.h === 'N'} onChange={(event) => updateTarget(target.h, target.v, Number(event.target.value))} value={target.c}>{(target.h === 'N' ? [0] : Array.from({ length: 12 }, (_, index) => (index + 1) * 2)).map((chroma) => <option key={chroma}>{chroma}</option>)}</select></label>
              </div>
            </div>
            <Recipe recipe={recipe} />
          </section>
          <aside className="target-mixer-side">
            <MiniHueFamily target={target} />
            <section className="recipe-path-card">
              <header><span className="eyebrow">Recommended path</span><strong>{recipe.ingredients.length} paint{recipe.ingredients.length === 1 ? '' : 's'}</strong></header>
              <PathVisual compact points={recipePath} />
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
