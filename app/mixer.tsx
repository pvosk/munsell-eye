'use client';

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
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

function PathVisual({ points }: { points: PaintPathPoint[] }) {
  const plotted = useMemo(() => points.map((point) => {
    const lab = rgbToOklab(point.rgb);
    return { ...point, x: 50 + lab[1] / .33 * 43, y: 50 - lab[2] / .33 * 43 };
  }), [points]);
  return (
    <div className="mix-path-visual">
      <div className="mix-path-strip" aria-label="Mixing path swatches">
        {points.map((point, index) => <span key={index} style={{ background: rgbCss(point.rgb) }} title={point.label} />)}
      </div>
      <div className="mix-polar-map" aria-label="Mixing path in a perceptual hue and chroma plane">
        <span className="mix-map-axis horizontal" /><span className="mix-map-axis vertical" />
        <span className="mix-map-ring one" /><span className="mix-map-ring two" />
        {plotted.slice(0, -1).map((point, index) => {
          const next = plotted[index + 1];
          const dx = next.x - point.x; const dy = next.y - point.y;
          return <span className="mix-map-segment" key={`line-${index}`} style={{ left: `${point.x}%`, top: `${point.y}%`, width: `${Math.hypot(dx, dy)}%`, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)` }} />;
        })}
        {plotted.map((point, index) => (
          <button
            aria-label={point.label}
            className={index === 0 || index === plotted.length - 1 ? 'endpoint' : ''}
            key={`point-${index}`}
            style={{ background: rgbCss(point.rgb), left: `${point.x}%`, top: `${point.y}%` }}
            title={point.label}
            type="button"
          />
        ))}
        <small className="map-label top">yellow</small><small className="map-label right">magenta</small><small className="map-label bottom">blue</small><small className="map-label left">green</small>
      </div>
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
          <PathVisual points={pairPath} />
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
              <PathVisual points={recipePath} />
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
