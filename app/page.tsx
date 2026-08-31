'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HUE_ORDER, MUNSELL_COLORS, MUNSELL_SOURCE, NEUTRALS, type MunsellColor } from './munsell-data';
import { clearAttempts, readAttempts, saveAttempt, type Attempt, type Exercise, type SourceMode } from './progress-db';

const BASIC_HUES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];
const VALUE_OPTIONS = Array.from({ length: 9 }, (_, index) => String(index + 1));
const CHROMA_OPTIONS = ['2', '4', '6', '8', '10', '12'];
const SWATCH_POOL = MUNSELL_COLORS.filter((color) => color.v >= 2 && color.v <= 8 && color.c <= 10);

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

function hueDistance(a: string, b: string, detailed: boolean) {
  if (!detailed) {
    const ai = BASIC_HUES.indexOf(familyOf(a));
    const bi = BASIC_HUES.indexOf(familyOf(b));
    const distance = Math.abs(ai - bi);
    return Math.min(distance, BASIC_HUES.length - distance);
  }
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
    return familyOf(attempt.targetH) === familyOf(color.h);
  });
  if (!recent.length) return 1.8;
  const error = recent.reduce((sum, attempt) => {
    if (exercise === 'value') return sum + attempt.valueError;
    if (exercise === 'hue') return sum + attempt.hueError;
    if (exercise === 'chroma') return sum + attempt.chromaError;
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

  const centerOption = useCallback((option: string, behavior: ScrollBehavior = 'smooth') => {
    const element = ref.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(option)}"]`);
    element?.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => centerOption(value, 'auto'), 40);
    return () => window.clearTimeout(timer);
  }, [centerOption, value, options]);

  const settle = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!ref.current) return;
      const center = ref.current.getBoundingClientRect().left + ref.current.clientWidth / 2;
      const buttons = Array.from(ref.current.querySelectorAll<HTMLButtonElement>('button'));
      const closest = buttons.reduce((best, button) => {
        const rect = button.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        return distance < best.distance ? { button, distance } : best;
      }, { button: buttons[0], distance: Number.POSITIVE_INFINITY });
      if (closest.button?.dataset.value) onChange(closest.button.dataset.value);
    }, 90);
  };

  const move = (direction: number) => {
    const index = options.indexOf(value);
    const next = options[Math.min(options.length - 1, Math.max(0, index + direction))];
    onChange(next);
    centerOption(next);
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
              onClick={() => { onChange(option); centerOption(option); }}
              role="option"
              aria-selected={value === option}
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

function nearestColor(rgb: [number, number, number], candidates: MunsellColor[]) {
  let best = candidates[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const [r, g, b] = candidate.rgb;
    const distance = (rgb[0] - r) ** 2 * 0.3 + (rgb[1] - g) ** 2 * 0.59 + (rgb[2] - b) ** 2 * 0.11;
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
      const clusterCount = exercise === 'value' ? 7 : 9;
      const centers: number[][] = [];
      const seedPoints = [0.07, 0.19, 0.31, 0.43, 0.57, 0.69, 0.81, 0.91, 0.49];
      for (let index = 0; index < clusterCount; index++) {
        const pixel = Math.min(count - 1, Math.floor(count * seedPoints[index])) * 4;
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
      const candidates = exercise === 'value' ? NEUTRALS : SWATCH_POOL;
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
        <canvas ref={canvasRef} aria-label={`Posterized ${prompt.title}`} />
        {loading && <div className="image-loading">Preparing image…</div>}
        {!loading && (
          <div
            className="region-outline"
            aria-label={`Highlighted ${region.name}`}
            style={{ left: `${region.x - region.w / 2}%`, top: `${region.y - region.h / 2}%`, width: `${region.w}%`, height: `${region.h}%` }}
          />
        )}
      </div>
    </div>
  );
}

function scoreLabel(error: number, singular: string) {
  return error === 0 ? null : `${error} ${singular}${error === 1 ? '' : 's'} off`;
}

export default function Home() {
  const [source, setSource] = useState<SourceMode>('swatch');
  const [exercise, setExercise] = useState<Exercise>('value');
  const [hueDetailed, setHueDetailed] = useState(true);
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
  const startedAt = useRef(Date.now());

  useEffect(() => {
    readAttempts().then(setAttempts).catch(() => undefined);
    const storedDetail = window.localStorage.getItem('munsell-eye-hue-detail');
    if (storedDetail !== null) setHueDetailed(storedDetail === 'detailed');
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  const resetAnswer = useCallback((detailed: boolean) => {
    setAnswerH(detailed ? '5YR' : 'YR');
    setAnswerV('5');
    setAnswerC('4');
    setSubmitted(null);
    startedAt.current = Date.now();
  }, []);

  const nextQuestion = useCallback((nextSource = source, nextExercise = exercise, detailed = hueDetailed) => {
    resetAnswer(nextExercise === 'full' || detailed);
    if (nextSource === 'image') {
      const choices = IMAGE_PROMPTS.filter((prompt) => prompt.id !== imagePrompt.id);
      setImagePrompt(choices[Math.floor(Math.random() * choices.length)] ?? IMAGE_PROMPTS[0]);
      setImageReady(false);
    } else {
      const pool = nextExercise === 'value' ? NEUTRALS : SWATCH_POOL;
      setTarget(weightedChoice(pool, (color) => weaknessWeight(color, nextExercise, attempts)));
      setImageReady(true);
    }
  }, [attempts, exercise, hueDetailed, imagePrompt.id, resetAnswer, source]);

  const changeSource = (next: SourceMode) => {
    setSource(next);
    nextQuestion(next, exercise);
  };

  const changeExercise = (next: Exercise) => {
    setExercise(next);
    nextQuestion(source, next);
  };

  const handleImageColor = useCallback((color: MunsellColor) => {
    setTarget(color);
    setImageReady(true);
  }, []);

  const submit = async () => {
    if (!imageReady || submitted) return;
    const detailed = exercise === 'full' || hueDetailed;
    const targetHue = detailed ? target.h : familyOf(target.h);
    const hueError = target.h === 'N' ? 0 : hueDistance(answerH, targetHue, detailed);
    const valueError = Math.abs(Number(answerV) - target.v);
    const chromaError = target.c === 0 ? 0 : Math.abs(Number(answerC) - target.c) / 2;
    const exact = exercise === 'value'
      ? valueError === 0
      : exercise === 'hue'
        ? hueError === 0
        : exercise === 'chroma'
          ? chromaError === 0
          : hueError === 0 && valueError === 0 && chromaError === 0;
    const attempt: Attempt = {
      createdAt: Date.now(),
      source,
      exercise,
      targetH: target.h,
      targetV: target.v,
      targetC: target.c,
      answerH,
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

  const hueOptions = useMemo(() => exercise === 'full' || hueDetailed ? HUE_ORDER : BASIC_HUES, [exercise, hueDetailed]);
  const promptText = exercise === 'value' ? 'Identify this value' : exercise === 'hue' ? 'Identify this hue' : exercise === 'chroma' ? 'Identify this chroma' : 'Identify hue, value & chroma';
  const visibleAnswer = exercise === 'value' ? `N${answerV}` : exercise === 'hue' ? answerH : exercise === 'chroma' ? `/${answerC}` : `${answerH} ${answerV}/${answerC}`;

  const statistics = useMemo(() => {
    const total = attempts.length;
    const exact = attempts.filter((attempt) => attempt.exact).length;
    const average = (key: 'hueError' | 'valueError' | 'chromaError') => total ? attempts.reduce((sum, attempt) => sum + attempt[key], 0) / total : 0;
    const hueGroups = BASIC_HUES.map((family) => {
      const rows = attempts.filter((attempt) => familyOf(attempt.targetH) === family && attempt.targetH !== 'N');
      return { family, count: rows.length, error: rows.length ? rows.reduce((sum, row) => sum + row.hueError, 0) / rows.length : 0 };
    }).filter((group) => group.count);
    const weakHue = [...hueGroups].sort((a, b) => b.error - a.error)[0];
    const colorAttempts = attempts.filter((attempt) => attempt.targetC > 0);
    const valueBias = attempts.length ? attempts.reduce((sum, attempt) => sum + attempt.answerV - attempt.targetV, 0) / attempts.length : 0;
    const chromaBias = colorAttempts.length ? colorAttempts.reduce((sum, attempt) => sum + attempt.answerC - attempt.targetC, 0) / colorAttempts.length : 0;
    const insights = [
      weakHue && weakHue.error > 0 ? `${weakHue.family} is currently your least certain hue family.` : 'No persistent hue confusion yet.',
      Math.abs(valueBias) >= 0.2 ? `You tend to judge values ${valueBias > 0 ? 'lighter' : 'darker'} than the target.` : 'Your value guesses are not showing a directional bias.',
      Math.abs(chromaBias) >= 0.5 ? `You tend to judge chroma ${chromaBias > 0 ? 'higher' : 'lower'} than the target.` : 'Your chroma guesses are balanced so far.',
    ];
    return { total, exactRate: total ? exact / total : 0, hueAverage: average('hueError'), valueAverage: average('valueError'), chromaAverage: average('chromaError'), insights };
  }, [attempts]);

  const feedbackErrors = submitted ? [
    exercise !== 'value' && scoreLabel(submitted.hueError, 'hue step'),
    exercise !== 'hue' && exercise !== 'chroma' && scoreLabel(submitted.valueError, 'value step'),
    exercise !== 'value' && exercise !== 'hue' && scoreLabel(submitted.chromaError, 'chroma step'),
    exercise === 'value' && scoreLabel(submitted.valueError, 'value step'),
    exercise === 'chroma' && scoreLabel(submitted.chromaError, 'chroma step'),
  ].filter(Boolean) : [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Munsell Eye</span>
        </div>
        <button className="quiet-button" type="button" onClick={() => setProgressOpen(true)}>Progress</button>
      </header>

      <section className="workspace" aria-label="Color identification practice">
        <div className="mode-row">
          <div className="segmented" aria-label="Question source">
            {(['swatch', 'image'] as SourceMode[]).map((mode) => (
              <button className={source === mode ? 'active' : ''} key={mode} onClick={() => changeSource(mode)} type="button">
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
            ['full', 'Full H/V/C'],
          ] as [Exercise, string][]).map(([mode, label]) => (
            <button className={exercise === mode ? 'active' : ''} key={mode} onClick={() => changeExercise(mode)} type="button">{label}</button>
          ))}
        </nav>

        <div className="prompt-copy">
          <div>
            <span>{promptText}</span>
            {source === 'image' && <small>{imagePrompt.region.name}</small>}
          </div>
          <span className="difficulty">{exercise === 'value' ? 'N1–N9' : exercise === 'hue' && !hueDetailed ? '10 HUES' : '40 HUES'}</span>
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
              <div className={`picker-grid ${exercise === 'full' ? 'full' : ''}`}>
                {(exercise === 'hue' || exercise === 'full') && <Picker label="Hue" options={hueOptions} value={answerH} onChange={setAnswerH} compact={exercise === 'full'} />}
                {(exercise === 'value' || exercise === 'full') && <Picker label="Value" options={VALUE_OPTIONS} value={answerV} onChange={setAnswerV} compact={exercise === 'full'} />}
                {(exercise === 'chroma' || exercise === 'full') && <Picker label="Chroma" options={CHROMA_OPTIONS} value={answerC} onChange={setAnswerC} compact={exercise === 'full'} />}
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
              <button className="check-button" onClick={() => { setSessionCount((count) => count + 1); nextQuestion(); }} type="button">Next</button>
            </div>
          )}
        </section>
      </section>

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
            <div className="preference-row">
              <div><strong>Hue precision</strong><span>Change this at any time. Nothing is locked.</span></div>
              <div className="segmented small">
                <button className={!hueDetailed ? 'active' : ''} onClick={() => { setHueDetailed(false); localStorage.setItem('munsell-eye-hue-detail', 'basic'); nextQuestion(source, exercise, false); }} type="button">10</button>
                <button className={hueDetailed ? 'active' : ''} onClick={() => { setHueDetailed(true); localStorage.setItem('munsell-eye-hue-detail', 'detailed'); nextQuestion(source, exercise, true); }} type="button">40</button>
              </div>
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
