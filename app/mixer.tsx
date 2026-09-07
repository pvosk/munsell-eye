'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { HUE_ORDER, NEUTRALS, type MunsellColor } from './munsell-data';
import { PRACTICAL_MUNSELL_COLORS as MUNSELL_COLORS } from './munsell-gamut';
import {
  PAINTS,
  paintPairPath,
  recipeMixTrajectory,
  suggestPaintRecipe,
  type PaintPathPoint,
  type PaintRecipe,
} from './paint-mixing';
type MixerMode = 'target' | 'path';
type RGB = [number, number, number];

const rgbCss = (rgb: RGB) => `rgb(${rgb.join(',')})`;
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;
const rgbHex = (rgb: RGB) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
const MIXER_HUE_OPTIONS = HUE_ORDER;
const MIXER_VALUE_OPTIONS = ['1','2','3','4','5','6','7','8','9'];

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

function MixerScrollPicker({ label, options, value, onChange, disabled = false, cyclic = false, fast = false }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  cyclic?: boolean;
  fast?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | undefined>(undefined);
  const settling = useRef<number | undefined>(undefined);
  const scrollSettle = useRef<number | undefined>(undefined);
  const programmatic = useRef(false);
  const localSelection = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const drag = useRef({ id: -1, x: 0, scroll: 0, moved: false });
  const renderedOptions = useMemo(() => cyclic ? [...options, ...options, ...options] : [...options], [cyclic, options]);

  const normalizeCyclicScroll = useCallback(() => {
    const container = ref.current;
    if (!cyclic || !container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    if (buttons.length < options.length * 3) return;
    const middleStart = buttons[options.length].offsetLeft;
    const finalStart = buttons[options.length * 2].offsetLeft;
    const cycleWidth = finalStart - middleStart;
    const middle = container.scrollLeft + container.clientWidth / 2;
    if (middle < middleStart) container.scrollLeft += cycleWidth;
    else if (middle >= finalStart) container.scrollLeft -= cycleWidth;
  }, [cyclic, options.length]);

  const center = useCallback((option: string, behavior: ScrollBehavior = 'smooth', preferMiddle = false) => {
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLButtonElement>(`[data-mixer-value="${CSS.escape(option)}"]`));
    const middle = container.scrollLeft + container.clientWidth / 2;
    const item = preferMiddle && cyclic
      ? items[Math.floor(items.length / 2)]
      : items.reduce((best, candidate) => Math.abs(candidate.offsetLeft + candidate.offsetWidth / 2 - middle) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - middle) ? candidate : best, items[0]);
    if (!item) return;
    programmatic.current = true;
    container.scrollTo({ left: item.offsetLeft + item.offsetWidth / 2 - container.clientWidth / 2, behavior });
    window.clearTimeout(settling.current);
    settling.current = window.setTimeout(() => { programmatic.current = false; }, behavior === 'smooth' ? 260 : 0);
  }, [cyclic]);

  const closest = useCallback(() => {
    const container = ref.current;
    if (!container) return null;
    const middle = container.scrollLeft + container.clientWidth / 2;
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).reduce((best, item) => {
      const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - middle);
      return distance < best.distance ? { item, distance } : best;
    }, { item: null as HTMLButtonElement | null, distance: Number.POSITIVE_INFINITY }).item?.dataset.mixerValue ?? null;
  }, []);

  useEffect(() => {
    if (localSelection.current === value) {
      localSelection.current = null;
      return;
    }
    window.cancelAnimationFrame(frame.current ?? 0);
    frame.current = window.requestAnimationFrame(() => center(value, 'auto', cyclic));
    return () => window.cancelAnimationFrame(frame.current ?? 0);
  }, [center, cyclic, options, value]);

  useEffect(() => () => {
    window.clearTimeout(settling.current);
    window.clearTimeout(scrollSettle.current);
  }, []);

  const move = (direction: number) => {
    const index = Math.max(0, options.indexOf(value));
    const raw = index + direction;
    const next = cyclic ? options[(raw + options.length) % options.length] : options[Math.max(0, Math.min(options.length - 1, raw))];
    if (next !== undefined) { localSelection.current = next; onChange(next); center(next); }
  };

  return (
    <div className={`answer-picker mixer-scroll-picker ${disabled ? 'disabled' : ''} ${cyclic ? 'cyclic' : ''} ${fast ? 'fast' : ''}`}>
      <span className="picker-label">{label}</span>
      <div className="picker-window">
        <span className="picker-focus" aria-hidden="true" />
        <div
          aria-disabled={disabled}
          aria-label={label}
          className="picker"
          onClickCapture={(event) => {
            if (!suppressClick.current) return;
            event.preventDefault();
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1); }
          }}
          onPointerDown={(event) => {
            if (disabled || event.pointerType !== 'mouse' || event.button !== 0 || !ref.current) return;
            ref.current.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, scroll: ref.current.scrollLeft, moved: false };
            ref.current.classList.add('dragging');
          }}
          onPointerMove={(event) => {
            if (!ref.current || drag.current.id !== event.pointerId) return;
            const distance = (event.clientX - drag.current.x) * (fast ? 1.32 : 1);
            if (Math.abs(distance) > 3) drag.current.moved = true;
            if (drag.current.moved) { event.preventDefault(); ref.current.scrollLeft = drag.current.scroll - distance; }
          }}
          onPointerUp={(event) => {
            if (!ref.current || drag.current.id !== event.pointerId) return;
            if (ref.current.hasPointerCapture(event.pointerId)) ref.current.releasePointerCapture(event.pointerId);
            ref.current.classList.remove('dragging');
            normalizeCyclicScroll();
            if (drag.current.moved) {
              suppressClick.current = true;
              window.setTimeout(() => { suppressClick.current = false; }, 160);
            }
            drag.current.id = -1;
            const next = closest();
            if (next) { localSelection.current = next; onChange(next); center(next); }
          }}
          onScroll={() => {
            if (disabled || programmatic.current) return;
            normalizeCyclicScroll();
            window.cancelAnimationFrame(frame.current ?? 0);
            frame.current = window.requestAnimationFrame(() => {
              const next = closest();
              if (next && next !== value) { localSelection.current = next; onChange(next); }
            });
            window.clearTimeout(scrollSettle.current);
            scrollSettle.current = window.setTimeout(() => {
              const next = closest();
              if (next) center(next);
            }, 110);
          }}
          ref={ref}
          role="listbox"
          tabIndex={disabled ? -1 : 0}
        >
          {renderedOptions.map((option, index) => <button aria-selected={option === value} className={option === value ? 'selected' : ''} data-mixer-value={option} key={`${option}-${index}`} onClick={() => { if (!disabled) { localSelection.current = option; onChange(option); center(option); } }} role="option" tabIndex={-1} type="button">{option}</button>)}
        </div>
      </div>
    </div>
  );
}

