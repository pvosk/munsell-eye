'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';
import { suggestPaintRecipe } from './paint-mixing';

type RGB = [number, number, number];
type Lab = readonly [number, number, number];
type ImageMode = 'original' | 'block' | 'value';
type QuantizedImage = { width: number; height: number; labels: Uint8Array; counts: number[] };
type Sample = { x: number; y: number; rgb: RGB; color: MunsellColor };
type PaletteCandidate = {
  color: MunsellColor;
  lab: [number, number, number];
  coverage: number;
  coherence: number;
};

const INITIAL_CHIP_COUNT = 7;
const MAX_CHIP_COUNT = 18;
const ANALYSIS_SAMPLE_LIMIT = 15000;
const PROVISIONAL_CLUSTER_COUNT = 22;
const rgbCss = (rgb: RGB) => `rgb(${rgb.join(',')})`;
const chipCss = (color: MunsellColor) => rgbCss(color.rgb);
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;

function rgbToOklab(rgb: RGB): Lab {
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

function labDistance(first: ArrayLike<number>, second: ArrayLike<number>) {
  return (first[0] - second[0]) ** 2 * 1.2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2;
}

function paintingDistance(first: ArrayLike<number>, second: ArrayLike<number>) {
  return (first[0] - second[0]) ** 2 * 3.2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2;
}

function circularAngleDistance(first: number, second: number) {
  const distance = Math.abs(first - second) % (Math.PI * 2);
  return Math.min(distance, Math.PI * 2 - distance);
}

function quantile(sorted: number[], position: number) {
  if (!sorted.length) return .5;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * position)));
  return sorted[index];
}

function nearestChipFromLab(lab: ArrayLike<number>) {
  return CHIP_LABS.reduce((best, entry) => {
    const distance = labDistance(lab, entry.lab);
    return distance < best.distance ? { color: entry.color, distance } : best;
  }, { color: CHIP_LABS[0].color, distance: Number.POSITIVE_INFINITY }).color;
}

function nearestChip(rgb: RGB) {
  return nearestChipFromLab(rgbToOklab(rgb));
}

function buildLabField(data: ImageData) {
  const labs = new Float32Array(data.width * data.height * 3);
  for (let index = 0; index < data.width * data.height; index++) {
    const offset = index * 4;
    const lab = rgbToOklab([data.data[offset], data.data[offset + 1], data.data[offset + 2]]);
    labs[index * 3] = lab[0]; labs[index * 3 + 1] = lab[1]; labs[index * 3 + 2] = lab[2];
  }
  return labs;
}

