'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { HUE_ORDER, MUNSELL_COLORS, MUNSELL_SOURCE, NEUTRALS, type MunsellColor } from './munsell-data';
import { clearAttempts, readAttempts, saveAttempt, type Attempt, type Exercise, type SourceMode } from './progress-db';

const BASIC_HUES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];
const VALUE_OPTIONS = Array.from({ length: 9 }, (_, index) => String(index + 1));
const PRACTICE_CHROMA_MAX = 12;
const CHROMA_OPTIONS = Array.from({ length: PRACTICE_CHROMA_MAX / 2 }, (_, index) => String((index + 1) * 2));
const HUE_TRAINING_VALUE = 7;
const HUE_TRAINING_CHROMA = 8;
const HUE_TRAINING_POOL = HUE_ORDER
  .map((hue) => MUNSELL_COLORS.find((color) => color.h === hue && color.v === HUE_TRAINING_VALUE && color.c === HUE_TRAINING_CHROMA))
  .filter((color): color is MunsellColor => Boolean(color));
const SWATCH_POOL = MUNSELL_COLORS.filter((color) => color.v >= 2 && color.v <= 8 && color.c <= 12);
const IMAGE_COLOR_POOL = MUNSELL_COLORS.filter((color) => color.c <= PRACTICE_CHROMA_MAX);
const HUE_EDGE_COLORS = HUE_ORDER.map((hue) => {
  const colors = MUNSELL_COLORS.filter((color) => color.h === hue);
  return [...colors].sort((a, b) => b.c - a.c || Math.abs(a.v - 6) - Math.abs(b.v - 6))[0];
}).filter((color): color is MunsellColor => Boolean(color));

type AppView = 'practice' | 'reference';

type Region = { x: number; y: number; w: number; h: number; name: string };
type ImagePrompt = {
  id: string;
  src: string;
  title: string;
  category: string;
  credit: string;
  source: string;
  region: Region;
};

const IMAGE_PROMPTS: ImagePrompt[] = [
  { id: 'model-face', src: '/practice/model-study.jpg', title: 'Study of a Model', category: 'Figure', credit: 'Edvard Munch · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Edvard_Munch_-_Study_of_a_Model_(70.1926).jpg', region: { x: 49, y: 24, w: 18, h: 13, name: 'face plane' } },
  { id: 'model-curtain', src: '/practice/model-study.jpg', title: 'Study of a Model', category: 'Figure', credit: 'Edvard Munch · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Edvard_Munch_-_Study_of_a_Model_(70.1926).jpg', region: { x: 78, y: 39, w: 20, h: 20, name: 'curtain mass' } },
  { id: 'studio-coat', src: '/practice/studio-portrait.jpg', title: 'Self-portrait in the Studio', category: 'Studio', credit: 'Michiel van Musscher · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Self-portrait_in_the_studio,_by_Michiel_van_Musscher.jpg', region: { x: 33, y: 61, w: 18, h: 20, name: 'coat mass' } },
  { id: 'studio-hat', src: '/practice/studio-portrait.jpg', title: 'Self-portrait in the Studio', category: 'Studio', credit: 'Michiel van Musscher · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Self-portrait_in_the_studio,_by_Michiel_van_Musscher.jpg', region: { x: 27, y: 36, w: 18, h: 11, name: 'hat' } },
  { id: 'fruit-banana', src: '/practice/still-life-fruit.jpg', title: 'Fruit Study', category: 'Still life', credit: 'Jon Sullivan · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Still_life_fruit.jpg', region: { x: 29, y: 21, w: 28, h: 18, name: 'banana light' } },
  { id: 'fruit-red', src: '/practice/still-life-fruit.jpg', title: 'Fruit Study', category: 'Still life', credit: 'Jon Sullivan · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Still_life_fruit.jpg', region: { x: 68, y: 32, w: 18, h: 23, name: 'red fruit' } },
  { id: 'badlands-sky', src: '/practice/badlands.jpg', title: 'Theodore Roosevelt National Park', category: 'Landscape', credit: 'NPS / Gary Anderson · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Colors_in_Theodore_Roosevelt_NP.jpg', region: { x: 76, y: 23, w: 26, h: 19, name: 'open sky' } },
  { id: 'badlands-rock', src: '/practice/badlands.jpg', title: 'Theodore Roosevelt National Park', category: 'Landscape', credit: 'NPS / Gary Anderson · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Colors_in_Theodore_Roosevelt_NP.jpg', region: { x: 77, y: 61, w: 28, h: 15, name: 'rock face' } },
  { id: 'pomegranate', src: '/practice/fruit-painting.jpg', title: 'Still Life with Fruit', category: 'Still life', credit: 'Jacob van Walscapelle / NGA · CC0', source: 'https://commons.wikimedia.org/wiki/File:Jacob_van_Walscapelle,_Still_Life_with_Fruit,_1675,_NGA_119295.jpg', region: { x: 48, y: 64, w: 24, h: 17, name: 'pomegranate' } },
  { id: 'grapes', src: '/practice/fruit-painting.jpg', title: 'Still Life with Fruit', category: 'Still life', credit: 'Jacob van Walscapelle / NGA · CC0', source: 'https://commons.wikimedia.org/wiki/File:Jacob_van_Walscapelle,_Still_Life_with_Fruit,_1675,_NGA_119295.jpg', region: { x: 72, y: 69, w: 24, h: 22, name: 'grape cluster' } },
  { id: 'summer-field', src: '/practice/summer-landscape.jpg', title: 'A Summer Landscape', category: 'Landscape', credit: 'Georges Seurat / NGA · CC0', source: 'https://commons.wikimedia.org/wiki/File:Georges_Seurat,_A_Summer_Landscape,_1883,_NGA_164962.jpg', region: { x: 66, y: 70, w: 30, h: 24, name: 'field plane' } },
  { id: 'summer-sky', src: '/practice/summer-landscape.jpg', title: 'A Summer Landscape', category: 'Landscape', credit: 'Georges Seurat / NGA · CC0', source: 'https://commons.wikimedia.org/wiki/File:Georges_Seurat,_A_Summer_Landscape,_1883,_NGA_164962.jpg', region: { x: 70, y: 20, w: 30, h: 18, name: 'sky plane' } },
];

