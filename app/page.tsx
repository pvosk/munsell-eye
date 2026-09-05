'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { HUE_ORDER, MUNSELL_COLORS, MUNSELL_SOURCE, NEUTRALS, type MunsellColor } from './munsell-data';
import {
  DEFAULT_PALETTE_IDS,
  PAINTS,
  PAINT_CATEGORIES,
  PALETTE_PRESETS,
  suggestPaintRecipe,
  type PaintRecipe,
} from './paint-mixing';
import { clearAttempts, readAttempts, saveAttempt, type Attempt, type Exercise, type SourceMode } from './progress-db';
import curatedImageData from './data/practice-images.json';
import StudioView from './studio';
import MixerView from './mixer';
import ImageLab from './image-lab';

const BASIC_HUES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'];
const HUE_NUMBERS = ['2.5', '5', '7.5', '10'];
const HUE_FAMILY_NAMES: Record<string, string> = {
  R: 'red', YR: 'yellow-red', Y: 'yellow', GY: 'green-yellow', G: 'green',
  BG: 'blue-green', B: 'blue', PB: 'purple-blue', P: 'purple', RP: 'red-purple',
};
const VALUE_OPTIONS = Array.from({ length: 9 }, (_, index) => String(index + 1));
const PRACTICE_CHROMA_MAX = 12;
const VALUE_ONE_CHANCE = 1 / 30;
const VALUE_ONE_COOLDOWN = 29;
const VALUE_TWO_CHANCE = 0.16;
const CHROMA_OPTIONS = Array.from({ length: PRACTICE_CHROMA_MAX / 2 }, (_, index) => String((index + 1) * 2));
const HUE_EDGE_COLORS = HUE_ORDER.map((hue) => {
  const colors = MUNSELL_COLORS.filter((color) => color.h === hue);
  return [...colors].sort((a, b) => b.c - a.c || b.v - a.v)[0];
}).filter((color): color is MunsellColor => Boolean(color));
const HUE_TRAINING_POOL = HUE_EDGE_COLORS;
const SWATCH_POOL = MUNSELL_COLORS.filter((color) => color.v >= 2 && color.v <= 8 && color.c <= 12);
const IMAGE_COLOR_POOL = MUNSELL_COLORS.filter((color) => color.c <= PRACTICE_CHROMA_MAX);
const VALUE_TRAINING_POOL = IMAGE_COLOR_POOL.filter((color) => color.c >= 2);
const INITIAL_VALUE_COLOR = VALUE_TRAINING_POOL.find((color) => color.h === '5YR' && color.v === 5 && color.c === 6) ?? VALUE_TRAINING_POOL[0];

type AppView = 'practice' | 'image' | 'mix' | 'explore' | 'reference';
type SwatchPresentation = 'isolated' | 'context';
type HuePresentation = 'swatch' | 'slice';
type CompareDimension = 'value' | 'chroma' | 'hue';
type CompareQuestion = {
  prompt: string;
  colors: MunsellColor[];
  correctIndex: number;
  dimension: CompareDimension;
};

