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
type ImageMode = 'original' | 'block' | 'value';
type Pin = { x: number; y: number; rgb: RGB };
type Cluster = { index: number; count: number; color: MunsellColor; rgb: RGB };
type BlockIn = { width: number; height: number; labels: Uint8Array; clusters: Cluster[] };

const rgbCss = (rgb: RGB) => `rgb(${rgb.join(',')})`;
const chipCss = (color: MunsellColor) => rgbCss(color.rgb);
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;

function rgbToOklab(rgb: RGB) {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const l = .4122214708 * linear[0] + .5363325363 * linear[1] + .0514459929 * linear[2];
  const m = .2119034982 * linear[0] + .6806995451 * linear[1] + .1073969566 * linear[2];
  const s = .0883024619 * linear[0] + .2817188376 * linear[1] + .6299787005 * linear[2];
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    .2104542553 * lRoot + .793617785 * mRoot - .0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + .4505937099 * sRoot,
    .0259040371 * lRoot + .7827717662 * mRoot - .808675766 * sRoot,
  ] as const;
}

const CHIP_LABS = [...MUNSELL_COLORS, ...NEUTRALS].map((color) => ({ color, lab: rgbToOklab(color.rgb) }));

function nearestChip(rgb: RGB) {
  const source = rgbToOklab(rgb);
  return CHIP_LABS.reduce((best, entry) => {
    const distance = (source[0] - entry.lab[0]) ** 2 + (source[1] - entry.lab[1]) ** 2 + (source[2] - entry.lab[2]) ** 2;
    return distance < best.distance ? { color: entry.color, distance } : best;
  }, { color: CHIP_LABS[0].color, distance: Number.POSITIVE_INFINITY }).color;
}