const familyOf = (hue: string) => hue.replace(/[\d.]/g, '');
const rgbCss = (color: MunsellColor) => `rgb(${color.rgb.join(',')})`;
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;

function hueDistance(a: string, b: string) {
  const ai = HUE_ORDER.indexOf(a as (typeof HUE_ORDER)[number]);
  const bi = HUE_ORDER.indexOf(b as (typeof HUE_ORDER)[number]);
  if (ai < 0 || bi < 0) return 0;
  const distance = Math.abs(ai - bi);
  return Math.min(distance, HUE_ORDER.length - distance);
}

function weightedChoice<T>(items: T[], weight: (item: T) => number): T {
  const weighted = items.map((item) => ({ item, weight: Math.max(0.1, weight(item)) }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
}

function weaknessWeight(color: MunsellColor, exercise: Exercise, attempts: Attempt[]) {
  const recent = attempts.slice(-160).filter((attempt) => {
    if (exercise === 'value') return attempt.targetV === color.v;
    if (exercise === 'chroma') return attempt.targetC === color.c;
    if (exercise === 'family') return attempt.targetH === color.h;
    return familyOf(attempt.targetH) === familyOf(color.h);
  });
  if (!recent.length) return 1.8;
  const error = recent.reduce((sum, attempt) => {
    if (exercise === 'value') return sum + attempt.valueError;
    if (exercise === 'hue') return sum + attempt.hueError;
    if (exercise === 'chroma') return sum + attempt.chromaError;
    if (exercise === 'family') return sum + attempt.valueError + attempt.chromaError;
    return sum + attempt.valueError + attempt.hueError + attempt.chromaError;
  }, 0) / recent.length;
  const misses = recent.filter((attempt) => !attempt.exact).length / recent.length;
  return 1 + error * 0.45 + misses * 1.6;
}

function Picker({ label, options, value, onChange, compact = false }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const centerTimer = useRef<number | undefined>(undefined);
  const momentumFrame = useRef<number | undefined>(undefined);
  const localSelection = useRef<string | null>(null);
  const drag = useRef({ pointerId: -1, lastX: 0, lastAt: 0, velocity: 0, distance: 0, moved: false });
  const suppressClick = useRef(false);

  const centerOption = useCallback((option: string, behavior: ScrollBehavior = 'smooth') => {
    const container = ref.current;
    const element = container?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(option)}"]`);
    if (!container || !element) return;
    const left = element.offsetLeft + element.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left, behavior });
  }, []);

  useEffect(() => {
    window.clearTimeout(centerTimer.current);
    if (localSelection.current === value) {
      localSelection.current = null;
      return;
    }
    centerTimer.current = window.setTimeout(() => {
      if (drag.current.pointerId === -1 && momentumFrame.current === undefined) centerOption(value, 'auto');
    }, 40);
    return () => window.clearTimeout(centerTimer.current);
  }, [centerOption, value, options]);

  useEffect(() => () => {
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(centerTimer.current);
    if (momentumFrame.current !== undefined) window.cancelAnimationFrame(momentumFrame.current);
  }, []);

  const chooseOption = useCallback((option: string, behavior: ScrollBehavior = 'smooth') => {
    localSelection.current = option;
    onChange(option);
    centerOption(option, behavior);
    window.setTimeout(() => {
      if (localSelection.current === option) localSelection.current = null;
    }, 0);
  }, [centerOption, onChange]);

  const selectClosest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!ref.current) return;
    const center = ref.current.getBoundingClientRect().left + ref.current.clientWidth / 2;
    const buttons = Array.from(ref.current.querySelectorAll<HTMLButtonElement>('button'));
    const closest = buttons.reduce((best, button) => {
      const rect = button.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      return distance < best.distance ? { button, distance } : best;
    }, { button: buttons[0], distance: Number.POSITIVE_INFINITY });
    if (closest.button?.dataset.value) chooseOption(closest.button.dataset.value, behavior);
  }, [chooseOption]);

  const settle = () => {
    if (drag.current.pointerId !== -1 || momentumFrame.current !== undefined) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (drag.current.pointerId === -1 && momentumFrame.current === undefined) selectClosest();
    }, 130);
  };

  const move = (direction: number) => {
    const index = options.indexOf(value);
    const next = options[Math.min(options.length - 1, Math.max(0, index + direction))];
    chooseOption(next);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || drag.current.pointerId !== event.pointerId) return;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    const didMove = drag.current.moved;
    if (didMove) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 180);
    }

    drag.current.pointerId = -1;
    if (!didMove) {
      element.classList.remove('dragging');
      return;
    }

    const finish = () => {
      momentumFrame.current = undefined;
      element.classList.remove('dragging');
      selectClosest();
    };
    let previousFrame = performance.now();
    const glide = (now: number) => {
      const elapsed = Math.min(32, Math.max(8, now - previousFrame));
      previousFrame = now;
      drag.current.velocity *= 0.92 ** (elapsed / 16);
      if (Math.abs(drag.current.velocity) < 0.018) {
        finish();
        return;
      }
      const before = element.scrollLeft;
      element.scrollLeft += drag.current.velocity * elapsed;
      if (Math.abs(element.scrollLeft - before) < 0.1) {
        finish();
        return;
      }
      momentumFrame.current = window.requestAnimationFrame(glide);
    };
    if (Math.abs(drag.current.velocity) >= 0.018) momentumFrame.current = window.requestAnimationFrame(glide);
    else finish();
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || drag.current.pointerId !== event.pointerId) return;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    drag.current.pointerId = -1;
    drag.current.velocity = 0;
    if (momentumFrame.current !== undefined) {
      window.cancelAnimationFrame(momentumFrame.current);
      momentumFrame.current = undefined;
    }
    element.classList.remove('dragging');
    selectClosest();
  };

  return (
    <div className={`answer-picker ${compact ? 'compact' : ''}`}>
      <span className="picker-label">{label}</span>
      <div className="picker-window">
        <span className="picker-focus" aria-hidden="true" />
        <div
          className="picker"
          ref={ref}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={settle}
          onClickCapture={(event) => {
            if (!suppressClick.current) return;
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !ref.current) return;
            window.clearTimeout(settleTimer.current);
            window.clearTimeout(centerTimer.current);
            if (momentumFrame.current !== undefined) {
              window.cancelAnimationFrame(momentumFrame.current);
              momentumFrame.current = undefined;
            }
            ref.current.setPointerCapture(event.pointerId);
            ref.current.classList.add('dragging');
            ref.current.scrollTo({ left: ref.current.scrollLeft, behavior: 'auto' });
            drag.current = { pointerId: event.pointerId, lastX: event.clientX, lastAt: event.timeStamp, velocity: 0, distance: 0, moved: false };
          }}
          onPointerMove={(event) => {
            if (!ref.current || drag.current.pointerId !== event.pointerId) return;
            const movement = event.clientX - drag.current.lastX;
            const elapsed = Math.max(8, event.timeStamp - drag.current.lastAt);
            drag.current.distance += Math.abs(movement);
            if (drag.current.distance > 3) drag.current.moved = true;
            if (drag.current.moved) {
              event.preventDefault();
              ref.current.scrollLeft -= movement;
              const instantaneousVelocity = -movement / elapsed;
              drag.current.velocity = drag.current.velocity * 0.35 + instantaneousVelocity * 0.65;
            }
            drag.current.lastX = event.clientX;
            drag.current.lastAt = event.timeStamp;
          }}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1); }
          }}
        >
          {options.map((option) => (
            <button
              className={value === option ? 'selected' : ''}
              data-value={option}
              key={option}
              onClick={() => chooseOption(option)}
              role="option"
              aria-selected={value === option}
              tabIndex={-1}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function rgbToOklab(rgb: [number, number, number]) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.4122214708 * linear[0] + 0.5363325363 * linear[1] + 0.0514459929 * linear[2];
  const m = 0.2119034982 * linear[0] + 0.6806995451 * linear[1] + 0.1073969566 * linear[2];
  const s = 0.0883024619 * linear[0] + 0.2817188376 * linear[1] + 0.6299787005 * linear[2];
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function nearestColor(rgb: [number, number, number], candidates: MunsellColor[]) {
  let best = candidates[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  const source = rgbToOklab(rgb);
  for (const candidate of candidates) {
    const target = rgbToOklab(candidate.rgb);
    const distance = (source[0] - target[0]) ** 2 + (source[1] - target[1]) ** 2 + (source[2] - target[2]) ** 2;
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

function PosterizedImage({ prompt, exercise, onColor }: {
  prompt: ImagePrompt;
  exercise: Exercise;
  onColor: (color: MunsellColor) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.src = prompt.src;
    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const maxWidth = 700;
      const maxHeight = 520;
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const data = context.getImageData(0, 0, width, height);
      const pixels = data.data;
      const count = width * height;
      const clusterCount = exercise === 'value' ? 9 : 28;
      const centers: number[][] = [];
      for (let index = 0; index < clusterCount; index++) {
        const seedPoint = (0.071 + index * 0.61803398875) % 1;
        const pixel = Math.min(count - 1, Math.floor(count * seedPoint)) * 4;
        centers.push([pixels[pixel], pixels[pixel + 1], pixels[pixel + 2]]);
      }
      const labels = new Uint8Array(count);
      for (let iteration = 0; iteration < 6; iteration++) {
        const sums = Array.from({ length: clusterCount }, () => [0, 0, 0, 0]);
        for (let pixel = 0; pixel < count; pixel += 3) {
          const offset = pixel * 4;
          let best = 0;
          let distance = Number.POSITIVE_INFINITY;
          for (let cluster = 0; cluster < clusterCount; cluster++) {
            const center = centers[cluster];
            const next = (pixels[offset] - center[0]) ** 2 + (pixels[offset + 1] - center[1]) ** 2 + (pixels[offset + 2] - center[2]) ** 2;
            if (next < distance) { distance = next; best = cluster; }
          }
          const sum = sums[best];
          sum[0] += pixels[offset]; sum[1] += pixels[offset + 1]; sum[2] += pixels[offset + 2]; sum[3] += 1;
        }
        sums.forEach((sum, index) => {
          if (sum[3]) centers[index] = [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]];
        });
      }
      const candidates = exercise === 'value' ? NEUTRALS : IMAGE_COLOR_POOL;
      const mapped = centers.map((center) => nearestColor(center as [number, number, number], candidates));
      const regionCounts = new Array(clusterCount).fill(0);
      const region = prompt.region;
      for (let pixel = 0; pixel < count; pixel++) {
        const offset = pixel * 4;
        let best = 0;
        let distance = Number.POSITIVE_INFINITY;
        for (let cluster = 0; cluster < clusterCount; cluster++) {
          const center = centers[cluster];
          const next = (pixels[offset] - center[0]) ** 2 + (pixels[offset + 1] - center[1]) ** 2 + (pixels[offset + 2] - center[2]) ** 2;
          if (next < distance) { distance = next; best = cluster; }
        }
        labels[pixel] = best;
        const color = mapped[best].rgb;
        pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        const dx = (x / width * 100 - region.x) / (region.w / 2);
        const dy = (y / height * 100 - region.y) / (region.h / 2);
        if (dx * dx + dy * dy <= 1) regionCounts[best] += 1;
      }
      context.putImageData(data, 0, 0);
      const dominant = regionCounts.indexOf(Math.max(...regionCounts));
      if (!cancelled) {
        onColor(mapped[Math.max(0, dominant)]);
        setLoading(false);
      }
    };
    image.onerror = () => setLoading(false);
    return () => { cancelled = true; };
  }, [exercise, onColor, prompt]);

  const { region } = prompt;
  return (
    <div className="image-stage">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} aria-label={`Munsell-mapped ${prompt.title}`} />
        {loading && <div className="image-loading">Preparing image…</div>}
        {!loading && (
          <div
            className="region-outline"
            aria-label={`Highlighted ${region.name}`}
            style={{ left: `${region.x}%`, top: `${region.y}%` }}
          />
        )}
      </div>
    </div>
  );
}

function scoreLabel(error: number, singular: string) {
  return error === 0 ? null : `${error} ${singular}${error === 1 ? '' : 's'} off`;
}

const wrapIndex = (index: number, length: number) => ((index % length) + length) % length;
const normalizeAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;

function HueWheel({ value, onChange }: { value: string; onChange: (hue: string) => void }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, HUE_ORDER.indexOf(value as (typeof HUE_ORDER)[number]));
  const [rotation, setRotation] = useState(0);
  const momentumFrame = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const drag = useRef({ pointerId: -1, lastAngle: 0, lastAt: 0, total: 0, velocity: 0, moved: false });

  useEffect(() => () => {
    if (momentumFrame.current) window.cancelAnimationFrame(momentumFrame.current);
  }, []);

  const angleAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = wheelRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    return Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) * 180 / Math.PI;
  };

  const settleRotation = useCallback((total: number) => {
    const steps = Math.round(total / (360 / HUE_ORDER.length));
    onChange(HUE_ORDER[wrapIndex(activeIndex - steps, HUE_ORDER.length)]);
    setRotation(0);
  }, [activeIndex, onChange]);

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wheel = wheelRef.current;
    if (!wheel || drag.current.pointerId !== event.pointerId) return;
    if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
    drag.current.pointerId = -1;
    if (!drag.current.moved) {
      setRotation(0);
      return;
    }
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 160);
    const glide = () => {
      drag.current.velocity *= 0.94;
      drag.current.total += drag.current.velocity * 16;
      setRotation(drag.current.total);
      if (Math.abs(drag.current.velocity) < 0.012) {
        settleRotation(drag.current.total);
        return;
      }
      momentumFrame.current = window.requestAnimationFrame(glide);
    };
    if (Math.abs(drag.current.velocity) >= 0.012) momentumFrame.current = window.requestAnimationFrame(glide);
    else settleRotation(drag.current.total);
  };

  const move = (amount: number) => onChange(HUE_ORDER[wrapIndex(activeIndex + amount, HUE_ORDER.length)]);

  return (
    <div
      className="hue-wheel"
      ref={wheelRef}
      role="listbox"
      aria-label="Munsell hue wheel"
      tabIndex={0}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !wheelRef.current) return;
        if (momentumFrame.current) window.cancelAnimationFrame(momentumFrame.current);
        wheelRef.current.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, lastAngle: angleAt(event), lastAt: event.timeStamp, total: 0, velocity: 0, moved: false };
      }}
      onPointerMove={(event) => {
        if (drag.current.pointerId !== event.pointerId) return;
        const nextAngle = angleAt(event);
        const delta = normalizeAngle(nextAngle - drag.current.lastAngle);
        const elapsed = Math.max(8, event.timeStamp - drag.current.lastAt);
        if (Math.abs(delta) > 0.2) drag.current.moved = true;
        if (drag.current.moved) {
          event.preventDefault();
          drag.current.total += delta;
          drag.current.velocity = delta / elapsed;
          setRotation(drag.current.total);
        }
        drag.current.lastAngle = nextAngle;
        drag.current.lastAt = event.timeStamp;
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {HUE_ORDER.map((hue, index) => {
        const relative = normalizeAngle((index - activeIndex) * (360 / HUE_ORDER.length));
        const position = relative + rotation;
        const color = HUE_EDGE_COLORS[index];
        return (
          <button
            aria-label={`Select hue ${hue}`}
            aria-selected={hue === value}
            className="hue-wheel-chip"
            key={hue}
            onClick={() => onChange(hue)}
            role="option"
            style={{ '--position': `${position}deg`, '--chip-color': rgbCss(color) } as CSSProperties}
            tabIndex={-1}
            type="button"
          />
        );
      })}
      <span className="hue-wheel-indicator" aria-hidden="true" />
      <div className="hue-wheel-center">
        <span>Selected hue</span>
        <div>
          <button aria-label="Previous hue" onClick={() => move(-1)} type="button">‹</button>
          <strong>{value}</strong>
          <button aria-label="Next hue" onClick={() => move(1)} type="button">›</button>
        </div>
        <small>Drag to rotate</small>
      </div>
    </div>
  );
}