function initialPalette(labs: Float32Array, width: number, height: number) {
  const pixels = width * height;
  const step = Math.max(1, Math.ceil(Math.sqrt(pixels / ANALYSIS_SAMPLE_LIMIT)));
  const sampleWidth = Math.ceil(width / step);
  const sampleHeight = Math.ceil(height / step);
  const samples: number[] = [];
  for (let gridY = 0; gridY < sampleHeight; gridY++) {
    const y = Math.min(height - 1, gridY * step + Math.floor(step / 2));
    for (let gridX = 0; gridX < sampleWidth; gridX++) {
      const x = Math.min(width - 1, gridX * step + Math.floor(step / 2));
      samples.push(y * width + x);
    }
  }
  const mean = samples.reduce<[number, number, number]>((sum, index) => [
    sum[0] + labs[index * 3], sum[1] + labs[index * 3 + 1], sum[2] + labs[index * 3 + 2],
  ], [0, 0, 0]).map((channel) => channel / samples.length) as [number, number, number];
  const first = samples.reduce((best, index) => labDistance(mean, labs.subarray(index * 3, index * 3 + 3)) < labDistance(mean, labs.subarray(best * 3, best * 3 + 3)) ? index : best, samples[0]);
  const centroids: number[][] = [[labs[first * 3], labs[first * 3 + 1], labs[first * 3 + 2]]];

  while (centroids.length < Math.min(PROVISIONAL_CLUSTER_COUNT, samples.length)) {
    let farthest = samples[0]; let farthestDistance = -1;
    for (const index of samples) {
      const sample = labs.subarray(index * 3, index * 3 + 3);
      const distance = Math.min(...centroids.map((centroid) => labDistance(sample, centroid)));
      if (distance > farthestDistance) { farthest = index; farthestDistance = distance; }
    }
    centroids.push([labs[farthest * 3], labs[farthest * 3 + 1], labs[farthest * 3 + 2]]);
  }

  const assignments = new Uint8Array(samples.length);
  let counts = new Array(centroids.length).fill(0);
  for (let iteration = 0; iteration < 6; iteration++) {
    const sums = centroids.map(() => [0, 0, 0]);
    counts = new Array(centroids.length).fill(0);
    samples.forEach((index, sampleIndex) => {
      const sample = labs.subarray(index * 3, index * 3 + 3);
      let nearest = 0; let distance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, centroidIndex) => {
        const next = labDistance(sample, centroid);
        if (next < distance) { nearest = centroidIndex; distance = next; }
      });
      assignments[sampleIndex] = nearest;
      sums[nearest][0] += sample[0]; sums[nearest][1] += sample[1]; sums[nearest][2] += sample[2]; counts[nearest] += 1;
    });
    centroids.forEach((centroid, index) => {
      if (!counts[index]) return;
      centroid[0] = sums[index][0] / counts[index]; centroid[1] = sums[index][1] / counts[index]; centroid[2] = sums[index][2] / counts[index];
    });
  }

  // Reassign once after the final centroid update so spatial regions use the settled colors.
  counts = new Array(centroids.length).fill(0);
  samples.forEach((index, sampleIndex) => {
    const sample = labs.subarray(index * 3, index * 3 + 3);
    let nearest = 0; let distance = Number.POSITIVE_INFINITY;
    centroids.forEach((centroid, centroidIndex) => {
      const next = labDistance(sample, centroid);
      if (next < distance) { nearest = centroidIndex; distance = next; }
    });
    assignments[sampleIndex] = nearest;
    counts[nearest] += 1;
  });

  // Keep colors that form meaningful connected masses, not isolated saturated pixels.
  const visited = new Uint8Array(assignments.length);
  const queue = new Int32Array(assignments.length);
  const coherentCounts = new Int32Array(centroids.length);
  const largestRegions = new Int32Array(centroids.length);
  const minimumRegion = Math.max(4, Math.round(samples.length * .0015));
  for (let start = 0; start < assignments.length; start++) {
    if (visited[start]) continue;
    const label = assignments[start];
    let head = 0; let tail = 0;
    queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % sampleWidth; const y = Math.floor(current / sampleWidth);
      const left = current - 1; const right = current + 1;
      const above = current - sampleWidth; const below = current + sampleWidth;
      if (x > 0 && !visited[left] && assignments[left] === label) { visited[left] = 1; queue[tail++] = left; }
      if (x + 1 < sampleWidth && !visited[right] && assignments[right] === label) { visited[right] = 1; queue[tail++] = right; }
      if (y > 0 && !visited[above] && assignments[above] === label) { visited[above] = 1; queue[tail++] = above; }
      if (y + 1 < sampleHeight && !visited[below] && assignments[below] === label) { visited[below] = 1; queue[tail++] = below; }
    }
    largestRegions[label] = Math.max(largestRegions[label], tail);
    if (tail >= minimumRegion) coherentCounts[label] += tail;
  }

  const allCandidates: PaletteCandidate[] = centroids.flatMap((lab, index) => {
    if (!counts[index]) return [];
    const coherentCount = coherentCounts[index] || largestRegions[index];
    return [{
      color: nearestChipFromLab(lab),
      lab: [lab[0], lab[1], lab[2]],
      coverage: coherentCount / samples.length,
      coherence: coherentCount / counts[index],
    }];
  });
  const candidates = allCandidates.filter((candidate) => candidate.coverage >= .0015);
  const pool = candidates.length >= INITIAL_CHIP_COUNT ? candidates : allCandidates;
  if (!pool.length) return [NEUTRALS[4]];

  const lightnesses = samples.map((index) => labs[index * 3]).sort((a, b) => a - b);
  const shadowCutoff = Math.min(.48, quantile(lightnesses, .3));
  const isShadowCandidate = (candidate: PaletteCandidate) => candidate.color.v <= 3
    || (candidate.color.v <= 4 && candidate.lab[0] <= shadowCutoff);
  const selected: PaletteCandidate[] = [];
  const selectedNotations = new Set<string>();
  const canSelect = (candidate: PaletteCandidate) => !selectedNotations.has(notation(candidate.color))
    && (!isShadowCandidate(candidate) || !selected.some(isShadowCandidate));
  const addCandidate = (candidate: PaletteCandidate) => {
    const key = notation(candidate.color);
    if (!canSelect(candidate)) return false;
    selected.push(candidate); selectedNotations.add(key); return true;
  };

  // Collapse the image's shadow family into one robust block-in mass.
  const shadowPool = pool.filter(isShadowCandidate);
  const shadowCoverage = shadowPool.reduce((sum, candidate) => sum + candidate.coverage, 0);
  let hasShadowAnchor = false;
  if (shadowPool.length && shadowCoverage >= .018) {
    const target = quantile(lightnesses, .18);
    const shadowAnchor = shadowPool.reduce((winner, candidate) => {
      const score = Math.exp(-Math.abs(candidate.lab[0] - target) / .08)
        * (.16 + Math.sqrt(candidate.coverage))
        * (.45 + .55 * Math.min(1, candidate.coherence));
      const winnerScore = Math.exp(-Math.abs(winner.lab[0] - target) / .08)
        * (.16 + Math.sqrt(winner.coverage))
        * (.45 + .55 * Math.min(1, winner.coherence));
      return score > winnerScore ? candidate : winner;
    });
    hasShadowAnchor = addCandidate(shadowAnchor);
  }

  // Add broad halftone and light anchors; a high-key image gets a third tonal anchor instead of a false dark.
  const tonalPositions = hasShadowAnchor ? [.5, .82] : [.2, .52, .84];
  for (const target of tonalPositions.map((position) => quantile(lightnesses, position))) {
    const available = pool.filter(canSelect);
    if (!available.length) break;
    const best = available.reduce((winner, candidate) => {
      const score = Math.exp(-Math.abs(candidate.lab[0] - target) / .075)
        * (.16 + Math.sqrt(candidate.coverage))
        * (.45 + .55 * Math.min(1, candidate.coherence));
      const winnerScore = Math.exp(-Math.abs(winner.lab[0] - target) / .075)
        * (.16 + Math.sqrt(winner.coverage))
        * (.45 + .55 * Math.min(1, winner.coherence));
      return score > winnerScore ? candidate : winner;
    });
    addCandidate(best);
  }

  // Reserve two coherent local-color identities, such as both red fruit and yellow bananas.
  for (let colorAnchor = 0; colorAnchor < 2; colorAnchor++) {
    const hueCandidate = pool
      .filter((candidate) => canSelect(candidate) && candidate.color.h !== 'N' && candidate.coverage >= .006)
      .map((candidate) => {
        const chroma = Math.hypot(candidate.lab[1], candidate.lab[2]);
        const angle = Math.atan2(candidate.lab[2], candidate.lab[1]);
        const chromaticSelected = selected.filter((entry) => Math.hypot(entry.lab[1], entry.lab[2]) > .025);
        const identityNovelty = chromaticSelected.length ? Math.min(1, Math.min(...chromaticSelected.map((entry) => {
          const entryChroma = Math.hypot(entry.lab[1], entry.lab[2]);
          const hueDifference = circularAngleDistance(angle, Math.atan2(entry.lab[2], entry.lab[1])) / Math.PI;
          const valueDifference = Math.min(1, Math.abs(candidate.lab[0] - entry.lab[0]) / .28);
          const chromaDifference = Math.min(1, Math.abs(chroma - entryChroma) / .12);
          return Math.sqrt(.55 * hueDifference ** 2 + .28 * valueDifference ** 2 + .17 * chromaDifference ** 2);
        }))) : 1;
        const chromaConfidence = Math.max(0, Math.min(1, (chroma - .025) / .12));
        const score = (.28 + .72 * identityNovelty) * chromaConfidence * Math.sqrt(candidate.coverage)
          * (.45 + .55 * Math.min(1, candidate.coherence));
        return { candidate, score };
      })
      .sort((a, b) => b.score - a.score)[0];
    if (!hueCandidate || hueCandidate.score <= .02 || !addCandidate(hueCandidate.candidate)) break;
  }

  // Fill the remaining slots by reconstruction gain, with value carrying the largest distance weight.
  const currentErrors = new Float32Array(samples.length);
  const refreshErrors = () => {
    samples.forEach((index, sampleIndex) => {
      const sample = labs.subarray(index * 3, index * 3 + 3);
      currentErrors[sampleIndex] = selected.length
        ? Math.min(...selected.map((entry) => paintingDistance(sample, entry.lab)))
        : Number.POSITIVE_INFINITY;
    });
  };
  refreshErrors();
  while (selected.length < INITIAL_CHIP_COUNT) {
    const available = pool.filter(canSelect);
    if (!available.length) break;
    const totalError = currentErrors.reduce((sum, error) => sum + error, 0);
    let best: PaletteCandidate | null = null; let bestScore = -1;
    for (const candidate of available) {
      let gain = 0;
      samples.forEach((index, sampleIndex) => {
        const distance = paintingDistance(labs.subarray(index * 3, index * 3 + 3), candidate.lab);
        gain += Math.max(0, currentErrors[sampleIndex] - distance);
      });
      const valueNovelty = selected.length ? Math.min(1, Math.min(...selected.map((entry) => Math.abs(entry.lab[0] - candidate.lab[0]))) / .24) : 1;
      const chroma = Math.hypot(candidate.lab[1], candidate.lab[2]);
      const angle = Math.atan2(candidate.lab[2], candidate.lab[1]);
      const chromaticSelected = selected.filter((entry) => Math.hypot(entry.lab[1], entry.lab[2]) > .025);
      const hueNovelty = chromaticSelected.length ? Math.min(...chromaticSelected.map((entry) => circularAngleDistance(angle, Math.atan2(entry.lab[2], entry.lab[1])))) / Math.PI : 1;
      const chromaConfidence = Math.max(0, Math.min(1, (chroma - .025) / .12));
      const mass = Math.sqrt(Math.min(1, candidate.coverage * 4));
      const reliability = .45 + .55 * Math.min(1, candidate.coherence);
      const score = reliability * (
        .66 * (totalError > 0 ? gain / totalError : 0)
        + .22 * valueNovelty * mass
        + .12 * hueNovelty * chromaConfidence * mass
      );
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
    if (!best || !addCandidate(best)) break;
    refreshErrors();
  }
  return selected.map((entry) => entry.color);
}