type Region = { x: number; y: number; w: number; h: number; name: string };
type ImagePrompt = {
  id: string;
  src: string;
  title: string;
  category: string;
  credit: string;
  source: string;
  region?: Region;
  provider?: 'local' | 'openverse' | 'unsplash';
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
  { id: 'shepherd-face', src: '/practice/figure-shepherd.webp', title: 'Shepherd in Montana', category: 'Figure', credit: 'FSA / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:American_shepherd.jpg', region: { x: 72, y: 24, w: 6, h: 6, name: 'face plane' } },
  { id: 'children-mother', src: '/practice/figure-children.webp', title: 'Mother and Children', category: 'Figure', credit: 'FSA / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:1940_African_American_children_Natchitoches_Louisiana.jpg', region: { x: 49, y: 25, w: 6, h: 6, name: 'mother’s face' } },
  { id: 'children-child', src: '/practice/figure-children.webp', title: 'Mother and Children', category: 'Figure', credit: 'FSA / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:1940_African_American_children_Natchitoches_Louisiana.jpg', region: { x: 71, y: 45, w: 6, h: 6, name: 'child’s face' } },
  { id: 'valley-painter', src: '/practice/figure-painter.webp', title: 'Painting the Valley', category: 'Figure', credit: 'FSA / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:A_woman_painting_a_view_of_the_Shenandoah_Valley_1a33799v.jpg', region: { x: 39, y: 66, w: 7, h: 7, name: 'coat plane' } },
  { id: 'couple-man', src: '/practice/figure-couple.webp', title: 'Pie Town Homesteaders', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Jim_Norris_and_wife,_homesteaders_1a34109v.jpg', region: { x: 34, y: 43, w: 6, h: 6, name: 'man’s face' } },
  { id: 'couple-woman', src: '/practice/figure-couple.webp', title: 'Pie Town Homesteaders', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Jim_Norris_and_wife,_homesteaders_1a34109v.jpg', region: { x: 68, y: 42, w: 6, h: 6, name: 'woman’s face' } },
  { id: 'father-face', src: '/practice/figure-father-daughter.webp', title: 'Father and Daughter', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Homesteader_feeding_his_daughter_1a34129v.jpg', region: { x: 39, y: 22, w: 6, h: 6, name: 'father’s face' } },
  { id: 'daughter-face', src: '/practice/figure-father-daughter.webp', title: 'Father and Daughter', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Homesteader_feeding_his_daughter_1a34129v.jpg', region: { x: 63, y: 30, w: 6, h: 6, name: 'child’s face' } },
  { id: 'school-child', src: '/practice/figure-schoolchildren.webp', title: 'School Chorus', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:School_children_singing,_Pie_Town_1a34151v.jpg', region: { x: 49, y: 49, w: 5, h: 5, name: 'child’s face' } },
  { id: 'family-child', src: '/practice/figure-family.webp', title: 'Homesteader Family', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Jack_Whinery,_homesteader,_with_his_wife_and_the_youngest_of_his_five_children_1a34170v.jpg', region: { x: 23, y: 47, w: 6, h: 6, name: 'child’s face' } },
  { id: 'family-mother', src: '/practice/figure-family.webp', title: 'Homesteader Family', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Jack_Whinery,_homesteader,_with_his_wife_and_the_youngest_of_his_five_children_1a34170v.jpg', region: { x: 50, y: 42, w: 6, h: 6, name: 'mother’s face' } },
  { id: 'family-father', src: '/practice/figure-family.webp', title: 'Homesteader Family', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Jack_Whinery,_homesteader,_with_his_wife_and_the_youngest_of_his_five_children_1a34170v.jpg', region: { x: 72, y: 34, w: 6, h: 6, name: 'father’s face' } },
  { id: 'quilter-face', src: '/practice/figure-quilter.webp', title: 'The State Quilt', category: 'Figure', credit: 'Russell Lee / Library of Congress · Public domain', source: 'https://commons.wikimedia.org/wiki/File:Mrs._Bill_Stagg_with_state_quilt_1a34161v.jpg', region: { x: 22, y: 41, w: 6, h: 6, name: 'face plane' } },
];

const CURATED_IMAGE_BANK = curatedImageData as ImagePrompt[];
const MASTER_PAINTING_BANK = IMAGE_PROMPTS.filter((prompt, index, prompts) => (
  ['model-face', 'studio-coat'].includes(prompt.id)
  && prompts.findIndex((candidate) => candidate.src === prompt.src) === index
));
const ACTIVE_IMAGE_BANK = [...CURATED_IMAGE_BANK, ...MASTER_PAINTING_BANK];

const MISS_PROMPTS = ['Squint harder', 'Look deeper', 'Let the color settle', 'Look once more'];
const PALETTE_STORAGE_KEY = 'munsell-eye-palette-v1';

function shuffled<T>(items: readonly T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function initialPaletteIds() {
  if (typeof window === 'undefined') return DEFAULT_PALETTE_IDS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PALETTE_STORAGE_KEY) ?? '[]') as string[];
    const valid = stored.filter((id) => PAINTS.some((paint) => paint.id === id));
    return valid.length ? [...new Set(valid)] : DEFAULT_PALETTE_IDS;
  } catch {
    return DEFAULT_PALETTE_IDS;
  }
}

const familyOf = (hue: string) => hue.replace(/[\d.]/g, '');
const numberOf = (hue: string) => hue.match(/[\d.]+/)?.[0] ?? '5';
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
  return Math.min(2.15, 1 + error * 0.12 + misses * 0.4);
}

function targetKey(color: MunsellColor, exercise: Exercise) {
  if (exercise === 'value') return `value:${color.v}`;
  if (exercise === 'chroma') return `chroma:${color.c}`;
  if (exercise === 'hue') return `hue:${color.h}`;
  if (exercise === 'family') return `family:${color.v}/${color.c}`;
  return `full:${notation(color)}`;
}

function chooseTrainingTarget(pool: MunsellColor[], exercise: Exercise, attempts: Attempt[], blocked: string[]) {
  const groups = new Map<string, MunsellColor[]>();
  for (const color of pool) {
    const key = targetKey(color, exercise);
    groups.set(key, [...(groups.get(key) ?? []), color]);
  }
  const availableKeys = [...groups.keys()].filter((key) => !blocked.includes(key));
  const keys = availableKeys.length ? availableKeys : [...groups.keys()];
  const key = weightedChoice(keys, (entry) => {
    const members = groups.get(entry) ?? [];
    return members.length ? members.reduce((sum, color) => sum + weaknessWeight(color, exercise, attempts), 0) / members.length : 1;
  });
  const members = groups.get(key) ?? pool;
  return members[Math.floor(Math.random() * members.length)];
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
  const centerFrame = useRef<number | undefined>(undefined);
  const momentumFrame = useRef<number | undefined>(undefined);
  const localSelection = useRef<string | null>(null);
  const currentValue = useRef(value);
  const programmaticTarget = useRef<string | null>(null);
  const drag = useRef({ pointerId: -1, lastX: 0, lastAt: 0, velocity: 0, distance: 0, moved: false });
  const suppressClick = useRef(false);

  const centerOption = useCallback((option: string, behavior: ScrollBehavior = 'smooth') => {
    const container = ref.current;
    const element = container?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(option)}"]`);
    if (!container || !element) return;
    const left = element.offsetLeft + element.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left, behavior });
  }, []);

  const closestOption = useCallback(() => {
    const container = ref.current;
    if (!container) return null;
    const center = container.scrollLeft + container.clientWidth / 2;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const closest = buttons.reduce((best, button) => {
      const distance = Math.abs(button.offsetLeft + button.offsetWidth / 2 - center);
      return distance < best.distance ? { button, distance } : best;
    }, { button: buttons[0], distance: Number.POSITIVE_INFINITY });
    return closest.button?.dataset.value ?? null;
  }, []);

  const commitOption = useCallback((option: string) => {
    if (currentValue.current === option) return;
    currentValue.current = option;
    localSelection.current = option;
    onChange(option);
  }, [onChange]);

  const clearProgrammaticTarget = useCallback((delay = 0) => {
    window.clearTimeout(centerTimer.current);
    centerTimer.current = window.setTimeout(() => {
      programmaticTarget.current = null;
    }, delay);
  }, []);

  const chooseOption = useCallback((option: string, behavior: ScrollBehavior = 'smooth') => {
    programmaticTarget.current = option;
    commitOption(option);
    centerOption(option, behavior);
    clearProgrammaticTarget(behavior === 'smooth' ? 280 : 0);
  }, [centerOption, clearProgrammaticTarget, commitOption]);

  const updateClosest = useCallback(() => {
    if (programmaticTarget.current) return;
    const option = closestOption();
    if (option) commitOption(option);
  }, [closestOption, commitOption]);

  const selectClosest = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const option = closestOption();
    if (!option) return;
    chooseOption(option, behavior);
  }, [chooseOption, closestOption]);

  useEffect(() => {
    currentValue.current = value;
    if (localSelection.current === value) {
      localSelection.current = null;
      return;
    }
    window.cancelAnimationFrame(centerFrame.current ?? 0);
    programmaticTarget.current = value;
    centerFrame.current = window.requestAnimationFrame(() => {
      centerFrame.current = window.requestAnimationFrame(() => {
        if (drag.current.pointerId === -1 && momentumFrame.current === undefined) centerOption(value, 'auto');
        clearProgrammaticTarget();
      });
    });
    return () => window.cancelAnimationFrame(centerFrame.current ?? 0);
  }, [centerOption, clearProgrammaticTarget, value, options]);

  useEffect(() => () => {
    window.clearTimeout(settleTimer.current);
    window.clearTimeout(centerTimer.current);
    window.cancelAnimationFrame(centerFrame.current ?? 0);
    if (momentumFrame.current !== undefined) window.cancelAnimationFrame(momentumFrame.current);
  }, []);

  const settle = () => {
    updateClosest();
    if (programmaticTarget.current || drag.current.pointerId !== -1 || momentumFrame.current !== undefined) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (drag.current.pointerId === -1 && momentumFrame.current === undefined) selectClosest();
    }, 110);
  };

  const move = (direction: number) => {
    const index = options.indexOf(currentValue.current);
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
      updateClosest();
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
            if (event.pointerType !== 'mouse' || event.button !== 0 || !ref.current) return;
            window.clearTimeout(settleTimer.current);
            window.clearTimeout(centerTimer.current);
            programmaticTarget.current = null;
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
              updateClosest();
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

function HuePickers({ value, onChange, compact = false }: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const family = familyOf(value);
  const number = numberOf(value);
  return (
    <>
      <Picker label="Hue family" options={BASIC_HUES} value={family} onChange={(next) => onChange(`${number}${next}`)} compact={compact} />
      <Picker label="Hue number" options={HUE_NUMBERS} value={number} onChange={(next) => onChange(`${next}${family}`)} compact={compact} />
    </>
  );
}

function MobileChoiceRail<T extends string>({ label, value, options, open, compressed, onToggle, onChange }: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  open: boolean;
  compressed?: boolean;
  onToggle: () => void;
  onChange: (value: T) => void;
}) {
  const current = options.find((option) => option.id === value) ?? options[0];
  return (
    <div className={`mobile-choice-rail ${open ? 'open' : ''} ${compressed ? 'compressed' : ''}`} style={{ '--choice-basis': `${Math.min(148, 72 + current.label.length * 6)}px` } as CSSProperties}>
      <button aria-expanded={open} className="mobile-choice-trigger" onClick={onToggle} type="button">
        <span>{label}</span><strong>{current.label}</strong><i aria-hidden="true">›</i>
      </button>
      <div aria-hidden={!open} className="mobile-choice-options" aria-label={`${label} options`}>
        {options.map((option) => (
          <button className={option.id === value ? 'active' : ''} key={option.id} onClick={() => onChange(option.id)} tabIndex={open ? 0 : -1} type="button">{option.label}</button>
        ))}
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

const OKLAB_CACHE = new Map<MunsellColor, number[]>();
const labForColor = (color: MunsellColor) => {
  const cached = OKLAB_CACHE.get(color);
  if (cached) return cached;
  const lab = rgbToOklab(color.rgb);
  OKLAB_CACHE.set(color, lab);
  return lab;
};

function nearestColor(rgb: [number, number, number], candidates: MunsellColor[]) {
  let best = candidates[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  const source = rgbToOklab(rgb);
  for (const candidate of candidates) {
    const target = labForColor(candidate);
    const distance = (source[0] - target[0]) ** 2 + (source[1] - target[1]) ** 2 + (source[2] - target[2]) ** 2;
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

function perceptualDistance(a: MunsellColor, b: MunsellColor) {
  const first = labForColor(a);
  const second = labForColor(b);
  return Math.sqrt((first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2);
}

function contextColorsFor(target: MunsellColor, exercise: Exercise, familyHue: string) {
  const isTarget = (color: MunsellColor) => color.h === target.h && color.v === target.v && color.c === target.c;
  let candidates: MunsellColor[];
  if (exercise === 'hue') {
    candidates = HUE_TRAINING_POOL.filter((color) => !isTarget(color));
  } else if (exercise === 'value') {
    candidates = VALUE_TRAINING_POOL.filter((color) => !isTarget(color) && Math.abs(color.v - target.v) <= 2);
  } else if (exercise === 'chroma') {
    candidates = IMAGE_COLOR_POOL.filter((color) => !isTarget(color) && color.h === target.h && Math.abs(color.v - target.v) <= 1 && color.c >= 2);
  } else if (exercise === 'family') {
    candidates = IMAGE_COLOR_POOL.filter((color) => !isTarget(color) && color.h === familyHue && color.c >= 2);
  } else {
    candidates = SWATCH_POOL.filter((color) => !isTarget(color));
  }

  const scored = candidates.map((color) => {
    const score = exercise === 'hue'
      ? hueDistance(color.h, target.h) * 0.2 + Math.abs(color.v - target.v) * 0.25 + Math.abs(color.c - target.c) * 0.06
      : exercise === 'value'
        ? Math.abs(color.v - target.v) * 0.3 + perceptualDistance(color, target) * 0.4
        : exercise === 'chroma'
          ? Math.abs(color.c - target.c) * 0.16 + Math.abs(color.v - target.v) * 0.45
          : exercise === 'family'
            ? Math.abs(color.v - target.v) * 0.28 + Math.abs(color.c - target.c) * 0.1
            : perceptualDistance(color, target) * 3.2;
    return { color, score: score + Math.random() * 1.2 };
  }).sort((a, b) => a.score - b.score);

  const selected = scored.slice(0, 8).map((entry) => entry.color);
  if (selected.length < 8) {
    const used = new Set(selected.map(notation));
    for (const color of SWATCH_POOL) {
      if (isTarget(color) || used.has(notation(color))) continue;
      selected.push(color);
      used.add(notation(color));
      if (selected.length === 8) break;
    }
  }
  return selected;
}

function chooseLocalSample(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  allowValueOne: boolean,
  subjectBiased: boolean,
  region?: Region,
) {
  const radius = Math.max(3, Math.round(Math.min(width, height) * 0.012));
  const offsets = [
    [0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius],
    [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius],
    [radius * 2, 0], [-radius * 2, 0], [0, radius * 2], [0, -radius * 2],
  ];
  const ringRadius = radius * 5;
  const ringOffsets = [
    [ringRadius, 0], [-ringRadius, 0], [0, ringRadius], [0, -ringRadius],
    [ringRadius, ringRadius], [ringRadius, -ringRadius], [-ringRadius, ringRadius], [-ringRadius, -ringRadius],
  ];
  const marginX = Math.max(radius * 3, Math.round(width * 0.08));
  const marginY = Math.max(radius * 3, Math.round(height * 0.08));
  const regionLeft = region ? Math.max(marginX, Math.round((region.x - region.w / 2) / 100 * width)) : marginX;
  const regionRight = region ? Math.min(width - marginX, Math.round((region.x + region.w / 2) / 100 * width)) : width - marginX;
  const regionTop = region ? Math.max(marginY, Math.round((region.y - region.h / 2) / 100 * height)) : marginY;
  const regionBottom = region ? Math.min(height - marginY, Math.round((region.y + region.h / 2) / 100 * height)) : height - marginY;
  const globalSamples: [number, number, number][] = [];
  for (let row = 1; row <= 9; row++) {
    for (let column = 1; column <= 12; column++) {
      const sampleX = Math.min(width - 1, Math.round(column / 13 * width));
      const sampleY = Math.min(height - 1, Math.round(row / 10 * height));
      const offset = (sampleY * width + sampleX) * 4;
      globalSamples.push(rgbToOklab([pixels[offset], pixels[offset + 1], pixels[offset + 2]]) as [number, number, number]);
    }
  }
  const globalMean = globalSamples.reduce<[number, number, number]>((sum, lab) => (
    [sum[0] + lab[0], sum[1] + lab[1], sum[2] + lab[2]]
  ), [0, 0, 0]).map((channel) => channel / globalSamples.length) as [number, number, number];
  const distance = (first: number[], second: number[]) => Math.sqrt(
    (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2
  );
  const candidates: { x: number; y: number; rgb: [number, number, number]; score: number }[] = [];
  for (let index = 0; index < 280; index++) {
    const x = Math.round(regionLeft + Math.random() * Math.max(1, regionRight - regionLeft - 1));
    const y = Math.round(regionTop + Math.random() * Math.max(1, regionBottom - regionTop - 1));
    const samples = offsets.map(([dx, dy]) => {
      const sampleX = Math.min(width - 1, Math.max(0, x + dx));
      const sampleY = Math.min(height - 1, Math.max(0, y + dy));
      const offset = (sampleY * width + sampleX) * 4;
      return [pixels[offset], pixels[offset + 1], pixels[offset + 2]] as [number, number, number];
    });
    const rgb = samples.reduce<[number, number, number]>((sum, sample) => (
      [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]]
    ), [0, 0, 0]).map((channel) => Math.round(channel / samples.length)) as [number, number, number];
    const labs = samples.map(rgbToOklab);
    const mean = labs.reduce<[number, number, number]>((sum, lab) => (
      [sum[0] + lab[0], sum[1] + lab[1], sum[2] + lab[2]]
    ), [0, 0, 0]).map((channel) => channel / labs.length) as [number, number, number];
    const variance = labs.reduce((sum, lab) => (
      sum + (lab[0] - mean[0]) ** 2 + (lab[1] - mean[1]) ** 2 + (lab[2] - mean[2]) ** 2
    ), 0) / labs.length;
    const lightness = labs.map((lab) => lab[0]);
    const tonalRange = Math.max(...lightness) - Math.min(...lightness);
    const ringLabs = ringOffsets.map(([dx, dy]) => {
      const sampleX = Math.min(width - 1, Math.max(0, x + dx));
      const sampleY = Math.min(height - 1, Math.max(0, y + dy));
      const offset = (sampleY * width + sampleX) * 4;
      return rgbToOklab([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
    });
    const ringMean = ringLabs.reduce<[number, number, number]>((sum, lab) => (
      [sum[0] + lab[0], sum[1] + lab[1], sum[2] + lab[2]]
    ), [0, 0, 0]).map((channel) => channel / ringLabs.length) as [number, number, number];
    const localSeparation = distance(mean, ringMean);
    const globalSeparation = distance(mean, globalMean);
    const centerDistance = Math.hypot(x / width - 0.5, y / height - 0.5);
    const extremePenalty = mean[0] < 0.08 || mean[0] > 0.96 ? 0.02 : 0;
    const centerWeight = region ? 0.001 : subjectBiased ? 0.016 : 0.008;
    const saliencyReward = Math.min(localSeparation, 0.2) * 0.007 + Math.min(globalSeparation, 0.28) * 0.002;
    const score = variance + tonalRange ** 2 * 0.035 + centerDistance * centerWeight + extremePenalty - saliencyReward + Math.random() * 0.0003;
    candidates.push({ x, y, rgb, score });
  }

  const ranked = candidates.sort((a, b) => a.score - b.score);
  const bestScore = ranked[0]?.score ?? 0;
  const mapped = ranked
    .slice(0, 72)
    .filter((candidate) => candidate.score <= bestScore + 0.01)
    .map((candidate) => ({ ...candidate, color: nearestColor(candidate.rgb, IMAGE_COLOR_POOL) }));

  let selected = mapped[0] ?? {
    x: Math.round(width / 2),
    y: Math.round(height / 2),
    rgb: [127, 127, 127] as [number, number, number],
    score: 0,
    color: nearestColor([127, 127, 127], IMAGE_COLOR_POOL),
  };

  const central = mapped.filter((candidate) => Math.hypot(
    (candidate.x / width - .5) / .47,
    (candidate.y / height - .5) / .42,
  ) <= 1);
  const selectionPool = !region && central.length >= 4 && Math.random() < .78 ? central : mapped;
  const valueOne = selectionPool.find((candidate) => candidate.color.v === 1);
  const valueTwo = selectionPool.find((candidate) => candidate.color.v === 2);
  const practical = selectionPool.find((candidate) => candidate.color.v >= 3);

  if (allowValueOne && valueOne) selected = valueOne;
  else if (valueTwo && Math.random() < VALUE_TWO_CHANCE) selected = valueTwo;
  else if (practical) selected = practical;
  else return null;

  return {
    x: selected.x / width * 100,
    y: selected.y / height * 100,
    color: selected.color,
  };
}

function PracticeImage({ prompt, exercise, questionKey, monochrome, allowValueOne, onColor, onError, correct = false }: {
  prompt: ImagePrompt;
  exercise: Exercise;
  questionKey: number;
  monochrome: boolean;
  allowValueOne: boolean;
  onColor: (color: MunsellColor) => void;
  onError: () => void;
  correct?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onErrorRef = useRef(onError);
  const [loading, setLoading] = useState(true);
  const [sample, setSample] = useState<{ x: number; y: number; color: MunsellColor } | null>(null);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.src = prompt.src;
    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const maxWidth = 620;
      const maxHeight = 460;
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
      if (!cancelled) {
        const nextSample = chooseLocalSample(
          data.data,
          width,
          height,
          allowValueOne,
          /figure|portrait|candid|street|studio|people/i.test(prompt.category),
          prompt.region,
        );
        if (!nextSample) {
          setLoading(false);
          onErrorRef.current();
          return;
        }
        setSample(nextSample);
        onColor(nextSample.color);
        setLoading(false);
      }
    };
    image.onerror = () => {
      if (cancelled) return;
      setLoading(false);
      onErrorRef.current();
    };
    return () => { cancelled = true; };
  }, [allowValueOne, exercise, onColor, prompt, questionKey]);

  return (
    <div className={`image-stage ${correct ? 'is-correct' : ''}`}>
      <div className="canvas-wrap">
        <canvas className={monochrome && exercise === 'value' ? 'monochrome' : ''} ref={canvasRef} aria-label={`Practice image: ${prompt.title}`} />
        {loading && <div className="image-loading">Preparing image…</div>}
        {!loading && sample && (
          <div
            className="sample-marker"
            aria-label={`Target sample: ${notation(sample.color)}`}
            style={{ background: rgbCss(monochrome && exercise === 'value' ? NEUTRALS[sample.color.v - 1] : sample.color), left: `${sample.x}%`, top: `${sample.y}%` }}
          />
        )}
      </div>
    </div>
  );
}

const wrapIndex = (index: number, length: number) => ((index % length) + length) % length;
const normalizeAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;

function HueMissMap({ target, guess }: { target: string; guess: string }) {
  const targetIndex = Math.max(0, HUE_ORDER.indexOf(target as (typeof HUE_ORDER)[number]));
  const guessIndex = Math.max(0, HUE_ORDER.indexOf(guess as (typeof HUE_ORDER)[number]));
  const position = (index: number) => `${index * (360 / HUE_ORDER.length)}deg`;
  const rawDelta = targetIndex - guessIndex;
  const signedDelta = Math.abs(rawDelta) <= HUE_ORDER.length / 2
    ? rawDelta
    : rawDelta > 0 ? rawDelta - HUE_ORDER.length : rawDelta + HUE_ORDER.length;
  const travelPosition = `${(guessIndex + signedDelta) * (360 / HUE_ORDER.length)}deg`;
  return (
    <div className="hue-miss-map" aria-label={`Correct hue ${target}; guessed ${guess}`}>
      <div className="mini-hue-wheel" aria-hidden="true">
        {HUE_EDGE_COLORS.map((color, index) => (
          <span className="mini-hue-chip" key={color.h} style={{ '--position': position(index), '--chip-color': rgbCss(color) } as CSSProperties} />
        ))}
        <span className="hue-miss-marker answer travelling" style={{ '--from-position': position(guessIndex), '--to-position': travelPosition } as CSSProperties} />
        <span className="hue-miss-marker guess" style={{ '--position': position(guessIndex) } as CSSProperties} />
      </div>
      <div className="hue-miss-legend">
        <span><i className="answer" />Correct <strong>{target}</strong></span>
        <span><i className="guess" />Your guess <strong>{guess}</strong></span>
      </div>
    </div>
  );
}

function ComparisonMap({ question, choice }: { question: CompareQuestion; choice: number }) {
  if (question.dimension === 'hue') {
    const position = (index: number) => `${index * (360 / HUE_ORDER.length)}deg`;
    const answerHueIndex = HUE_ORDER.indexOf(question.colors[question.correctIndex].h as (typeof HUE_ORDER)[number]);
    const guessHueIndex = HUE_ORDER.indexOf(question.colors[choice].h as (typeof HUE_ORDER)[number]);
    const rawDelta = answerHueIndex - guessHueIndex;
    const delta = rawDelta > HUE_ORDER.length / 2 ? rawDelta - HUE_ORDER.length : rawDelta < -HUE_ORDER.length / 2 ? rawDelta + HUE_ORDER.length : rawDelta;
    const steps = Math.abs(delta);
    return (
      <div className="comparison-map hue" aria-label="Correct and selected colors mapped around the Munsell hue wheel">
        <div className="mini-hue-wheel" aria-hidden="true">
          {HUE_EDGE_COLORS.map((color, index) => (
            <span className="mini-hue-chip" key={color.h} style={{ '--position': position(index), '--chip-color': rgbCss(color) } as CSSProperties} />
          ))}
          <span className="comparison-map-marker answer travelling" style={{ '--from-position': position(guessHueIndex), '--to-position': position(guessHueIndex + delta), '--travel-duration': steps <= 2 ? '760ms' : '500ms', '--travel-delay': steps <= 2 ? '150ms' : '20ms' } as CSSProperties}>{question.correctIndex + 1}</span>
          <span className="comparison-map-marker guess" style={{ '--position': position(guessHueIndex) } as CSSProperties}>{choice + 1}</span>
        </div>
        <div className="comparison-map-copy">
          <span>Correct / your choice</span>
          <strong>{notation(question.colors[question.correctIndex])}</strong>
          <small>Correct · your choice {notation(question.colors[choice])}</small>
        </div>
      </div>
    );
  }

  const values = question.colors.map((color) => question.dimension === 'value' ? color.v : color.c);
  const step = question.dimension === 'value' ? 1 : 2;
  const low = Math.max(question.dimension === 'value' ? 1 : 0, Math.min(...values) - step);
  const high = Math.min(question.dimension === 'value' ? 9 : PRACTICE_CHROMA_MAX, Math.max(...values) + step);
  const position = (value: number) => `${((value - low) / Math.max(step, high - low)) * 100}%`;
  const answerValue = question.dimension === 'value' ? question.colors[question.correctIndex].v : question.colors[question.correctIndex].c;
  const guessValue = question.dimension === 'value' ? question.colors[choice].v : question.colors[choice].c;
  const missedSteps = Math.abs(answerValue - guessValue) / step;
  return (
    <div className="comparison-map axis" aria-label={`Correct and selected colors mapped by ${question.dimension}`}>
      <div className="comparison-axis">
        <span className="comparison-axis-line" />
        <span className="comparison-axis-marker answer travelling" style={{ '--from-left': position(guessValue), left: position(answerValue), '--travel-duration': missedSteps <= 1 ? '720ms' : '480ms', '--travel-delay': missedSteps <= 1 ? '140ms' : '20ms' } as CSSProperties}>{question.correctIndex + 1}</span>
        <span className="comparison-axis-marker guess" style={{ left: position(guessValue) }}>{choice + 1}</span>
        <small className="axis-low">{low}</small>
        <small className="axis-high">{high}</small>
      </div>
      <div className="comparison-map-copy">
        <span>{question.dimension === 'value' ? 'Value axis' : 'Chroma axis'}</span>
        <strong>{notation(question.colors[question.correctIndex])}</strong>
        <small>Correct · your choice {notation(question.colors[choice])}</small>
      </div>
    </div>
  );
}

function nearestNotationColor(hue: string, value: number, chroma: number) {
  if (hue === 'N') return NEUTRALS[Math.min(8, Math.max(0, value - 1))];
  const candidates = MUNSELL_COLORS.filter((color) => color.h === hue);
  return [...candidates].sort((a, b) => (
    Math.abs(a.v - value) * 6 + Math.abs(a.c - chroma)
    - (Math.abs(b.v - value) * 6 + Math.abs(b.c - chroma))
  ))[0];
}

function shuffledComparison(prompt: string, colors: MunsellColor[], correct: MunsellColor, dimension: CompareQuestion['dimension']): CompareQuestion {
  const entries = colors.map((color) => ({ color, correct: color === correct }));
  for (let index = entries.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [entries[index], entries[swap]] = [entries[swap], entries[index]];
  }
  return {
    prompt,
    colors: entries.map((entry) => entry.color),
    correctIndex: entries.findIndex((entry) => entry.correct),
    dimension,
  };
}

function createCompareQuestion(dimension: CompareDimension): CompareQuestion {
  if (dimension === 'value') {
    const lighter = Math.random() < .5;
    const start = 2 + Math.floor(Math.random() * 4);
    const values = [start, start + 1, start + 2, start + 3];
    const hueChoices = shuffled(HUE_ORDER).slice(0, 4);
    const chromaChoices = shuffled([4, 6, 8, 10]);
    const colors = values.map((value, index) => nearestNotationColor(hueChoices[index], value, chromaChoices[index])).filter((color): color is MunsellColor => Boolean(color));
    const correct = [...colors].sort((a, b) => a.v - b.v)[lighter ? colors.length - 1 : 0];
    return shuffledComparison(lighter ? 'Which color is lighter?' : 'Which color is darker?', colors, correct, 'value');
  }

  if (dimension === 'chroma') {
    const moreChromatic = Math.random() < .5;
    const chromas = Math.random() < .5 ? [2, 4, 6, 8] : [4, 6, 8, 10];
    const hueChoices = shuffled(HUE_ORDER).slice(0, 4);
    const valueChoices = shuffled([4, 5, 5, 6]);
    const colors = chromas.map((chroma, index) => nearestNotationColor(hueChoices[index], valueChoices[index], chroma)).filter((color): color is MunsellColor => Boolean(color));
    const correct = [...colors].sort((a, b) => a.c - b.c)[moreChromatic ? colors.length - 1 : 0];
    return shuffledComparison(moreChromatic ? 'Which color is more chromatic?' : 'Which color is more neutral?', colors, correct, 'chroma');
  }

  const center = Math.floor(Math.random() * HUE_ORDER.length);
  const correctHue = HUE_ORDER[center];
  const family = familyOf(correctHue);
  const patterns = [
    [-4, -1, 0, 2],   // flanked
    [0, 1, 3, 6],     // answer at the beginning of the arc
    [-7, -4, -2, 0],  // answer at the end of the arc
    [0, 6, 8, 10],    // answer outside a close cluster
    [-5, -2, 0, 1],   // asymmetric close interval
  ];
  const offsets = patterns[Math.floor(Math.random() * patterns.length)];
  const colors = offsets
    .map((offset) => nearestNotationColor(HUE_ORDER[wrapIndex(center + offset, HUE_ORDER.length)], 5, 6))
    .filter((color): color is MunsellColor => Boolean(color));
  const correct = colors.find((color) => color.h === correctHue) ?? colors[0];
  return shuffledComparison(`Which color is closest to ${correctHue} ${HUE_FAMILY_NAMES[family]}?`, colors, correct, 'hue');
}

function HueSlice({ hue }: { hue: string }) {
  const hueColors = MUNSELL_COLORS.filter((color) => color.h === hue);
  const maxChroma = Math.max(2, ...hueColors.map((color) => color.c));
  const chromas = Array.from({ length: maxChroma / 2 + 1 }, (_, index) => index * 2);
  return (
    <div className="practice-hue-slice" aria-label={`Complete ${hue} value and chroma slice`}>
      <div className="hue-chart-scroll">
        <div className="hue-chart" style={{ '--chart-columns': chromas.length } as CSSProperties}>
          <span className="chart-corner">V/C</span>
          {chromas.map((chroma) => <span className="chart-label" key={`head-${chroma}`}>{chroma === 0 ? 'N' : `/${chroma}`}</span>)}
          {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((value) => (
            <div className="chart-row" key={value}>
              <span className="chart-value">{value}</span>
              {chromas.map((chroma) => {
                const color = chroma === 0 ? NEUTRALS[value - 1] : hueColors.find((entry) => entry.v === value && entry.c === chroma);
                return color
                  ? <span className="chart-chip" key={`${value}-${chroma}`} style={{ background: rgbCss(color) }} />
                  : <span className="chart-chip empty" key={`${value}-${chroma}`} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlbersComparison({ correct, guess }: { correct: MunsellColor; guess: MunsellColor }) {
  return (
    <div
      className="albers-compare"
      aria-label={`Correct color ${notation(correct)} outside; your guess ${notation(guess)} inside`}
      style={{ background: rgbCss(correct) }}
    >
      <span className="albers-guess" style={{ background: rgbCss(guess) }} />
    </div>
  );
}

function PaintRecipeCard({ target, recipe, paletteSize }: { target: MunsellColor; recipe: PaintRecipe | null; paletteSize: number }) {
  if (!recipe) return null;
  const formatParts = (parts: number) => parts === .5 ? '½' : Number.isInteger(parts) ? String(parts) : parts.toFixed(1);
  return (
    <section className="paint-recipe" aria-label="Suggested oil paint mixture">
      <div className="paint-recipe-head">
        <div>
          <span className="feedback-kicker">From your {paletteSize}-paint palette</span>
          <strong>Suggested starting mix</strong>
        </div>
        <div className="mix-comparison" aria-label="Ideal target beside the closest obtainable mixture">
          <span style={{ background: rgbCss(target) }}><small>Ideal</small></span>
          <span style={{ background: `rgb(${recipe.rgb.join(',')})` }}><small>Mix</small></span>
        </div>
      </div>
      <ol className="recipe-parts">
        {recipe.ingredients.map(({ paint, parts }) => (
          <li key={paint.id}>
            <i style={{ background: `rgb(${paint.rgb.join(',')})` }} />
            <span>{paint.name}<small>{paint.pigment}</small></span>
            <strong>{formatParts(parts)} {parts === 1 ? 'part' : 'parts'}</strong>
          </li>
        ))}
      </ol>
      <div className="recipe-foot">
        <strong>Closest from this palette</strong>
        <span>Practical starting estimate. Adjust by eye for your paint film, brand, and light.</span>
      </div>
    </section>
  );
}

function PaletteSheet({ selectedIds, onChange, onClose }: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const selected = new Set(selectedIds);
  const toggle = (id: string) => {
    if (selected.has(id)) {
      if (selected.size === 1) return;
      onChange(selectedIds.filter((paintId) => paintId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="progress-sheet palette-sheet" role="dialog" aria-modal="true" aria-labelledby="palette-title">
        <div className="sheet-head">
          <div><span className="eyebrow">Saved on this device</span><h2 id="palette-title">Your paint box</h2></div>
          <button className="close-button" onClick={onClose} type="button" aria-label="Close palette">×</button>
        </div>
        <p className="palette-intro">Choose the tubes you actually own. Recipes will use no more than four and favor the simplest close match.</p>
        <div className="palette-presets" aria-label="Palette presets">
          {Object.entries(PALETTE_PRESETS).map(([name, ids]) => (
            <button className={ids.length === selectedIds.length && ids.every((id) => selected.has(id)) ? 'active' : ''} key={name} onClick={() => onChange([...ids])} type="button">{name}</button>
          ))}
        </div>
        <div className="paint-catalog">
          {PAINT_CATEGORIES.map((category) => {
            const paints = PAINTS.filter((paint) => paint.category === category);
            if (!paints.length) return null;
            return (
              <section key={category}>
                <header><strong>{category}</strong><span>{paints.filter((paint) => selected.has(paint.id)).length}/{paints.length}</span></header>
                <div className="paint-options">
                  {paints.map((paint) => (
                    <button aria-pressed={selected.has(paint.id)} className={selected.has(paint.id) ? 'selected' : ''} key={paint.id} onClick={() => toggle(paint.id)} type="button">
                      <i style={{ background: `rgb(${paint.rgb.join(',')})` }} />
                      <span><strong>{paint.name}</strong><small>{paint.pigment} · {paint.brands ?? 'Gamblin'} · {paint.opacity.replace('-', ' ')}</small></span>
                      <b aria-hidden="true">{selected.has(paint.id) ? '✓' : '+'}</b>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <div className="palette-summary">
          <strong>{selectedIds.length} paints selected</strong>
          <span>{PAINTS.length} practical Gamblin / Winsor &amp; Newton paints · screen-based estimate</span>
        </div>
      </section>
    </div>
  );
}

function HueWheel({ value, onChange }: { value: string; onChange: (hue: string) => void }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, HUE_ORDER.indexOf(value as (typeof HUE_ORDER)[number]));
  const selectedIndex = useRef(activeIndex);
  const [rotation, setRotation] = useState(0);
  const momentumFrame = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const drag = useRef({ pointerId: -1, lastAngle: 0, lastAt: 0, total: 0, velocity: 0, moved: false });
  const stepAngle = 360 / HUE_ORDER.length;

  useEffect(() => () => {
    if (momentumFrame.current !== undefined) window.cancelAnimationFrame(momentumFrame.current);
  }, []);

  const angleAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = wheelRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    return Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) * 180 / Math.PI;
  };

  const applyRotation = (total: number) => {
    const crossed = Math.round(total / stepAngle);
    let residual = total;
    if (crossed) {
      selectedIndex.current = wrapIndex(selectedIndex.current - crossed, HUE_ORDER.length);
      residual -= crossed * stepAngle;
      onChange(HUE_ORDER[selectedIndex.current]);
    }
    drag.current.total = residual;
    setRotation(residual);
  };

  const selectHue = (hue: string) => {
    const index = HUE_ORDER.indexOf(hue as (typeof HUE_ORDER)[number]);
    if (index < 0) return;
    selectedIndex.current = index;
    drag.current.total = 0;
    setRotation(0);
    onChange(hue);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wheel = wheelRef.current;
    if (!wheel || drag.current.pointerId !== event.pointerId) return;
    if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
    drag.current.pointerId = -1;
    if (!drag.current.moved) {
      drag.current.total = 0;
      setRotation(0);
      return;
    }
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 160);
    const glide = () => {
      drag.current.velocity *= 0.94;
      applyRotation(drag.current.total + drag.current.velocity * 16);
      if (Math.abs(drag.current.velocity) < 0.012) {
        momentumFrame.current = undefined;
        drag.current.total = 0;
        setRotation(0);
        return;
      }
      momentumFrame.current = window.requestAnimationFrame(glide);
    };
    if (Math.abs(drag.current.velocity) >= 0.012) momentumFrame.current = window.requestAnimationFrame(glide);
    else {
      drag.current.total = 0;
      setRotation(0);
    }
  };

  const move = (amount: number) => selectHue(HUE_ORDER[wrapIndex(selectedIndex.current + amount, HUE_ORDER.length)]);

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
        if (momentumFrame.current !== undefined) {
          window.cancelAnimationFrame(momentumFrame.current);
          momentumFrame.current = undefined;
        }
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
          drag.current.velocity = delta / elapsed;
          applyRotation(drag.current.total + delta);
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
            onClick={() => selectHue(hue)}
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
    const nextChip = HUE_EDGE_COLORS.find((color) => color.h === nextHue) ?? nextColors[0];
    setHue(nextHue);
    if (nextChip) setSelectedChip(nextChip);
  };

  return (
    <section className="reference-view" aria-labelledby="reference-title">
      <div className="reference-intro">
        <span className="eyebrow">Reference</span>
        <h1 id="reference-title">Munsell Hues</h1>
        <p>Rotate the wheel and the hue page follows the chip crossing the top marker. Value rises vertically; chroma moves outward from neutral.</p>
      </div>

      <div className="reference-workbench">
        <div className="reference-wheel-column">
          <HueWheel value={hue} onChange={changeHue} />
          <div className="reference-readout" aria-live="polite">
            <div><span>Selected chip</span><strong>{notation(selectedChip)}</strong></div>
            <span className="reference-readout-swatch" style={{ background: rgbCss(selectedChip) }} />
            <div><span>Hue practice</span><strong>Highest in-gamut chroma</strong></div>
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
      </div>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<AppView>('practice');
  const [source, setSource] = useState<SourceMode>('swatch');
  const [swatchPresentation, setSwatchPresentation] = useState<SwatchPresentation>('isolated');
  const [huePresentation, setHuePresentation] = useState<HuePresentation>('swatch');
  const [exercise, setExercise] = useState<Exercise>('value');
  const [valueMonochrome, setValueMonochrome] = useState(false);
  const [familyHue, setFamilyHue] = useState('5BG');
  const [target, setTarget] = useState<MunsellColor>(INITIAL_VALUE_COLOR);
  const [mixerTarget, setMixerTarget] = useState<MunsellColor>(INITIAL_VALUE_COLOR);
  const [imagePrompt, setImagePrompt] = useState<ImagePrompt>(ACTIVE_IMAGE_BANK[0] ?? IMAGE_PROMPTS[0]);
  const [imageReady, setImageReady] = useState(true);
  const [allowValueOneImageTarget, setAllowValueOneImageTarget] = useState(false);
  const [answerH, setAnswerH] = useState('5BG');
  const [answerV, setAnswerV] = useState('5');
  const [answerC, setAnswerC] = useState('6');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [submitted, setSubmitted] = useState<Attempt | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedPaintIds, setSelectedPaintIds] = useState<string[]>(initialPaletteIds);
  const [sessionCount, setSessionCount] = useState(1);
  const [streak, setStreak] = useState(0);
  const [compareDimension, setCompareDimension] = useState<CompareDimension>('value');
  const [compareQuestion, setCompareQuestion] = useState<CompareQuestion>(() => ({
    prompt: 'Which color is lighter?',
    colors: [3, 4, 5, 6].map((value) => nearestNotationColor('5BG', value, 4)).filter((color): color is MunsellColor => Boolean(color)),
    correctIndex: 3,
    dimension: 'value',
  }));
  const [compareChoice, setCompareChoice] = useState<number | null>(null);
  const [lastCompareTarget, setLastCompareTarget] = useState<MunsellColor | null>(null);
  const [mobileRail, setMobileRail] = useState<'view' | 'skill' | null>(null);
  const startedAt = useRef(0);
  const answerPanelRef = useRef<HTMLElement>(null);
  const compareAdvanceTimer = useRef<number | undefined>(undefined);
  const lastStandardExercise = useRef<Exclude<Exercise, 'compare'>>('value');
  const imageDeck = useRef<ImagePrompt[]>(shuffled(ACTIVE_IMAGE_BANK));
  const recentImageIds = useRef<string[]>([]);
  const recentTargetKeys = useRef<string[]>([]);
  const recentImageTargetValues = useRef<number[]>([]);
  const recordedImageQuestion = useRef('');
  const answerHLive = useRef('5BG');
  const answerVLive = useRef('5');
  const answerCLive = useRef('6');

  useEffect(() => {
    startedAt.current = Date.now();
    const targetTimer = window.setTimeout(() => setTarget(VALUE_TRAINING_POOL[Math.floor(Math.random() * VALUE_TRAINING_POOL.length)] ?? INITIAL_VALUE_COLOR), 0);
    readAttempts().then(setAttempts).catch(() => undefined);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return () => window.clearTimeout(targetTimer);
  }, []);

  const changeSelectedPaints = useCallback((ids: string[]) => {
    const valid = [...new Set(ids)].filter((id) => PAINTS.some((paint) => paint.id === id));
    if (!valid.length) return;
    setSelectedPaintIds(valid);
    try { window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(valid)); } catch { /* Keep the selection for this session. */ }
  }, []);

  useEffect(() => () => {
    if (compareAdvanceTimer.current !== undefined) window.clearTimeout(compareAdvanceTimer.current);
  }, []);

  useEffect(() => {
    imageDeck.current.slice(0, 2).forEach((prompt) => {
      const image = new Image();
      image.decoding = 'async';
      image.crossOrigin = 'anonymous';
      image.src = prompt.src;
    });
  }, [imagePrompt]);

  const resetAnswer = useCallback(() => {
    answerHLive.current = '5BG';
    answerVLive.current = '5';
    answerCLive.current = '6';
    setAnswerH('5BG');
    setAnswerV('5');
    setAnswerC('6');
    setSubmitted(null);
    startedAt.current = Date.now();
  }, []);

  const nextQuestion = useCallback((nextSource = source, nextExercise = exercise, nextFamilyHue = familyHue, nextCompareDimension = compareDimension) => {
    resetAnswer();
    setCompareChoice(null);
    if (nextExercise === 'compare') {
      setCompareQuestion(createCompareQuestion(nextCompareDimension));
      setImageReady(true);
      return;
    }
    if (nextSource === 'image' && nextExercise !== 'family') {
      const recentlyUsedValueOne = recentImageTargetValues.current.slice(-VALUE_ONE_COOLDOWN).includes(1);
      setAllowValueOneImageTarget(!recentlyUsedValueOne && Math.random() < VALUE_ONE_CHANCE);
      const blockedImages = new Set([...recentImageIds.current.slice(-18), imagePrompt.id]);
      if (!imageDeck.current.length || !imageDeck.current.some((prompt) => !blockedImages.has(prompt.id))) {
        imageDeck.current = shuffled(ACTIVE_IMAGE_BANK.filter((prompt) => !blockedImages.has(prompt.id)));
      }
      const nextImage = imageDeck.current.find((prompt) => !blockedImages.has(prompt.id)) ?? ACTIVE_IMAGE_BANK[0];
      imageDeck.current = imageDeck.current.filter((prompt) => prompt.id !== nextImage.id);
      recentImageIds.current = [...recentImageIds.current, nextImage.id].slice(-24);
      setImagePrompt(nextImage);
      setImageReady(false);
    } else {
      const pool = nextExercise === 'value'
        ? VALUE_TRAINING_POOL
        : nextExercise === 'hue'
          ? HUE_TRAINING_POOL
          : nextExercise === 'family'
            ? IMAGE_COLOR_POOL.filter((color) => color.h === nextFamilyHue)
            : SWATCH_POOL;
      const cooldown = nextExercise === 'value' ? 4 : nextExercise === 'chroma' ? 3 : 8;
      const blocked = recentTargetKeys.current.slice(-cooldown);
      const nextTarget = chooseTrainingTarget(pool, nextExercise, attempts, blocked);
      recentTargetKeys.current = [...recentTargetKeys.current, targetKey(nextTarget, nextExercise)].slice(-16);
      setTarget(nextTarget);
      setImageReady(true);
    }
  }, [attempts, compareDimension, exercise, familyHue, imagePrompt.id, resetAnswer, source]);

  const presentation: SwatchPresentation | 'image' | 'contrast' = exercise === 'compare' ? 'contrast' : source === 'image' ? 'image' : swatchPresentation;

  const changePresentation = (next: SwatchPresentation | 'image' | 'contrast') => {
    if (next === presentation) return;
    if (compareAdvanceTimer.current !== undefined) {
      window.clearTimeout(compareAdvanceTimer.current);
      compareAdvanceTimer.current = undefined;
    }
    if (next === 'contrast') {
      if (exercise !== 'compare') lastStandardExercise.current = exercise;
      setExercise('compare');
      setSource('swatch');
      setSwatchPresentation('isolated');
      nextQuestion('swatch', 'compare', familyHue, compareDimension);
      return;
    }
    const nextSource: SourceMode = next === 'image' ? 'image' : 'swatch';
    const restoredExercise = exercise === 'compare' ? lastStandardExercise.current : exercise;
    const nextExercise = nextSource === 'image' && restoredExercise === 'family' ? 'full' : restoredExercise;
    if (nextExercise !== exercise) setExercise(nextExercise);
    if (next !== 'image') {
      setSwatchPresentation(next);
      if (next === 'context') setHuePresentation('swatch');
    }
    setSource(nextSource);
    nextQuestion(nextSource, nextExercise, familyHue);
  };

  const changeExercise = (next: Exercise) => {
    if (next === 'compare') return;
    lastStandardExercise.current = next;
    const nextSource = next === 'family' ? 'swatch' : source;
    setExercise(next);
    if (next === 'family') setSource('swatch');
    nextQuestion(nextSource, next, familyHue);
  };

  const changeCompareDimension = (next: CompareDimension) => {
    if (next === compareDimension) return;
    if (compareAdvanceTimer.current !== undefined) window.clearTimeout(compareAdvanceTimer.current);
    compareAdvanceTimer.current = undefined;
    setCompareDimension(next);
    setSessionCount((count) => count + 1);
    nextQuestion('swatch', 'compare', familyHue, next);
  };

  const changeHuePresentation = (next: HuePresentation) => {
    if (next === huePresentation) return;
    setHuePresentation(next);
    if (next === 'slice') setSwatchPresentation('isolated');
    nextQuestion('swatch', 'hue', familyHue);
  };

  const changeFamilyHue = (next: string) => {
    setFamilyHue(next);
    nextQuestion('swatch', 'family', next);
  };

  const handleImageColor = useCallback((color: MunsellColor) => {
    const questionId = `${imagePrompt.id}:${exercise}:${sessionCount}`;
    if (recordedImageQuestion.current !== questionId) {
      recordedImageQuestion.current = questionId;
      recentImageTargetValues.current = [...recentImageTargetValues.current, color.v].slice(-(VALUE_ONE_COOLDOWN + 1));
    }
    setTarget(color);
    setImageReady(true);
  }, [exercise, imagePrompt.id, sessionCount]);

  const handleImageError = useCallback(() => {
    setImageReady(false);
    nextQuestion('image', exercise, familyHue);
  }, [exercise, familyHue, nextQuestion]);

  const changeAnswerH = useCallback((next: string) => {
    answerHLive.current = next;
    setAnswerH(next);
  }, []);

  const changeAnswerV = useCallback((next: string) => {
    answerVLive.current = next;
    setAnswerV(next);
  }, []);

  const changeAnswerC = useCallback((next: string) => {
    answerCLive.current = next;
    setAnswerC(next);
  }, []);

  const chooseComparison = async (index: number) => {
    if (compareChoice !== null) return;
    const answer = compareQuestion.colors[index];
    const correct = compareQuestion.colors[compareQuestion.correctIndex];
    const exact = index === compareQuestion.correctIndex;
    const attempt: Attempt = {
      createdAt: Date.now(),
      source: 'swatch',
      exercise: 'compare',
      targetH: correct.h,
      targetV: correct.v,
      targetC: correct.c,
      answerH: answer.h,
      answerV: answer.v,
      answerC: answer.c,
      hueError: hueDistance(answer.h, correct.h),
      valueError: Math.abs(answer.v - correct.v),
      chromaError: Math.abs(answer.c - correct.c) / 2,
      exact,
      responseMs: Date.now() - startedAt.current,
    };
    setCompareChoice(index);
    setLastCompareTarget(correct);
    setStreak((current) => exact ? current + 1 : 0);
    setAttempts((current) => [...current, attempt].slice(-600));
    if (exact) {
      compareAdvanceTimer.current = window.setTimeout(() => {
        compareAdvanceTimer.current = undefined;
        setSessionCount((count) => count + 1);
        nextQuestion('swatch', 'compare', familyHue, compareDimension);
      }, 560);
    }
    await saveAttempt(attempt).catch(() => undefined);
  };

  const submit = async () => {
    if (!imageReady || submitted) return;
    const submittedH = answerHLive.current;
    const submittedV = answerVLive.current;
    const submittedC = answerCLive.current;
    const hueError = target.h === 'N' || exercise === 'family' ? 0 : hueDistance(submittedH, target.h);
    const valueError = Math.abs(Number(submittedV) - target.v);
    const chromaError = target.c === 0 ? 0 : Math.abs(Number(submittedC) - target.c) / 2;
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
      answerH: exercise === 'family' ? familyHue : submittedH,
      answerV: Number(submittedV),
      answerC: Number(submittedC),
      hueError,
      valueError,
      chromaError,
      exact,
      responseMs: Date.now() - startedAt.current,
    };
    setSubmitted(attempt);
    setStreak((current) => exact ? current + 1 : 0);
    setAttempts((current) => [...current, attempt].slice(-600));
    await saveAttempt(attempt).catch(() => undefined);
  };

  const focusFirstAnswer = useCallback(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.innerWidth < 700) return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      answerPanelRef.current?.querySelector<HTMLElement>('.picker')?.focus({ preventScroll: true });
    }));
  }, []);

  const advanceQuestion = () => {
    if (compareAdvanceTimer.current !== undefined) window.clearTimeout(compareAdvanceTimer.current);
    compareAdvanceTimer.current = undefined;
    setSessionCount((count) => count + 1);
    nextQuestion();
  };

  useEffect(() => {
    if (view === 'practice' && exercise !== 'compare' && !progressOpen && !submitted && imageReady) focusFirstAnswer();
  }, [exercise, focusFirstAnswer, imageReady, progressOpen, sessionCount, source, submitted, view]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (progressOpen || paletteOpen || view !== 'practice') return;
      const element = event.target as HTMLElement | null;
      if (exercise === 'compare') {
        if (compareChoice === null && ['1', '2', '3', '4'].includes(event.key)) {
          event.preventDefault();
          void chooseComparison(Number(event.key) - 1);
          return;
        }
        if (event.key === 'Enter' && !event.repeat && compareChoice !== null && compareChoice !== compareQuestion.correctIndex) {
          event.preventDefault();
          advanceQuestion();
        }
        return;
      }
      if (event.key === 'Tab' && !submitted) {
        const pickers = Array.from(answerPanelRef.current?.querySelectorAll<HTMLElement>('.picker') ?? []);
        if (pickers.length > 1) {
          event.preventDefault();
          const activeIndex = pickers.findIndex((picker) => picker === document.activeElement);
          const nextIndex = event.shiftKey
            ? (activeIndex <= 0 ? pickers.length - 1 : activeIndex - 1)
            : (activeIndex + 1) % pickers.length;
          pickers[nextIndex].focus({ preventScroll: true });
        }
        return;
      }
      if (event.key !== 'Enter' || event.repeat) return;
      if (element?.closest('input, textarea, select, a, button')) return;
      event.preventDefault();
      if (submitted) advanceQuestion();
      else void submit();
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  });

  const promptText = exercise === 'value'
    ? 'Identify this value'
    : exercise === 'hue'
      ? 'Identify this hue'
      : exercise === 'chroma'
        ? 'Identify this chroma'
        : exercise === 'family'
          ? `Identify value & chroma within ${familyHue}`
          : exercise === 'compare'
            ? compareQuestion.prompt
            : 'Identify hue, value & chroma';
  const resolvedAnswerH = submitted?.answerH ?? answerH;
  const resolvedAnswerV = String(submitted?.answerV ?? answerV);
  const resolvedAnswerC = String(submitted?.answerC ?? answerC);
  const visibleAnswer = exercise === 'value'
    ? `N${resolvedAnswerV}`
    : exercise === 'hue'
      ? resolvedAnswerH
      : exercise === 'chroma'
        ? `/${resolvedAnswerC}`
        : exercise === 'family'
          ? `${familyHue} ${resolvedAnswerV}/${resolvedAnswerC}`
          : `${resolvedAnswerH} ${resolvedAnswerV}/${resolvedAnswerC}`;
  const visibleTarget = exercise === 'value'
    ? `N${target.v}`
    : exercise === 'hue'
      ? target.h
      : exercise === 'chroma'
        ? `/${target.c}`
        : notation(target);
  const guessedColor = useMemo(() => {
    if (exercise === 'value') return nearestNotationColor(target.h, Number(resolvedAnswerV), target.c) ?? NEUTRALS[Number(resolvedAnswerV) - 1];
    if (exercise === 'hue') return nearestNotationColor(resolvedAnswerH, target.v, target.c) ?? target;
    if (exercise === 'chroma') return nearestNotationColor(target.h, target.v, Number(resolvedAnswerC)) ?? target;
    if (exercise === 'family') return nearestNotationColor(familyHue, Number(resolvedAnswerV), Number(resolvedAnswerC)) ?? target;
    return nearestNotationColor(resolvedAnswerH, Number(resolvedAnswerV), Number(resolvedAnswerC)) ?? target;
  }, [exercise, familyHue, resolvedAnswerC, resolvedAnswerH, resolvedAnswerV, target]);
  const missPrompt = submitted ? MISS_PROMPTS[Math.floor(submitted.createdAt / 1000) % MISS_PROMPTS.length] : MISS_PROMPTS[0];
  const exerciseOptions: [Exercise, string][] = [
    ['value', 'Value'],
    ['hue', 'Hue'],
    ['chroma', 'Chroma'],
    ...(source === 'swatch' ? [['family', 'Family'] as [Exercise, string]] : []),
    ['full', 'Full H/V/C'],
  ];
  const contextColors = useMemo(() => contextColorsFor(target, exercise, familyHue), [exercise, familyHue, target]);
  const contextGrid = useMemo(() => [
    ...contextColors.slice(0, 4),
    target,
    ...contextColors.slice(4, 8),
  ], [contextColors, target]);
  const displayColor = (color: MunsellColor) => exercise === 'value' && valueMonochrome ? NEUTRALS[color.v - 1] : color;
  const paintRecipe = useMemo(
    () => submitted ? suggestPaintRecipe(target, selectedPaintIds) : null,
    [selectedPaintIds, submitted, target],
  );
  const lastCompareRecipe = useMemo(
    () => lastCompareTarget ? suggestPaintRecipe(lastCompareTarget, selectedPaintIds) : null,
    [lastCompareTarget, selectedPaintIds],
  );

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

  const hueMiss = Boolean(submitted && (exercise === 'hue' || exercise === 'full') && submitted.hueError > 0);
  const feedbackErrors = submitted ? [
    (exercise === 'hue' || exercise === 'full') && submitted.hueError > 0
      ? `Your guess is ${submitted.hueError} hue step${submitted.hueError === 1 ? '' : 's'} toward ${HUE_FAMILY_NAMES[familyOf(submitted.answerH)] ?? familyOf(submitted.answerH)}`
      : null,
    (exercise === 'value' || exercise === 'family' || exercise === 'full') && submitted.valueError > 0
      ? `${submitted.valueError} value step${submitted.valueError === 1 ? '' : 's'} ${submitted.answerV > submitted.targetV ? 'too light' : 'too dark'}`
      : null,
    (exercise === 'chroma' || exercise === 'family' || exercise === 'full') && submitted.chromaError > 0
      ? `${submitted.chromaError} chroma step${submitted.chromaError === 1 ? '' : 's'} ${submitted.answerC > submitted.targetC ? 'too high' : 'too low'}`
      : null,
  ].filter((message): message is string => Boolean(message)) : [];

  const openMixerWith = (color: MunsellColor) => {
    setMixerTarget(color);
    setPaletteOpen(false);
    setProgressOpen(false);
    setView('mix');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Munsell Eye</span>
        </div>
        <button aria-label="Open paint palette" className="palette-access" onClick={() => { setProgressOpen(false); setPaletteOpen(true); }} title="Paint palette" type="button"><span>Palette</span><i /><i /><i /></button>
        <nav className="top-actions" aria-label="App sections">
          <button className={view === 'practice' ? 'active' : ''} onClick={() => setView('practice')} type="button">Practice</button>
          <button className={view === 'image' ? 'active' : ''} onClick={() => setView('image')} type="button">Image</button>
          <button className={view === 'mix' ? 'active' : ''} onClick={() => setView('mix')} type="button">Mix</button>
          <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')} type="button">Explore</button>
          <button className={view === 'reference' ? 'active' : ''} onClick={() => setView('reference')} type="button">Reference</button>
          <button className="quiet-button" type="button" onClick={() => { setPaletteOpen(false); setProgressOpen(true); }}>Progress</button>
        </nav>
      </header>

      {view === 'practice' ? (
        <section className="workspace" aria-label="Color identification practice">
        <div className="mode-row desktop-practice-controls">
          <div className="segmented display-segmented" aria-label="Question presentation">
            {([
              { id: 'isolated', label: 'Swatch' },
              { id: 'context', label: 'Context' },
              { id: 'contrast', label: 'Contrast' },
              { id: 'image', label: 'Image' },
            ] as const).map((mode) => (
              <button
                className={presentation === mode.id ? 'active' : ''}
                key={mode.id}
                onClick={() => changePresentation(mode.id)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          {streak > 1 && <div className="question-meta"><span className="streak-count">{streak} in a row</span></div>}
        </div>

        <div className="mobile-practice-controls" aria-label="Practice controls">
          <MobileChoiceRail<string>
            compressed={mobileRail === 'skill'}
            label="View"
            onChange={(next) => { changePresentation(next as SwatchPresentation | 'image' | 'contrast'); setMobileRail(null); }}
            onToggle={() => setMobileRail((current) => current === 'view' ? null : 'view')}
            open={mobileRail === 'view'}
            options={[{ id: 'isolated', label: 'Swatch' }, { id: 'context', label: 'Context' }, { id: 'contrast', label: 'Contrast' }, { id: 'image', label: 'Image' }]}
            value={presentation}
          />
          <MobileChoiceRail<string>
            compressed={mobileRail === 'view'}
            label="Skill"
            onChange={(next) => { if (exercise === 'compare') changeCompareDimension(next as CompareDimension); else changeExercise(next as Exercise); setMobileRail(null); }}
            onToggle={() => setMobileRail((current) => current === 'skill' ? null : 'skill')}
            open={mobileRail === 'skill'}
            options={exercise === 'compare'
              ? [{ id: 'value', label: 'Value' }, { id: 'hue', label: 'Hue' }, { id: 'chroma', label: 'Chroma' }]
              : exerciseOptions.map(([id, label]) => ({ id, label }))}
            value={exercise === 'compare' ? compareDimension : exercise}
          />
          {exercise === 'value' ? (
            <div className={`segmented value-display-toggle ${mobileRail ? 'mobile-toggle-hidden' : ''}`} aria-label="Value question appearance">
              <button className={!valueMonochrome ? 'active' : ''} onClick={() => setValueMonochrome(false)} type="button">Color</button>
              <button className={valueMonochrome ? 'active' : ''} onClick={() => setValueMonochrome(true)} type="button">B&amp;W</button>
            </div>
          ) : exercise === 'hue' && source === 'swatch' ? (
            <div className={`segmented value-display-toggle ${mobileRail ? 'mobile-toggle-hidden' : ''}`} aria-label="Hue question appearance">
              <button className={huePresentation === 'swatch' ? 'active' : ''} onClick={() => changeHuePresentation('swatch')} type="button">Swatch</button>
              <button className={huePresentation === 'slice' ? 'active' : ''} onClick={() => changeHuePresentation('slice')} type="button">Slice</button>
            </div>
          ) : null}
        </div>

        <div className="exercise-control-row desktop-practice-controls">
          {exercise === 'compare' ? (
            <nav className="exercise-tabs contrast-tabs" aria-label="Contrast dimension">
              {(['value', 'hue', 'chroma'] as CompareDimension[]).map((dimension) => (
                <button className={compareDimension === dimension ? 'active' : ''} key={dimension} onClick={() => changeCompareDimension(dimension)} type="button">
                  {dimension[0].toUpperCase() + dimension.slice(1)}
                </button>
              ))}
            </nav>
          ) : (
            <nav className="exercise-tabs" aria-label="Exercise">
              {exerciseOptions.map(([mode, label]) => (
                <button className={exercise === mode ? 'active' : ''} key={mode} onClick={() => changeExercise(mode)} type="button">{label}</button>
              ))}
            </nav>
          )}
          {exercise === 'value' && (
            <div className="segmented value-display-toggle" aria-label="Value question appearance">
              <button className={!valueMonochrome ? 'active' : ''} onClick={() => setValueMonochrome(false)} type="button">Color</button>
              <button className={valueMonochrome ? 'active' : ''} onClick={() => setValueMonochrome(true)} type="button">B&amp;W</button>
            </div>
          )}
          {exercise === 'hue' && source === 'swatch' && (
            <div className="segmented value-display-toggle" aria-label="Hue question appearance">
              <button className={huePresentation === 'swatch' ? 'active' : ''} onClick={() => changeHuePresentation('swatch')} type="button">Swatch</button>
              <button className={huePresentation === 'slice' ? 'active' : ''} onClick={() => changeHuePresentation('slice')} type="button">Slice</button>
            </div>
          )}
        </div>

        {exercise === 'family' && (
          <div className="family-control">
            <div className="family-hue-grid">
              <HuePickers value={familyHue} onChange={changeFamilyHue} />
            </div>
            <small>All valid V1–V9 chips through C12 in this hue.</small>
          </div>
        )}

        <div className={`prompt-copy ${exercise === 'compare' ? 'contrast-prompt' : 'standard-prompt'}`}>
          <div>
            <span>{promptText}</span>
          </div>
          <div className="prompt-settings">
            <span className="difficulty">{exercise === 'value' ? 'N1–N9' : exercise === 'hue' ? source === 'swatch' ? huePresentation === 'slice' ? '40 HUE SLICES' : '40 HUES · EDGE CHROMA' : '40 HUES' : exercise === 'family' ? `${familyHue} · C2–C12` : exercise === 'full' ? 'H / V / C · C2–C12' : exercise === 'compare' ? '4 CLOSE CHIPS' : 'C2–C12'}</span>
          </div>
        </div>

        {exercise === 'compare' ? (
          <div className="compare-stage" aria-label={compareQuestion.prompt}>
            {compareQuestion.colors.map((color, index) => {
              const isCorrect = compareChoice !== null && index === compareQuestion.correctIndex;
              const isWrong = compareChoice === index && index !== compareQuestion.correctIndex;
              return (
                <button
                  aria-label={`Choice ${index + 1}${compareChoice !== null ? `: ${notation(color)}` : ''}`}
                  className={`${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                  disabled={compareChoice !== null}
                  key={`${notation(color)}-${index}`}
                  onClick={() => void chooseComparison(index)}
                  style={{ background: rgbCss(color) }}
                  type="button"
                >
                  <span>{index + 1}</span>
                </button>
              );
            })}
          </div>
        ) : source === 'swatch' ? (
          <div className={`swatch-stage ${submitted?.exact ? 'is-correct' : ''}`} aria-label="Color swatch">
            {exercise === 'hue' && huePresentation === 'slice' ? (
              <HueSlice hue={target.h} />
            ) : swatchPresentation === 'context' ? (
              <div className="context-grid" key={`${sessionCount}-${notation(target)}`}>
                {contextGrid.map((color, index) => (
                  <span
                    aria-label={index === 4 ? 'Target swatch' : undefined}
                    className={`context-chip ${index === 4 ? 'target' : ''}`}
                    key={`${notation(color)}-${index}`}
                    style={{ background: rgbCss(displayColor(color)) }}
                  />
                ))}
              </div>
            ) : (
              <div className="swatch" key={`${sessionCount}-${notation(target)}`} style={{ background: rgbCss(displayColor(target)) }} />
            )}
          </div>
        ) : (
          <>
            <PracticeImage key={`${imagePrompt.id}-${exercise}-${sessionCount}`} prompt={imagePrompt} exercise={exercise} questionKey={sessionCount} monochrome={valueMonochrome} allowValueOne={allowValueOneImageTarget} onColor={handleImageColor} onError={handleImageError} correct={Boolean(submitted?.exact)} />
            <div className="image-caption">
              <span><strong>{imagePrompt.title}</strong> · {imagePrompt.category}</span>
              <a href={imagePrompt.source} target="_blank" rel="noreferrer">{imagePrompt.credit}</a>
            </div>
          </>
        )}

        {exercise === 'compare' ? (
          <div className="contrast-response" aria-live="polite">
            {compareChoice === null ? (
              <p className="contrast-hint">Tap a square or press 1–4</p>
            ) : compareChoice === compareQuestion.correctIndex ? (
              <div className="contrast-correct" role="status"><span aria-hidden="true">✓</span> Correct</div>
            ) : (
              <section className="answer-panel compare-answer-panel" aria-label="Contrast result">
                <button className="check-button practice-action" onClick={advanceQuestion} type="button">Next</button>
                <div className="feedback" role="status">
                  <span className="feedback-kicker">Look at the interval</span>
                  <ComparisonMap question={compareQuestion} choice={compareChoice} />
                </div>
              </section>
            )}
            {lastCompareTarget && lastCompareRecipe && compareChoice !== null && compareChoice !== compareQuestion.correctIndex && (
              <div className="contrast-recipe">
                <PaintRecipeCard target={lastCompareTarget} recipe={lastCompareRecipe} paletteSize={selectedPaintIds.length} />
              </div>
            )}
          </div>
        ) : (
        <section className="answer-panel" aria-label="Your answer" ref={answerPanelRef}>
          <button
            className="check-button practice-action"
            disabled={!submitted && !imageReady}
            onClick={submitted ? advanceQuestion : submit}
            type="button"
          >
            {submitted ? 'Next' : imageReady ? 'Check answer' : 'Preparing image…'}
          </button>
          <div className={`answer-state ${exercise}`}>
            {!submitted ? (
              <>
                <p>Your answer</p>
                <div className={`picker-grid ${exercise === 'full' ? 'full' : exercise === 'family' ? 'family' : exercise === 'hue' ? 'hue' : ''}`}>
                  {(exercise === 'hue' || exercise === 'full') && <HuePickers value={answerH} onChange={changeAnswerH} compact={exercise === 'full'} />}
                  {(exercise === 'value' || exercise === 'family' || exercise === 'full') && <Picker label="Value" options={VALUE_OPTIONS} value={answerV} onChange={changeAnswerV} compact={exercise === 'full' || exercise === 'family'} />}
                  {(exercise === 'chroma' || exercise === 'family' || exercise === 'full') && <Picker label="Chroma" options={CHROMA_OPTIONS} value={answerC} onChange={changeAnswerC} compact={exercise === 'full' || exercise === 'family'} />}
                </div>
              </>
            ) : submitted.exact ? (
              <div className="feedback correct" role="status" aria-live="polite">
                <div className="correct-reward">
                  <span className="reward-mark" aria-hidden="true">✓</span>
                  <div>
                    <strong>Correct</strong>
                    <small>{streak > 1 ? `${streak} in a row` : 'Your eye matched the chip.'}</small>
                  </div>
                </div>
                <PaintRecipeCard target={target} recipe={paintRecipe} paletteSize={selectedPaintIds.length} />
              </div>
            ) : (
              <div className="feedback" role="status" aria-live="polite">
                <div className="feedback-head">
                  <div>
                    <span className="feedback-kicker" key={submitted.createdAt}>{missPrompt}</span>
                    <strong>{hueMiss && exercise === 'hue' ? 'Hue comparison' : visibleTarget}</strong>
                  </div>
                  <AlbersComparison correct={displayColor(target)} guess={displayColor(guessedColor)} />
                </div>
                {!hueMiss && <div className="feedback-guess"><span>Your guess</span><strong>{visibleAnswer}</strong></div>}
                {hueMiss && <HueMissMap target={target.h} guess={resolvedAnswerH} />}
                <div className="feedback-detail">
                  <strong>{feedbackErrors.join(' · ')}</strong>
                  {hueMiss && exercise === 'full' && <small>Your full guess: {visibleAnswer}</small>}
                </div>
                <PaintRecipeCard target={target} recipe={paintRecipe} paletteSize={selectedPaintIds.length} />
              </div>
            )}
          </div>
        </section>
        )}
        </section>
      ) : view === 'image' ? (
        <div className="image-view-shell"><ImageLab onSendToMixer={openMixerWith} selectedPaintIds={selectedPaintIds} /></div>
      ) : view === 'mix' ? (
        <MixerView initialTarget={mixerTarget} onOpenPalette={() => setPaletteOpen(true)} selectedPaintIds={selectedPaintIds} />
      ) : view === 'explore' ? (
        <StudioView onSendToMixer={openMixerWith} />
      ) : (
        <ReferenceView />
      )}

      {paletteOpen && <PaletteSheet selectedIds={selectedPaintIds} onChange={changeSelectedPaints} onClose={() => setPaletteOpen(false)} />}

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