function buildBlockIn(data: ImageData, requestedCount: number, pins: Pin[]): BlockIn {
  const { width, height } = data;
  const count = Math.max(2, Math.min(14, Math.max(requestedCount, pins.length)));
  const pixels = width * height;
  const labs = new Float32Array(pixels * 3);
  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    const lab = rgbToOklab([data.data[offset], data.data[offset + 1], data.data[offset + 2]]);
    labs[index * 3] = lab[0];
    labs[index * 3 + 1] = lab[1];
    labs[index * 3 + 2] = lab[2];
  }

  const centroids = pins.slice(0, count).map((pin) => {
    const lab = rgbToOklab(pin.rgb);
    return { lab: [...lab] as number[], x: pin.x, y: pin.y, fixed: true };
  });
  const seedIndexes = [Math.floor(pixels * .5), Math.floor(pixels * .24), Math.floor(pixels * .76), Math.floor(pixels * .4)];
  while (centroids.length < count) {
    let bestIndex = seedIndexes[centroids.length] ?? 0;
    let bestDistance = -1;
    const stride = Math.max(1, Math.floor(pixels / 12000));
    for (let index = centroids.length; index < pixels; index += stride) {
      const x = (index % width) / Math.max(1, width - 1);
      const y = Math.floor(index / width) / Math.max(1, height - 1);
      const nearest = centroids.length ? Math.min(...centroids.map((centroid) => {
        const dl = labs[index * 3] - centroid.lab[0];
        const da = labs[index * 3 + 1] - centroid.lab[1];
        const db = labs[index * 3 + 2] - centroid.lab[2];
        return dl * dl * 1.35 + da * da + db * db + ((x - centroid.x) ** 2 + (y - centroid.y) ** 2) * .018;
      })) : index % 997 / 997;
      if (nearest > bestDistance) { bestDistance = nearest; bestIndex = index; }
    }
    centroids.push({
      lab: [labs[bestIndex * 3], labs[bestIndex * 3 + 1], labs[bestIndex * 3 + 2]],
      x: (bestIndex % width) / Math.max(1, width - 1),
      y: Math.floor(bestIndex / width) / Math.max(1, height - 1),
      fixed: false,
    });
  }

  let labels = new Uint8Array(pixels);
  for (let iteration = 0; iteration < 7; iteration++) {
    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, x: 0, y: 0, count: 0 }));
    for (let index = 0; index < pixels; index++) {
      const x = (index % width) / Math.max(1, width - 1);
      const y = Math.floor(index / width) / Math.max(1, height - 1);
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, centroidIndex) => {
        const dl = labs[index * 3] - centroid.lab[0];
        const da = labs[index * 3 + 1] - centroid.lab[1];
        const db = labs[index * 3 + 2] - centroid.lab[2];
        const distance = dl * dl * 1.35 + da * da + db * db + ((x - centroid.x) ** 2 + (y - centroid.y) ** 2) * .022;
        if (distance < nearestDistance) { nearest = centroidIndex; nearestDistance = distance; }
      });
      labels[index] = nearest;
      const sum = sums[nearest];
      sum.l += labs[index * 3]; sum.a += labs[index * 3 + 1]; sum.b += labs[index * 3 + 2];
      sum.x += x; sum.y += y; sum.count += 1;
    }
    centroids.forEach((centroid, index) => {
      const sum = sums[index];
      if (!sum.count) return;
      if (!centroid.fixed) centroid.lab = [sum.l / sum.count, sum.a / sum.count, sum.b / sum.count];
      centroid.x = sum.x / sum.count;
      centroid.y = sum.y / sum.count;
    });
  }

  // A compact spatial cleanup removes salt-and-pepper islands while keeping
  // the larger, softer shapes useful for a painting block-in.
  for (let pass = 0; pass < 2; pass++) {
    const next = labels.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        const counts = new Uint8Array(count);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx || dy) counts[labels[(y + dy) * width + x + dx]] += 1;
        }
        let majority = labels[index];
        for (let cluster = 0; cluster < count; cluster++) if (counts[cluster] > counts[majority]) majority = cluster;
        if (counts[majority] >= 5) next[index] = majority;
      }
    }
    labels = next;
  }

  const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    const sum = sums[labels[index]];
    sum.r += data.data[offset]; sum.g += data.data[offset + 1]; sum.b += data.data[offset + 2]; sum.count += 1;
  }
  const clusters = sums.map((sum, index) => {
    const rgb = [
      Math.round(sum.r / Math.max(1, sum.count)),
      Math.round(sum.g / Math.max(1, sum.count)),
      Math.round(sum.b / Math.max(1, sum.count)),
    ] as RGB;
    return { index, count: sum.count, rgb, color: nearestChip(rgb) };
  });
  return { width, height, labels, clusters };
}