function ReferenceView() {
  const [hue, setHue] = useState('7.5Y');
  const hueColors = useMemo(() => MUNSELL_COLORS.filter((color) => color.h === hue), [hue]);
  const [selectedChip, setSelectedChip] = useState<MunsellColor>(() => HUE_TRAINING_POOL.find((color) => color.h === '7.5Y') ?? HUE_TRAINING_POOL[0]);
  const maxChroma = Math.max(2, ...hueColors.map((color) => color.c));
  const chromas = Array.from({ length: maxChroma / 2 + 1 }, (_, index) => index * 2);

  const changeHue = (nextHue: string) => {
    const nextColors = MUNSELL_COLORS.filter((color) => color.h === nextHue);
    const nextChip = nextColors.find((color) => color.v === HUE_TRAINING_VALUE && color.c === HUE_TRAINING_CHROMA) ?? nextColors[0];
    setHue(nextHue);
    if (nextChip) setSelectedChip(nextChip);
  };

  return (
    <section className="reference-view" aria-labelledby="reference-title">
      <div className="reference-intro">
        <span className="eyebrow">Reference</span>
        <h1 id="reference-title">The 40 Munsell hues</h1>
        <p>Rotate the wheel, then study one constant-hue page. Value rises vertically; chroma moves outward from neutral.</p>
      </div>

      <HueWheel value={hue} onChange={changeHue} />

      <div className="reference-readout" aria-live="polite">
        <div>
          <span>Selected chip</span>
          <strong>{notation(selectedChip)}</strong>
        </div>
        <span className="reference-readout-swatch" style={{ background: rgbCss(selectedChip) }} />
        <div>
          <span>Hue training slice</span>
          <strong>V{HUE_TRAINING_VALUE} / C{HUE_TRAINING_CHROMA}</strong>
        </div>
      </div>

      <section className="hue-page" aria-label={`${hue} value and chroma chart`}>
        <div className="hue-page-head">
          <div><span className="eyebrow">Constant hue</span><h2>{hue}</h2></div>
          <span>Practice C2–C12 · extended chips included</span>
        </div>
        <div className="hue-chart-scroll">
          <div className="hue-chart" style={{ '--chart-columns': chromas.length } as CSSProperties}>
            <span className="chart-corner">V/C</span>
            {chromas.map((chroma) => <span className="chart-label" key={`head-${chroma}`}>{chroma === 0 ? 'N' : `/${chroma}`}</span>)}
            {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((value) => (
              <div className="chart-row" key={value}>
                <span className="chart-value">{value}</span>
                {chromas.map((chroma) => {
                  const color = chroma === 0 ? NEUTRALS[value - 1] : hueColors.find((entry) => entry.v === value && entry.c === chroma);
                  return color ? (
                    <button
                      aria-label={notation(color)}
                      className={`chart-chip ${selectedChip.h === color.h && selectedChip.v === color.v && selectedChip.c === color.c ? 'selected' : ''}`}
                      key={`${value}-${chroma}`}
                      onClick={() => setSelectedChip(color)}
                      style={{ background: rgbCss(color) }}
                      title={notation(color)}
                      type="button"
                    />
                  ) : <span className="chart-chip empty" key={`${value}-${chroma}`} />;
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<AppView>('practice');
  const [source, setSource] = useState<SourceMode>('swatch');
  const [exercise, setExercise] = useState<Exercise>('value');
  const [familyHue, setFamilyHue] = useState('5RP');
  const [target, setTarget] = useState<MunsellColor>(NEUTRALS[4]);
  const [imagePrompt, setImagePrompt] = useState<ImagePrompt>(IMAGE_PROMPTS[0]);
  const [imageReady, setImageReady] = useState(true);
  const [answerH, setAnswerH] = useState('5YR');
  const [answerV, setAnswerV] = useState('5');
  const [answerC, setAnswerC] = useState('4');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [submitted, setSubmitted] = useState<Attempt | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [sessionCount, setSessionCount] = useState(1);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    readAttempts().then(setAttempts).catch(() => undefined);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  const resetAnswer = useCallback(() => {
    setAnswerH('5YR');
    setAnswerV('5');
    setAnswerC('4');
    setSubmitted(null);
    startedAt.current = Date.now();
  }, []);

  const nextQuestion = useCallback((nextSource = source, nextExercise = exercise, nextFamilyHue = familyHue) => {
    resetAnswer();
    if (nextSource === 'image' && nextExercise !== 'family') {
      const choices = IMAGE_PROMPTS.filter((prompt) => prompt.id !== imagePrompt.id);
      setImagePrompt(choices[Math.floor(Math.random() * choices.length)] ?? IMAGE_PROMPTS[0]);
      setImageReady(false);
    } else {
      const pool = nextExercise === 'value'
        ? NEUTRALS
        : nextExercise === 'hue'
          ? HUE_TRAINING_POOL
          : nextExercise === 'family'
            ? IMAGE_COLOR_POOL.filter((color) => color.h === nextFamilyHue)
            : SWATCH_POOL;
      setTarget(weightedChoice(pool, (color) => weaknessWeight(color, nextExercise, attempts)));
      setImageReady(true);
    }
  }, [attempts, exercise, familyHue, imagePrompt.id, resetAnswer, source]);

  const changeSource = (next: SourceMode) => {
    if (exercise === 'family') return;
    setSource(next);
    nextQuestion(next, exercise, familyHue);
  };

  const changeExercise = (next: Exercise) => {
    const nextSource = next === 'family' ? 'swatch' : source;
    setExercise(next);
    if (next === 'family') setSource('swatch');
    nextQuestion(nextSource, next, familyHue);
  };

  const changeFamilyHue = (next: string) => {
    setFamilyHue(next);
    nextQuestion('swatch', 'family', next);
  };

  const handleImageColor = useCallback((color: MunsellColor) => {
    setTarget(color);
    setImageReady(true);
  }, []);

  const submit = async () => {
    if (!imageReady || submitted) return;
    const hueError = target.h === 'N' || exercise === 'family' ? 0 : hueDistance(answerH, target.h);
    const valueError = Math.abs(Number(answerV) - target.v);
    const chromaError = target.c === 0 ? 0 : Math.abs(Number(answerC) - target.c) / 2;
    const exact = exercise === 'value'
      ? valueError === 0
      : exercise === 'hue'
        ? hueError === 0
        : exercise === 'chroma'
          ? chromaError === 0
          : exercise === 'family'
            ? valueError === 0 && chromaError === 0
            : hueError === 0 && valueError === 0 && chromaError === 0;
    const attempt: Attempt = {
      createdAt: Date.now(),
      source,
      exercise,
      targetH: target.h,
      targetV: target.v,
      targetC: target.c,
      answerH: exercise === 'family' ? familyHue : answerH,
      answerV: Number(answerV),
      answerC: Number(answerC),
      hueError,
      valueError,
      chromaError,
      exact,
      responseMs: Date.now() - startedAt.current,
    };
    setSubmitted(attempt);
    setAttempts((current) => [...current, attempt].slice(-600));
    await saveAttempt(attempt).catch(() => undefined);
  };

  const advanceQuestion = () => {
    setSessionCount((count) => count + 1);
    nextQuestion();
  };

  useEffect(() => {
    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || progressOpen || view !== 'practice') return;
      const element = event.target as HTMLElement | null;
      if (element?.closest('input, textarea, select, a')) return;
      event.preventDefault();
      if (submitted) advanceQuestion();
      else void submit();
    };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  });

  const hueOptions = HUE_ORDER;
  const promptText = exercise === 'value'
    ? 'Identify this value'
    : exercise === 'hue'
      ? 'Identify this hue'
      : exercise === 'chroma'
        ? 'Identify this chroma'
        : exercise === 'family'
          ? `Identify value & chroma within ${familyHue}`
          : 'Identify hue, value & chroma';
  const visibleAnswer = exercise === 'value'
    ? `N${answerV}`
    : exercise === 'hue'
      ? answerH
      : exercise === 'chroma'
        ? `/${answerC}`
        : exercise === 'family'
          ? `${familyHue} ${answerV}/${answerC}`
          : `${answerH} ${answerV}/${answerC}`;

  const statistics = useMemo(() => {
    const total = attempts.length;
    const exact = attempts.filter((attempt) => attempt.exact).length;
    const hueAttempts = attempts.filter((attempt) => attempt.exercise === 'hue' || attempt.exercise === 'full');
    const valueAttempts = attempts.filter((attempt) => attempt.exercise === 'value' || attempt.exercise === 'family' || attempt.exercise === 'full');
    const chromaAttempts = attempts.filter((attempt) => attempt.exercise === 'chroma' || attempt.exercise === 'family' || attempt.exercise === 'full');
    const average = (rows: Attempt[], key: 'hueError' | 'valueError' | 'chromaError') => rows.length ? rows.reduce((sum, attempt) => sum + attempt[key], 0) / rows.length : 0;
    const hueGroups = BASIC_HUES.map((family) => {
      const rows = hueAttempts.filter((attempt) => familyOf(attempt.targetH) === family && attempt.targetH !== 'N');
      return { family, count: rows.length, error: rows.length ? rows.reduce((sum, row) => sum + row.hueError, 0) / rows.length : 0 };
    }).filter((group) => group.count);
    const weakHue = [...hueGroups].sort((a, b) => b.error - a.error)[0];
    const valueBias = valueAttempts.length ? valueAttempts.reduce((sum, attempt) => sum + attempt.answerV - attempt.targetV, 0) / valueAttempts.length : 0;
    const chromaBias = chromaAttempts.length ? chromaAttempts.reduce((sum, attempt) => sum + attempt.answerC - attempt.targetC, 0) / chromaAttempts.length : 0;
    const insights = [
      weakHue && weakHue.error > 0 ? `${weakHue.family} is currently your least certain hue family.` : 'No persistent hue confusion yet.',
      Math.abs(valueBias) >= 0.2 ? `You tend to judge values ${valueBias > 0 ? 'lighter' : 'darker'} than the target.` : 'Your value guesses are not showing a directional bias.',
      Math.abs(chromaBias) >= 0.5 ? `You tend to judge chroma ${chromaBias > 0 ? 'higher' : 'lower'} than the target.` : 'Your chroma guesses are balanced so far.',
    ];
    return { total, exactRate: total ? exact / total : 0, hueAverage: average(hueAttempts, 'hueError'), valueAverage: average(valueAttempts, 'valueError'), chromaAverage: average(chromaAttempts, 'chromaError'), insights };
  }, [attempts]);

  const feedbackErrors = submitted ? [
    (exercise === 'hue' || exercise === 'full') && scoreLabel(submitted.hueError, 'hue step'),
    (exercise === 'value' || exercise === 'family' || exercise === 'full') && scoreLabel(submitted.valueError, 'value step'),
    (exercise === 'chroma' || exercise === 'family' || exercise === 'full') && scoreLabel(submitted.chromaError, 'chroma step'),
  ].filter(Boolean) : [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Munsell Eye</span>
        </div>
        <nav className="top-actions" aria-label="App sections">
          <button className={view === 'practice' ? 'active' : ''} onClick={() => setView('practice')} type="button">Practice</button>
          <button className={view === 'reference' ? 'active' : ''} onClick={() => setView('reference')} type="button">Reference</button>
          <button className="quiet-button" type="button" onClick={() => setProgressOpen(true)}>Progress</button>
        </nav>
      </header>

      {view === 'practice' ? (
        <section className="workspace" aria-label="Color identification practice">
        <div className="mode-row">
          <div className="segmented" aria-label="Question source">
            {(['swatch', 'image'] as SourceMode[]).map((mode) => (
              <button
                className={source === mode ? 'active' : ''}
                disabled={exercise === 'family' && mode === 'image'}
                key={mode}
                onClick={() => changeSource(mode)}
                title={exercise === 'family' && mode === 'image' ? 'Family practice uses discrete swatches' : undefined}
                type="button"
              >
                {mode === 'swatch' ? 'Swatch' : 'Image'}
              </button>
            ))}
          </div>
          <span className="question-count">Practice {sessionCount}</span>
        </div>

        <nav className="exercise-tabs" aria-label="Exercise">
          {([
            ['value', 'Value'],
            ['hue', 'Hue'],
            ['chroma', 'Chroma'],
            ['family', 'Family'],
            ['full', 'Full H/V/C'],
          ] as [Exercise, string][]).map(([mode, label]) => (
            <button className={exercise === mode ? 'active' : ''} key={mode} onClick={() => changeExercise(mode)} type="button">{label}</button>
          ))}
        </nav>

        {exercise === 'family' && (
          <div className="family-control">
            <Picker label="Fixed hue family" options={HUE_ORDER} value={familyHue} onChange={changeFamilyHue} />
            <small>All valid V1–V9 chips through C12 in this hue.</small>
          </div>
        )}

        <div className="prompt-copy">
          <div>
            <span>{promptText}</span>
            {source === 'image' && <small>{imagePrompt.region.name}</small>}
          </div>
          <span className="difficulty">{exercise === 'value' ? 'N1–N9' : exercise === 'hue' ? source === 'swatch' ? '40 HUES · V7/C8' : '40 HUES' : exercise === 'family' ? `${familyHue} · C2–C12` : exercise === 'full' ? 'H / V / C · C2–C12' : 'C2–C12'}</span>
        </div>

        {source === 'swatch' ? (
          <div className="swatch-stage" aria-label="Color swatch">
            <div className="swatch" style={{ background: rgbCss(target) }} />
          </div>
        ) : (
          <>
            <PosterizedImage prompt={imagePrompt} exercise={exercise} onColor={handleImageColor} />
            <div className="image-caption">
              <span><strong>{imagePrompt.title}</strong> · {imagePrompt.category}</span>
              <a href={imagePrompt.source} target="_blank" rel="noreferrer">{imagePrompt.credit}</a>
            </div>
          </>
        )}

        <section className="answer-panel" aria-label="Your answer">
          {!submitted ? (
            <>
              <p>Your answer</p>
              <div className={`picker-grid ${exercise === 'full' ? 'full' : exercise === 'family' ? 'family' : ''}`}>
                {(exercise === 'hue' || exercise === 'full') && <Picker label="Hue" options={hueOptions} value={answerH} onChange={setAnswerH} compact={exercise === 'full'} />}
                {(exercise === 'value' || exercise === 'family' || exercise === 'full') && <Picker label="Value" options={VALUE_OPTIONS} value={answerV} onChange={setAnswerV} compact={exercise === 'full' || exercise === 'family'} />}
                {(exercise === 'chroma' || exercise === 'family' || exercise === 'full') && <Picker label="Chroma" options={CHROMA_OPTIONS} value={answerC} onChange={setAnswerC} compact={exercise === 'full' || exercise === 'family'} />}
              </div>
              <button className="check-button" disabled={!imageReady} onClick={submit} type="button">{imageReady ? 'Check answer' : 'Preparing image…'}</button>
            </>
          ) : (
            <div className={`feedback ${submitted.exact ? 'correct' : ''}`} role="status" aria-live="polite">
              <div className="feedback-head">
                <div>
                  <span className="feedback-kicker">{submitted.exact ? 'Exact' : 'Take another look'}</span>
                  <strong>{notation(target)}</strong>
                </div>
                <span className="feedback-swatch" style={{ background: rgbCss(target) }} />
              </div>
              <div className="feedback-detail">
                <span>Your answer: {visibleAnswer}</span>
                <span>{feedbackErrors.length ? feedbackErrors.join(' · ') : 'All selected dimensions are correct.'}</span>
              </div>
              <button className="check-button" onClick={advanceQuestion} type="button">Next</button>
            </div>
          )}
        </section>
        </section>
      ) : <ReferenceView />}

      {progressOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProgressOpen(false); }}>
          <section className="progress-sheet" role="dialog" aria-modal="true" aria-labelledby="progress-title">
            <div className="sheet-head">
              <div><span className="eyebrow">On this device</span><h2 id="progress-title">Your eye, over time</h2></div>
              <button className="close-button" onClick={() => setProgressOpen(false)} type="button" aria-label="Close progress">×</button>
            </div>
            <div className="stat-grid">
              <div><strong>{statistics.total}</strong><span>answers</span></div>
              <div><strong>{Math.round(statistics.exactRate * 100)}%</strong><span>exact</span></div>
              <div><strong>{statistics.valueAverage.toFixed(1)}</strong><span>value steps</span></div>
              <div><strong>{statistics.hueAverage.toFixed(1)}</strong><span>hue steps</span></div>
            </div>
            <div className="insights">
              <span className="eyebrow">Current pattern</span>
              {statistics.total ? statistics.insights.map((insight) => <p key={insight}>{insight}</p>) : <p>Complete a few questions and your weak areas will appear here.</p>}
            </div>
            <div className="source-note">
              <p>{MUNSELL_SOURCE}</p>
              <p>Progress stays in this browser. Clearing site data removes it.</p>
            </div>
            {statistics.total > 0 && <button className="reset-button" type="button" onClick={async () => { if (window.confirm('Erase all saved practice history on this device?')) { await clearAttempts(); setAttempts([]); } }}>Reset practice history</button>}
          </section>
        </div>
      )}
    </main>
  );
}