function quantizeToPalette(labs: Float32Array, width: number, height: number, palette: MunsellColor[]): QuantizedImage {
  const paletteLabs = palette.map((color) => rgbToOklab(color.rgb));
  const labels = new Uint8Array(width * height);
  for (let index = 0; index < labels.length; index++) {
    const offset = index * 3;
    const l = labs[offset]; const a = labs[offset + 1]; const b = labs[offset + 2];
    let nearest = 0; let distance = Number.POSITIVE_INFINITY;
    paletteLabs.forEach((lab, paletteIndex) => {
      const next = (l - lab[0]) ** 2 * 1.2 + (a - lab[1]) ** 2 + (b - lab[2]) ** 2;
      if (next < distance) { nearest = paletteIndex; distance = next; }
    });
    labels[index] = nearest;
  }
  let cleaned = labels;
  const neighborCounts = new Uint8Array(palette.length);
  for (let pass = 0; pass < 2; pass++) {
    const next = cleaned.slice();
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      neighborCounts.fill(0);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) neighborCounts[cleaned[(y + dy) * width + x + dx]] += 1;
      let majority = cleaned[index];
      for (let color = 0; color < palette.length; color++) if (neighborCounts[color] > neighborCounts[majority]) majority = color;
      if (neighborCounts[majority] >= 5) next[index] = majority;
    }
    cleaned = next;
  }
  const counts = new Array(palette.length).fill(0);
  cleaned.forEach((label) => { counts[label] += 1; });
  return { width, height, labels: cleaned, counts };
}