function PathVisual({ points, interactive = false, compact = false, sequence = false }: { points: PaintPathPoint[]; interactive?: boolean; compact?: boolean; sequence?: boolean }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const panDragRef = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const samples = useMemo(() => {
    return points.reduce<Array<PaintPathPoint & { l: number; a: number; b: number; hue: number; chroma: number }>>((result, point) => {
      const [l, a, b] = rgbToOklab(point.rgb);
      const chroma = Math.hypot(a, b);
      const previousHue = result.at(-1)?.hue ?? null;
      let hue = chroma < .004 && previousHue !== null ? previousHue : Math.atan2(b, a);
      if (previousHue !== null) {
        while (hue - previousHue > Math.PI) hue -= Math.PI * 2;
        while (hue - previousHue < -Math.PI) hue += Math.PI * 2;
      }
      return [...result, { ...point, l, a, b, hue, chroma }];
    }, []);
  }, [points]);
  const chromaticPlot = useMemo(() => {
    const minHue = Math.min(...samples.map((point) => point.hue)); const maxHue = Math.max(...samples.map((point) => point.hue));
    const minChroma = Math.min(...samples.map((point) => point.chroma)); const maxChroma = Math.max(...samples.map((point) => point.chroma));
    const centerHue = (minHue + maxHue) / 2; const centerChroma = (minChroma + maxChroma) / 2;
    const hueSpan = Math.max(maxHue - minHue, interactive ? .035 : .075) * 1.3 / zoom;
    const chromaSpan = Math.max(maxChroma - minChroma, interactive ? .006 : .014) * 1.3 / zoom;
    return samples.map((point) => ({
      ...point,
      x: 50 + (point.hue - centerHue) / hueSpan * 82 + pan.x,
      y: 50 - (point.chroma - centerChroma) / chromaSpan * 82 + pan.y,
    }));
  }, [interactive, pan, samples, zoom]);
  const valuePlot = useMemo(() => {
    const min = Math.min(...samples.map((point) => point.l)); const max = Math.max(...samples.map((point) => point.l));
    const center = (min + max) / 2; const span = Math.max(max - min, interactive ? .018 : .05) * 1.3 / zoom;
    return samples.map((point, index) => ({ ...point, x: 8 + (points.length <= 1 ? .5 : index / (points.length - 1)) * 84 + pan.x, y: 50 - (point.l - center) / span * 82 + pan.y }));
  }, [interactive, pan, points.length, samples, zoom]);
  const updateZoom = useCallback((requested: number) => {
    const next = Math.max(1, Math.min(3, requested));
    zoomRef.current = next;
    setZoom(next);
  }, []);
  const updatePan = useCallback((x: number, y: number) => {
    const next = { x: Math.max(-34, Math.min(34, x)), y: Math.max(-34, Math.min(34, y)) };
    panRef.current = next;
    setPan(next);
  }, []);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !interactive) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const next = zoomRef.current * Math.exp(-event.deltaY * .0024);
      if ((zoomRef.current <= 1 && next <= 1) || (zoomRef.current >= 3 && next >= 3)) return;
      event.preventDefault();
      updateZoom(next);
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => surface.removeEventListener('wheel', wheel);
  }, [interactive, updateZoom]);
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size === 1) {
      panDragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
    }
    if (pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)), zoom: zoomRef.current };
      panDragRef.current = null;
    }
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      event.preventDefault();
      const [first, second] = [...pointersRef.current.values()];
      updateZoom(pinchRef.current.zoom * Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)) / pinchRef.current.distance);
      return;
    }
    const drag = panDragRef.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (drag?.id === event.pointerId && bounds.width && bounds.height) {
      event.preventDefault();
      updatePan(drag.panX + (event.clientX - drag.x) / bounds.width * 100, drag.panY + (event.clientY - drag.y) / bounds.height * 100);
    }
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panDragRef.current?.id === event.pointerId) panDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const segments = (plot: typeof chromaticPlot, prefix: string) => plot.slice(0, -1).map((point, index) => {
    const next = plot[index + 1]; const dx = next.x - point.x; const dy = next.y - point.y;
    return <span className={`mix-map-segment ${next.role === 'target' ? 'to-target' : ''}`} key={`${prefix}-${index}`} style={{ left: `${point.x}%`, top: `${point.y}%`, width: `${Math.hypot(dx, dy)}%`, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)` }} />;
  });
  const dots = (plot: typeof chromaticPlot, prefix: string) => plot.map((point, index) => (
    <span aria-label={point.label} className={`mix-path-point ${index === 0 || index === plot.length - 1 ? 'endpoint' : ''} ${point.role === 'target' ? 'target' : ''}`} key={`${prefix}-${index}`} role="img" style={{ background: rgbCss(point.rgb), left: `${point.x}%`, top: `${point.y}%` }} title={point.label} />
  ));
  return (
    <div className={`mix-path-visual ${compact ? 'compact' : ''}`}>
      <div className="mix-path-strip" aria-label="Mixing path swatches" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => <span key={index} style={{ background: rgbCss(point.rgb) }} title={point.label} />)}
      </div>
      <div className={`mix-path-projections ${interactive ? 'interactive' : ''}`} onPointerCancel={pointerEnd} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} ref={surfaceRef}>
        <section className="mix-projection"><header><strong>Hue + Chroma</strong><small>Hue Across · Chroma Up</small></header><div className="mix-coordinate-map" aria-label="Auto-framed mixing path with hue on the horizontal axis and chroma on the vertical axis">
          <span className="mix-map-axis horizontal" /><span className="mix-map-axis vertical" />
          <span className="mix-map-grid x-one" /><span className="mix-map-grid x-two" /><span className="mix-map-grid y-one" /><span className="mix-map-grid y-two" />
          {segments(chromaticPlot, 'chroma-line')}{dots(chromaticPlot, 'chroma-point')}
          <small className="map-label top">More Chroma</small><small className="map-label right">Hue +</small><small className="map-label bottom">Neutral</small><small className="map-label left">Hue −</small>
        </div></section>
        <section className="mix-projection"><header><strong>Value</strong><small>Across the mix</small></header><div className="mix-coordinate-map value-map" aria-label="Auto-framed value change across the mixing path">
          <span className="mix-map-axis horizontal" /><span className="mix-map-grid y-one" /><span className="mix-map-grid y-two" />
          {segments(valuePlot, 'value-line')}{dots(valuePlot, 'value-point')}
          <small className="map-label top">lighter</small><small className="map-label bottom">darker</small><small className="map-label left">{sequence ? 'base' : 'first'}</small><small className="map-label right">{sequence ? 'target' : 'second'}</small>
        </div></section>
      </div>
      {interactive && <small className="mix-gesture-hint">Auto-framed · drag to pan · pinch or ⌘-wheel to zoom{zoom > 1.02 ? ` · ${zoom.toFixed(1)}×` : ''}</small>}
    </div>
  );
}

function RecipeTrajectory({ recipe, target }: { recipe: PaintRecipe; target: MunsellColor }) {
  const ingredients = useMemo(() => [...recipe.ingredients].sort((a, b) => b.parts - a.parts), [recipe]);
  const points = useMemo(() => [
    ...recipeMixTrajectory(recipe),
    { rgb: target.rgb, progress: 1, label: `Target ${notation(target)}`, role: 'target' as const },
  ], [recipe, target]);
  const total = ingredients.reduce((sum, ingredient) => sum + ingredient.parts, 0);
  const stagePositions = ingredients.map((_, index) => (
    index === 0 ? 0 : ingredients.slice(0, index).reduce((sum, ingredient) => sum + ingredient.parts, 0) / Math.max(total, 1) * 100
  ));
  return (
    <section className="recipe-path-card">
      <header><span className="eyebrow">Mixing Trajectory</span><strong>{ingredients.length} Stage{ingredients.length === 1 ? '' : 's'}</strong></header>
      <div className="ingredient-ratio-track">
        <div className="ingredient-ratio-strip" aria-label="Recipe proportions">
          {ingredients.map(({ paint, parts }) => <span key={paint.id} style={{ background: rgbCss(paint.rgb), flexGrow: parts }} title={`${paint.name}: ${parts} of ${total} parts`} />)}
        </div>
        <div className="ingredient-stage-markers" aria-hidden="true">
          {stagePositions.map((position, index) => <i key={index} style={{ left: `${Math.max(2.5, Math.min(94, position))}%` }}>{index + 1}</i>)}
        </div>
      </div>
      <ol className="trajectory-steps">
        {ingredients.map(({ paint }, index) => <li key={paint.id}><i>{index + 1}</i><span>{index ? 'Add' : 'Begin with'} {paint.name}</span></li>)}
      </ol>
      <PathVisual compact points={points} sequence />
    </section>
  );
}

function Recipe({ recipe }: { recipe: PaintRecipe }) {
  return (
    <section className="mixer-recipe" aria-label="Suggested starting mix">
      <header><span className="eyebrow">Simplest close route</span><h3>Starting Mix</h3></header>
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
  const pairPath = useMemo(() => paintPairPath(firstPaint, secondPaint), [firstPaint, secondPaint]);
  const updateTarget = (hue: string, value: number, chroma: number) => setTarget(nearestNotation(hue, value, chroma));
  const paletteLabel = selectedPaintIds.length === PAINTS.length ? 'Full catalogue' : `${selectedPaintIds.length}-paint palette`;
  const chromaOptions = useMemo(() => target.h === 'N' ? ['0'] : [...new Set(
    MUNSELL_COLORS.filter((color) => color.h === target.h && color.v === target.v).map((color) => color.c),
  )].sort((a, b) => a - b).map(String), [target.h, target.v]);

  const pickScreenColor = (hex: string) => {
    const rgb = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as RGB;
    setTarget(nearestChip(rgb));
  };

  return (
    <section className="mixer-view" aria-labelledby="mixer-title">
      <div className="reference-intro mixer-intro">
        <span className="eyebrow">Mix</span>
        <h1 id="mixer-title">Find a Practical Route to Color</h1>
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
            <div><span className="eyebrow">Two-paint path</span><h2>See What Happens Between the Tubes</h2></div>
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
                <MixerScrollPicker cyclic fast label="Hue" onChange={(hue) => updateTarget(hue, target.v, target.c)} options={MIXER_HUE_OPTIONS} value={target.h} />
                <MixerScrollPicker label="Value" onChange={(value) => updateTarget(target.h, Number(value), target.c)} options={MIXER_VALUE_OPTIONS} value={String(target.v)} />
                <MixerScrollPicker disabled={target.h === 'N'} label="Chroma" onChange={(chroma) => updateTarget(target.h, target.v, Number(chroma))} options={chromaOptions} value={String(target.c)} />
              </div>
            </div>
            <Recipe recipe={recipe} />
          </section>
          <aside className="target-mixer-side">
            <MiniHueFamily target={target} />
            <RecipeTrajectory recipe={recipe} target={target} />
          </aside>
        </div>
      )}
    </section>
  );
}