export default function ImageLab({ selectedPaintIds, onSendToMixer }: {
  selectedPaintIds: string[];
  onSendToMixer: (color: MunsellColor) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawDataRef = useRef<ImageData | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pressRef = useRef<{ id: number; x: number; y: number; timer?: number } | null>(null);
  const [mode, setMode] = useState<ImageMode>('block');
  const [depth, setDepth] = useState(4);
  const [pins, setPins] = useState<Pin[]>([]);
  const [blockIn, setBlockIn] = useState<BlockIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceName, setSourceName] = useState('Fruit study example');
  const [sourceVersion, setSourceVersion] = useState(0);
  const [selectedCluster, setSelectedCluster] = useState(0);
  const [sample, setSample] = useState<{ x: number; y: number; rgb: RGB; color: MunsellColor } | null>(null);

  const loadSource = useCallback((src: string, name: string) => {
    setLoading(true);
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = src.startsWith('blob:') ? '' : 'anonymous';
    image.onload = () => {
      const scale = Math.min(420 / image.naturalWidth, 360 / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = width; rawCanvas.height = height;
      const rawContext = rawCanvas.getContext('2d', { willReadFrequently: true });
      if (!rawContext) return;
      rawContext.drawImage(image, 0, 0, width, height);
      rawDataRef.current = rawContext.getImageData(0, 0, width, height);

      const softened = document.createElement('canvas');
      softened.width = width; softened.height = height;
      const softContext = softened.getContext('2d', { willReadFrequently: true });
      if (!softContext) return;
      softContext.filter = `blur(${Math.max(.65, Math.min(1.45, Math.min(width, height) / 280))}px)`;
      softContext.drawImage(image, 0, 0, width, height);
      originalCanvasRef.current = rawCanvas;
      const softenedData = softContext.getImageData(0, 0, width, height);
      rawDataRef.current = rawContext.getImageData(0, 0, width, height);
      setSourceName(name);
      setPins([]);
      setDepth(4);
      setSelectedCluster(0);
      setBlockIn(buildBlockIn(softenedData, 4, []));
      setSourceVersion((version) => version + 1);
      setLoading(false);
    };
    image.onerror = () => setLoading(false);
    image.src = src;
  }, []);

  useEffect(() => {
    loadSource('/practice/still-life-fruit.jpg', 'Fruit study example');
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [loadSource]);

  useEffect(() => {
    const raw = rawDataRef.current;
    if (!raw || !sourceVersion) return;
    const softCanvas = document.createElement('canvas');
    softCanvas.width = raw.width; softCanvas.height = raw.height;
    const context = softCanvas.getContext('2d', { willReadFrequently: true });
    if (!context || !originalCanvasRef.current) return;
    context.filter = `blur(${Math.max(.65, Math.min(1.45, Math.min(raw.width, raw.height) / 280))}px)`;
    context.drawImage(originalCanvasRef.current, 0, 0);
    setLoading(true);
    const timer = window.setTimeout(() => {
      setBlockIn(buildBlockIn(context.getImageData(0, 0, raw.width, raw.height), depth, pins));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [depth, pins, sourceVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const raw = rawDataRef.current;
    if (!canvas || !raw || !blockIn) return;
    canvas.width = raw.width; canvas.height = raw.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (mode === 'original' && originalCanvasRef.current) {
      context.drawImage(originalCanvasRef.current, 0, 0);
      return;
    }
    const output = context.createImageData(blockIn.width, blockIn.height);
    for (let index = 0; index < blockIn.labels.length; index++) {
      const cluster = blockIn.clusters[blockIn.labels[index]];
      const color = mode === 'value' ? NEUTRALS[Math.max(0, Math.min(8, cluster.color.v - 1))] : cluster.color;
      const offset = index * 4;
      output.data[offset] = color.rgb[0]; output.data[offset + 1] = color.rgb[1]; output.data[offset + 2] = color.rgb[2]; output.data[offset + 3] = 255;
    }
    context.putImageData(output, 0, 0);
  }, [blockIn, mode]);

  const sortedClusters = useMemo(() => [...(blockIn?.clusters ?? [])]
    .filter((cluster) => cluster.count > 0)
    .sort((a, b) => b.color.v - a.color.v || a.color.h.localeCompare(b.color.h) || a.color.c - b.color.c), [blockIn]);
  const selectedColor = sample?.color ?? blockIn?.clusters[selectedCluster]?.color ?? sortedClusters[0]?.color ?? NEUTRALS[4];
  const recipe = useMemo(() => suggestPaintRecipe(selectedColor, selectedPaintIds), [selectedColor, selectedPaintIds]);

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
      const sx = Math.max(0, Math.min(raw.width - 1, x + dx));
      const sy = Math.max(0, Math.min(raw.height - 1, y + dy));
      const offset = (sy * raw.width + sx) * 4;
      r += raw.data[offset]; g += raw.data[offset + 1]; b += raw.data[offset + 2]; count += 1;
    }
    const rgb = [Math.round(r / count), Math.round(g / count), Math.round(b / count)] as RGB;
    const next = { x: x / raw.width, y: y / raw.height, rgb, color: nearestChip(rgb) };
    setSample(next);
    if (blockIn) setSelectedCluster(blockIn.labels[y * raw.width + x]);
    return next;
  }, [blockIn]);

  const addSample = useCallback((next = sample) => {
    if (!next) return;
    setPins((current) => {
      if (current.some((pin) => Math.hypot(pin.x - next.x, pin.y - next.y) < .025)) return current;
      return [...current, { x: next.x, y: next.y, rgb: next.rgb }].slice(-12);
    });
    setDepth((current) => Math.min(12, Math.max(current + 1, pins.length + 2)));
  }, [pins.length, sample]);

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const next = sampleAt(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    const press = { id: event.pointerId, x: event.clientX, y: event.clientY, timer: undefined as number | undefined };
    press.timer = window.setTimeout(() => { addSample(next); press.timer = undefined; }, 480);
    pressRef.current = press;
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pressRef.current || pressRef.current.id !== event.pointerId) return;
    sampleAt(event.clientX, event.clientY);
    if (Math.hypot(event.clientX - pressRef.current.x, event.clientY - pressRef.current.y) > 9 && pressRef.current.timer) {
      window.clearTimeout(pressRef.current.timer); pressRef.current.timer = undefined;
    }
  };
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pressRef.current?.timer) window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    loadSource(objectUrlRef.current, file.name.replace(/\.[^.]+$/, ''));
    event.target.value = '';
  };

  return (
    <section className="image-lab" aria-labelledby="image-lab-title">
      <header className="image-lab-head">
        <div><span className="eyebrow">Your reference</span><h2 id="image-lab-title">Build the big color masses</h2></div>
        <div>
          <input accept="image/*" hidden onChange={chooseFile} ref={fileRef} type="file" />
          <button className="outline-button" onClick={() => fileRef.current?.click()} type="button">Choose image</button>
        </div>
      </header>

      <div className="image-lab-toolbar">
        <div className="segmented image-mode-switch" aria-label="Image view">
          {([['original', 'Original'], ['block', 'Block-in'], ['value', 'Value']] as const).map(([id, label]) => (
            <button className={mode === id ? 'active' : ''} key={id} onClick={() => setMode(id)} type="button">{label}</button>
          ))}
        </div>
        <label className="depth-control">
          <span>Depth <strong>{depth}</strong></span>
          <input aria-label="Block-in color depth" max="12" min="4" onChange={(event) => setDepth(Number(event.target.value))} type="range" value={depth} />
        </label>
      </div>

      <div className="image-lab-stage">
        <canvas
          aria-label={`${sourceName}, ${mode} view`}
          onPointerCancel={pointerUp}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          ref={canvasRef}
        />
        {loading && <span className="image-lab-loading">Resolving the color masses…</span>}
        {sample && <span className="image-lab-sample" style={{ background: chipCss(sample.color), left: `${sample.x * 100}%`, top: `${sample.y * 100}%` }} />}
        <span className="image-lab-instruction">Tap or drag to inspect · hold to add a mass</span>
      </div>

      <div className="mass-dock" aria-label="Block-in palette ordered from light to dark">
        {sortedClusters.map((cluster) => (
          <button
            aria-label={notation(cluster.color)}
            className={cluster.index === selectedCluster ? 'active' : ''}
            key={cluster.index}
            onClick={() => { setSelectedCluster(cluster.index); setSample(null); }}
            style={{ background: chipCss(cluster.color) }}
            type="button"
          ><span>{cluster.color.v}</span></button>
        ))}
      </div>

      <div className="sample-sheet">
        <div className="sample-identity">
          <span className="sample-large" style={{ background: chipCss(selectedColor) }} />
          <div><span className="eyebrow">Closest Munsell chip</span><strong>{notation(selectedColor)}</strong></div>
        </div>
        <div className="sample-actions">
          <button className="outline-button" disabled={!sample} onClick={() => addSample()} type="button">Add mass</button>
          <button className="dark-button" onClick={() => onSendToMixer(selectedColor)} type="button">Send to Mix</button>
        </div>
        {recipe && (
          <div className="sample-paint-match">
            <span style={{ background: rgbCss(recipe.rgb) }} />
            <small>Closest from active palette</small>
            <strong>{recipe.ingredients.map(({ paint, parts }) => `${parts} ${paint.name}`).join(' · ')}</strong>
          </div>
        )}
      </div>
    </section>
  );
}