export default function ImageLab({ selectedPaintIds, onSendToMixer }: {
  selectedPaintIds: string[];
  onSendToMixer: (color: MunsellColor) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawDataRef = useRef<ImageData | null>(null);
  const labFieldRef = useRef<Float32Array | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pressRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number; anchorX: number; anchorY: number } | null>(null);
  const pinchingRef = useRef(false);
  const zoomRef = useRef(1);
  const zoomFrameRef = useRef<number | undefined>(undefined);
  const chipPressRef = useRef<number | undefined>(undefined);
  const chipRemovedRef = useRef(false);
  const [mode, setMode] = useState<ImageMode>('block');
  const [palette, setPalette] = useState<MunsellColor[]>([]);
  const [quantized, setQuantized] = useState<QuantizedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceName, setSourceName] = useState('Fruit study example');
  const [sourceVersion, setSourceVersion] = useState(0);
  const [selectedKey, setSelectedKey] = useState('');
  const [sample, setSample] = useState<Sample | null>(null);
  const [zoom, setZoom] = useState(1);

  const loadSource = useCallback((src: string, name: string) => {
    setLoading(true);
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = src.startsWith('blob:') ? '' : 'anonymous';
    image.onload = () => {
      const scale = Math.min(560 / image.naturalWidth, 480 / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = width; rawCanvas.height = height;
      const rawContext = rawCanvas.getContext('2d', { willReadFrequently: true });
      if (!rawContext) return;
      rawContext.drawImage(image, 0, 0, width, height);
      const raw = rawContext.getImageData(0, 0, width, height);
      const softened = document.createElement('canvas');
      softened.width = width; softened.height = height;
      const softContext = softened.getContext('2d', { willReadFrequently: true });
      if (!softContext) return;
      softContext.filter = `blur(${Math.max(.8, Math.min(1.6, Math.min(width, height) / 300))}px)`;
      softContext.drawImage(rawCanvas, 0, 0);
      const labs = buildLabField(softContext.getImageData(0, 0, width, height));
      const nextPalette = initialPalette(labs, width, height);
      rawDataRef.current = raw;
      labFieldRef.current = labs;
      originalCanvasRef.current = rawCanvas;
      setSourceName(name);
      setPalette(nextPalette);
      setSelectedKey(notation(nextPalette[0] ?? NEUTRALS[4]));
      setSample(null);
      zoomRef.current = 1;
      setZoom(1);
      if (canvasWrapRef.current) canvasWrapRef.current.style.width = '100%';
      if (zoomFrameRef.current !== undefined) window.cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = window.requestAnimationFrame(() => {
        if (viewportRef.current) {
          viewportRef.current.scrollLeft = 0;
          viewportRef.current.scrollTop = 0;
        }
        zoomFrameRef.current = undefined;
      });
      setSourceVersion((version) => version + 1);
      setLoading(false);
    };
    image.onerror = () => setLoading(false);
    image.src = src;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadSource('/practice/still-life-fruit.jpg', 'Fruit study example'), 0);
    return () => {
      window.clearTimeout(timer);
      if (zoomFrameRef.current !== undefined) window.cancelAnimationFrame(zoomFrameRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [loadSource]);

  useEffect(() => {
    const raw = rawDataRef.current;
    const labs = labFieldRef.current;
    if (!raw || !labs || !sourceVersion || !palette.length) return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      setQuantized(quantizeToPalette(labs, raw.width, raw.height, palette));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [palette, sourceVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const raw = rawDataRef.current;
    if (!canvas || !raw || !quantized) return;
    canvas.width = raw.width; canvas.height = raw.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (mode === 'original' && originalCanvasRef.current) { context.drawImage(originalCanvasRef.current, 0, 0); return; }
    const output = context.createImageData(quantized.width, quantized.height);
    for (let index = 0; index < quantized.labels.length; index++) {
      const chip = palette[quantized.labels[index]] ?? palette[0] ?? NEUTRALS[4];
      const color = mode === 'value' ? NEUTRALS[Math.max(0, Math.min(8, chip.v - 1))] : chip;
      const offset = index * 4;
      output.data[offset] = color.rgb[0]; output.data[offset + 1] = color.rgb[1]; output.data[offset + 2] = color.rgb[2]; output.data[offset + 3] = 255;
    }
    context.putImageData(output, 0, 0);
  }, [mode, palette, quantized]);

  const paletteRows = useMemo(() => palette.map((color, index) => ({ color, count: quantized?.counts[index] ?? 0 })).sort((a, b) => b.color.v - a.color.v || a.color.h.localeCompare(b.color.h) || a.color.c - b.color.c), [palette, quantized]);
  const selectedColor = sample?.color ?? palette.find((color) => notation(color) === selectedKey) ?? paletteRows[0]?.color ?? NEUTRALS[4];
  const recipe = useMemo(() => suggestPaintRecipe(selectedColor, selectedPaintIds), [selectedColor, selectedPaintIds]);
  const representedValues = useMemo(() => [...new Set(paletteRows.filter((entry) => entry.count).map((entry) => entry.color.v))].sort((a, b) => b - a), [paletteRows]);

  const setImageZoom = useCallback((requested: number, clientX?: number, clientY?: number, fixedAnchor?: { x: number; y: number }) => {
    const next = Math.max(1, Math.min(3, requested));
    const previous = zoomRef.current;
    const viewport = viewportRef.current;
    const canvasWrap = canvasWrapRef.current;
    let scrollTarget: { left: number; top: number } | null = null;
    if (viewport && clientX !== undefined && clientY !== undefined) {
      const rect = viewport.getBoundingClientRect();
      const viewportX = clientX - rect.left;
      const viewportY = clientY - rect.top;
      const anchorX = fixedAnchor?.x ?? (viewport.scrollLeft + viewportX) / previous;
      const anchorY = fixedAnchor?.y ?? (viewport.scrollTop + viewportY) / previous;
      scrollTarget = { left: anchorX * next - viewportX, top: anchorY * next - viewportY };
    }
    if (Math.abs(next - previous) < .002 && !fixedAnchor) return;
    zoomRef.current = next;
    if (canvasWrap) canvasWrap.style.width = `${next * 100}%`;
    setZoom(next);
    if (viewport && scrollTarget) {
      viewport.scrollLeft = scrollTarget.left;
      viewport.scrollTop = scrollTarget.top;
      if (zoomFrameRef.current !== undefined) window.cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = window.requestAnimationFrame(() => {
        viewport.scrollLeft = scrollTarget.left;
        viewport.scrollTop = scrollTarget.top;
        zoomFrameRef.current = undefined;
      });
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      const next = zoomRef.current * Math.exp(-event.deltaY * .0024);
      if ((zoomRef.current <= 1 && next <= 1) || (zoomRef.current >= 3 && next >= 3)) return;
      event.preventDefault();
      setImageZoom(next, event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, [setImageZoom]);

  const sampleAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const raw = rawDataRef.current;
    if (!canvas || !raw) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(raw.width - 1, Math.floor((clientX - rect.left) / rect.width * raw.width)));
    const y = Math.max(0, Math.min(raw.height - 1, Math.floor((clientY - rect.top) / rect.height * raw.height)));
    const radius = Math.max(1, Math.round(Math.min(raw.width, raw.height) * .006));
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const sx = Math.max(0, Math.min(raw.width - 1, x + dx)); const sy = Math.max(0, Math.min(raw.height - 1, y + dy)); const offset = (sy * raw.width + sx) * 4;
      r += raw.data[offset]; g += raw.data[offset + 1]; b += raw.data[offset + 2]; count += 1;
    }
    const rgb = [Math.round(r / count), Math.round(g / count), Math.round(b / count)] as RGB;
    const next = { x: x / raw.width, y: y / raw.height, rgb, color: nearestChip(rgb) };
    setSample(next); setSelectedKey(notation(next.color)); return next;
  }, []);

  const addChip = useCallback((color = sample?.color) => {
    if (!color) return;
    setPalette((current) => current.some((entry) => notation(entry) === notation(color)) || current.length >= MAX_CHIP_COUNT ? current : [...current, color]);
    setSelectedKey(notation(color));
  }, [sample]);

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (activePointersRef.current.size >= 2) {
      const [first, second] = [...activePointersRef.current.values()];
      const viewport = viewportRef.current;
      const rect = viewport?.getBoundingClientRect();
      const x = (first.x + second.x) / 2;
      const y = (first.y + second.y) / 2;
      const viewportX = x - (rect?.left ?? 0);
      const viewportY = y - (rect?.top ?? 0);
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        zoom: zoomRef.current,
        anchorX: ((viewport?.scrollLeft ?? 0) + viewportX) / zoomRef.current,
        anchorY: ((viewport?.scrollTop ?? 0) + viewportY) / zoomRef.current,
      };
      pinchingRef.current = true;
      pressRef.current = null;
      return;
    }
    sampleAt(event.clientX, event.clientY);
    pressRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size >= 2) {
      event.preventDefault();
      const [first, second] = [...activePointersRef.current.values()];
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const x = (first.x + second.x) / 2; const y = (first.y + second.y) / 2;
      const pinch = pinchRef.current;
      if (pinch) {
        setImageZoom(pinch.zoom * distance / pinch.distance, x, y, { x: pinch.anchorX, y: pinch.anchorY });
      }
      return;
    }
    const press = pressRef.current; if (!press || press.id !== event.pointerId || pinchingRef.current) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press.moved = true;
    sampleAt(event.clientX, event.clientY);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const wasPinching = pinchingRef.current;
    activePointersRef.current.delete(event.pointerId);
    const press = pressRef.current;
    if (!wasPinching && press?.id === event.pointerId) {
      const next = sampleAt(event.clientX, event.clientY);
      if (!press.moved && next) addChip(next.color);
    }
    if (!activePointersRef.current.size) pinchingRef.current = false;
    if (activePointersRef.current.size < 2) pinchRef.current = null;
    pressRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (!activePointersRef.current.size) pinchingRef.current = false;
    if (activePointersRef.current.size < 2) pinchRef.current = null;
    pressRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const beginChipHold = (color: MunsellColor) => {
    chipRemovedRef.current = false;
    if (chipPressRef.current) window.clearTimeout(chipPressRef.current);
    chipPressRef.current = window.setTimeout(() => {
      if (palette.length <= 2) return;
      chipRemovedRef.current = true;
      setPalette((current) => current.filter((entry) => notation(entry) !== notation(color)));
      setSample(null);
    }, 520);
  };
  const endChipHold = () => { if (chipPressRef.current) window.clearTimeout(chipPressRef.current); chipPressRef.current = undefined; };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file); loadSource(objectUrlRef.current, file.name.replace(/\.[^.]+$/, '')); event.target.value = '';
  };

  return (
    <section className="image-lab" aria-labelledby="image-lab-title">
      <header className="image-lab-head">
        <div><span className="eyebrow">Image</span><h1 id="image-lab-title">Build a Munsell block-in</h1><p>Begin with seven large color masses, then add only the chips the painting needs.</p></div>
        <div><input accept="image/*" hidden onChange={chooseFile} ref={fileRef} type="file" /><button className="outline-button" onClick={() => fileRef.current?.click()} type="button">Choose image</button></div>
      </header>
      <div className="image-lab-toolbar">
        <div className="segmented image-mode-switch" aria-label="Image view">{([['original', 'Original'], ['block', 'Block-in'], ['value', 'Value']] as const).map(([id, label]) => <button className={mode === id ? 'active' : ''} key={id} onClick={() => setMode(id)} type="button">{label}</button>)}</div>
        <span className="sr-only" aria-live="polite">Image zoom {Math.round(zoom * 100)} percent</span>
      </div>
      <div className="image-lab-stage">
        <div className="image-lab-viewport" ref={viewportRef}><div className="image-lab-canvas-wrap" ref={canvasWrapRef} style={{ width: `${zoom * 100}%` }}><canvas aria-label={`${sourceName}, ${mode} view`} onPointerCancel={pointerCancel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} ref={canvasRef} />{sample && <span className="image-lab-sample" style={{ background: chipCss(sample.color), left: `${sample.x * 100}%`, top: `${sample.y * 100}%` }} />}</div></div>
        {loading && <span className="image-lab-loading">Resolving the color masses…</span>}<span className="image-lab-instruction">Tap to add · drag to inspect · pinch or wheel to zoom</span>
      </div>
      {mode === 'value' && <div className="image-value-key" aria-label={`Represented Munsell values ${representedValues.join(', ')}`}><span>Values in this block-in</span>{representedValues.map((value) => <i key={value} style={{ background: chipCss(NEUTRALS[value - 1]) }}>N{value}</i>)}</div>}
      <div className="mass-dock" aria-label="Munsell block-in palette ordered from light to dark">
        {paletteRows.map(({ color }) => <button aria-label={`${notation(color)}. Hold to remove.`} className={notation(color) === selectedKey ? 'active' : ''} key={notation(color)} onClick={() => { if (chipRemovedRef.current) { chipRemovedRef.current = false; return; } setSelectedKey(notation(color)); setSample(null); }} onContextMenu={(event) => event.preventDefault()} onPointerCancel={endChipHold} onPointerDown={() => beginChipHold(color)} onPointerLeave={endChipHold} onPointerUp={endChipHold} style={{ background: chipCss(color) }} type="button" />)}
      </div>
      <p className="mass-dock-note">{palette.length} Munsell chips · hold a chip to remove it</p>
      <div className="sample-sheet">
        <div className="sample-identity"><span className="sample-large" style={{ background: chipCss(selectedColor) }} /><div><span className="eyebrow">Closest Munsell chip</span><strong>{notation(selectedColor)}</strong></div></div>
        <div className="sample-actions"><button className="outline-button" disabled={!sample || palette.some((color) => notation(color) === notation(sample.color))} onClick={() => addChip()} type="button">Add chip</button><button className="dark-button" onClick={() => onSendToMixer(selectedColor)} type="button">Send to Mix</button></div>
        {recipe && <div className="sample-paint-match"><span style={{ background: rgbCss(recipe.rgb) }} /><small>Closest from active palette</small><strong>{recipe.ingredients.map(({ paint, parts }) => `${parts} ${paint.name}`).join(' · ')}</strong></div>}
      </div>
    </section>
  );
}
