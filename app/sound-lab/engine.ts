import { harmonicFrame, leadVoices, midiHz, motif } from "./music";
import { type Setup } from "./presets";
import {
  sampleProbe,
  arrivalShape,
  signalPath,
  mapSignals,
  clamp,
  type Signals,
  type ColorSample,
  type Destination,
} from "./journey";
import {
  DEFAULTS,
  frequencies,
  sanitizeParameters,
  type Parameters,
} from "./parameters";

export type Sonic = {
  init(): Promise<void>;
  destroy(): Promise<void>;
  sync(): Promise<unknown>;
  send(address: string, ...args: (number | string)[]): void;
  loadSynthDef(source: string): Promise<unknown>;
  on(event: string, cb: (...args: unknown[]) => void): void;
  node: { connect(node: AudioNode): unknown; disconnect(): void };
};
export type NoteEvent = { x: number; y: number; strength: number; hz: number };

/** Browser SC engine. All synthesis is in scsynth; JS only schedules and controls. */
export class SoundLabEngine {
  parameters: Parameters = sanitizeParameters(DEFAULTS);
  running = false;
  transportGeneration = 0;
  resolved = false;
  ambient = false;
  ambientPaused = false;
  audioPaused = false;
  private stoppedSound = false;
  mappingMode: "on" | "paused" | "off" = "on";
  effectsBypassed = false;
  shotPhase: "idle" | "flight" | "arrival" | "settled" = "idle";
  shotPaused = false;
  progress = 0;
  shotTime = 0;
  liveSignals: Signals | null = null;
  liveColor: ColorSample | null = null;
  mapped: Partial<Record<Destination, number>> = {};
  private baseParameters: Parameters = sanitizeParameters(DEFAULTS);
  private shotSetup: Setup | null = null;
  private shotSamples: ColorSample[] = [];
  private shotSignals: Signals[] = [];
  private shotTimer: ReturnType<typeof setTimeout> | null = null;
  private shotLast = 0;
  private emission = 0;
  private nextEmission = 0;
  private sustainRunning = false;
  private shotIndex = 0;
  private shotStartHarmony = 0;
  private arrivalStart = 0;
  private arrivalCaptured = false;
  private arrivalFrom: number[] = [];
  private playingGroup = 100;
  motifPlaying = false;
  motifPaused = false;
  musicStep = 0;
  private phrase = 0;
  private motifTimer: ReturnType<typeof setTimeout> | null = null;
  private previousTones: number[] = [];
  private musicListeners = new Set<(step: number, playing: boolean) => void>();
  subscribeMusic(listener: (step: number, playing: boolean) => void) {
    this.musicListeners.add(listener);
    return () => {
      this.musicListeners.delete(listener);
    };
  }
  private announceMusic() {
    for (const fn of this.musicListeners) fn(this.musicStep, this.motifPlaying);
  }
  private currentTones() {
    const p = this.parameters;
    if (p.music.source === "custom")
      return frequencies({ ...p, tension: 0 }, true).map(
        (hz) => 69 + 12 * Math.log2(hz / 440),
      );
    const next = harmonicFrame(
      p.music,
      this.resolved ? p.music.destinationStep : this.musicStep,
    ).tones;
    const result =
      p.music.voicing === "smooth" || this.resolved
        ? leadVoices(next, this.previousTones)
        : next;
    this.previousTones = result;
    return result;
  }
  private currentFrequencies() {
    return this.currentTones().map(
      (n, i) =>
        midiHz(n) *
        2 **
          ((this.resolved
            ? 0
            : [0, 115, -76, 180, -145, 85][i] * this.parameters.tension) /
            1200),
    );
  }
  analyser: AnalyserNode | null = null;
  private sonic: Sonic | null = null;
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private gestureTimers = new Set<ReturnType<typeof setTimeout>>();
  private seed = 7139;
  private field = Array.from(
    { length: 12 },
    (_, i) => Math.sin(i * 2.17) * 0.6,
  );
  private next = 200;
  private activeNotes: { id: number; until: number; group: number }[] = [];
  private lastTouch = 0;
  private disposed = false;
  private generation = 0;
  private booting = false;
  private recorder: MediaRecorder | null = null;
  private recordingStream: MediaStreamAudioDestinationNode | null = null;
  private noteListeners = new Set<(note: NoteEvent) => void>();
  subscribeNotes(listener: (note: NoteEvent) => void) {
    this.noteListeners.add(listener);
    return () => {
      this.noteListeners.delete(listener);
    };
  }
  onError?: (message: string) => void;

  async start() {
    if (this.running || this.booting || this.disposed) return;
    this.booting = true;
    const generation = ++this.generation;
    try {
      // Construct and resume in the user gesture, before loading any modules.
      if (!this.context)
        this.context = new AudioContext({ latencyHint: "interactive" });
      await this.context.resume();
      if (!this.sonic) {
        // Bundle the JS entry through Vite; only worker/WASM assets live in public.
        const { SuperSonic } = await import("supersonic-scsynth");
        if (generation !== this.generation || this.disposed) return;
        const sonic = new SuperSonic({
          baseURL: new URL("/sound-lab/runtime/", location.origin).href,
          synthdefBaseURL: new URL("/sound-lab/synthdefs/", location.origin)
            .href,
          audioContext: this.context,
          autoConnect: false,
          mode: "postMessage",
          scsynthOptions: {
            numInputBusChannels: 0,
            numAudioBusChannels: 32,
            numBuffers: 32,
            maxNodes: 128,
            realTimeMemorySize: 16384,
            maxWireBufs: 128,
          },
        });
        this.sonic = sonic;
        sonic.on("error", (...args) => {
          if (!this.running) return;
          this.stop();
          this.onError?.(`Audio stopped: ${args.map(String).join(" ")}`);
        });
        await sonic.init();
        this.output = this.context.createGain();
        this.output.gain.value = 0;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 1024;
        sonic.node.connect(this.output);
        this.output.connect(this.analyser);
        this.analyser.connect(this.context.destination);
        await Promise.all(
          [
            "chroma_chime",
            "chroma_piano",
            "chroma_synth",
            "chroma_flight",
            "chroma_field",
            "chroma_space",
          ].map((name) => sonic.loadSynthDef(name)),
        );
        sonic.send("/b_alloc", 0, Math.ceil(this.context.sampleRate * 6), 1);
        await sonic.sync();
      }
      if (generation !== this.generation || this.disposed) return;
      this.stoppedSound = false;
      this.createNodes();
      this.sustainRunning = this.parameters.music.sustain;
      this.running = true;
      this.resolved = false;
      this.musicStep = 0;
      this.previousTones = [];
      this.announceMusic();
      this.update(this.parameters);
      this.tick();
    } catch (error) {
      this.stop();
      const failed = this.sonic;
      this.sonic = null;
      try {
        await failed?.destroy();
      } catch {
        /* Permit a clean retry after a partial boot. */
      }
      this.analyser = null;
      this.output?.disconnect();
      this.output = null;
      if (this.context?.state !== "closed") await this.context?.close();
      this.context = null;
      throw error;
    } finally {
      this.booting = false;
    }
  }

  private createNodes() {
    const s = this.sonic!;
    s.send("/g_freeAll", 0);
    s.send("/b_zero", 0);
    s.send("/g_new", 100, 0, 0);
    s.send("/g_new", 110, 1, 0);
    s.send("/s_new", "chroma_field", 101, 0, 100, "amp", 0);
    s.send("/s_new", "chroma_flight", 103, 1, 100);
    s.send("/s_new", "chroma_space", 102, 1, 0);
    this.activeNotes = [];
  }

  update(p: Parameters) {
    if (p.music.sustain !== this.baseParameters.music.sustain)
      this.sustainRunning = p.music.sustain;
    this.baseParameters = sanitizeParameters(p);
    this.applyParameters(p);
  }
  private applyParameters(p: Parameters) {
    const before = this.parameters.music;
    this.parameters = sanitizeParameters(p);
    const after = this.parameters.music;
    if (
      before.tonic !== after.tonic ||
      before.mode !== after.mode ||
      before.progression !== after.progression ||
      before.source !== after.source
    ) {
      this.musicStep = 0;
      this.phrase = 0;
      this.announceMusic();
    }
    if (this.resolved) this.musicStep = after.destinationStep;
    if (!this.running || !this.sonic || !this.context || !this.output) return;
    const v = this.parameters;
    this.output.gain.setTargetAtTime(
      this.stoppedSound ? 0 : v.volume,
      this.context.currentTime,
      0.04,
    );
    this.sonic.send(
      "/n_set",
      102,
      "brightness",
      v.brightness,
      "root",
      v.root,
      "ribbon",
      v.ribbon,
      "motion",
      v.motion,
      "echo",
      v.echo,
      "delay",
      v.delay,
      "tail",
      v.tail,
      "grains",
      v.grains,
      "density",
      v.grainDensity,
      "lookback",
      v.grainLookback,
      "spray",
      v.grainSpread,
      "freeze",
      v.freeze,
      "reverse",
      v.reverse,
      "grain",
      v.grain,
      "rate",
      -(2 ** (v.shift / 12)),
      "room",
      v.room,
      "width",
      v.width,
      "resonance",
      v.resonance,
      "sweepDepth",
      v.sweepDepth,
      "sweepOffset",
      v.sweepOffset,
      "sweepDirection",
      v.sweepDirection,
      "bandSpread",
      v.bandSpread,
      "phaseSpread",
      v.phaseSpread,
      "modulation",
      v.modulation,
      "dry",
      v.dry,
      "grainRoute",
      v.grainRoute === "before" ? 1 : 0,
      "saturate",
      v.saturate,
      "textureDrive",
      v.textureDrive,
      "fold",
      v.fold,
      "crossover",
      v.crossover,
      "crossGap",
      v.crossGap,
      "inside",
      v.inside,
      "shred",
      v.shred,
      "shredRate",
      v.shredRate,
      "shredLength",
      v.shredLength,
      "shredScatter",
      v.shredScatter,
      "shredReverse",
      v.shredReverse,
      "wet",
      this.effectsBypassed ? 0 : 1,
    );
    const filter =
      v.filterFollow === "chord"
        ? this.currentFrequencies().slice(0, 4)
        : [1, 1.5, 2, 3].map((r) => v.filterRoot * r);
    this.sonic.send("/n_set", 102, ...filter.flatMap((f, i) => [`f${i}`, f]));
    this.updateField();
  }

  private updateField() {
    if (!this.sonic || !this.running) return;
    const p = this.parameters;
    const fs = this.currentFrequencies();
    this.sonic.send(
      "/n_set",
      101,
      "amp",
      p.music.sustain && this.sustainRunning
        ? p.home * (this.resolved ? 1.2 : 1)
        : 0,
      "width",
      p.width,
      "slew",
      this.resolved ? p.settle : 0.8,
      ...fs.flatMap((f, i) => [`f${i}`, f]),
    );
  }

  setAmbient(on: boolean) {
    if (on) this.wakeAudio();
    this.ambient = on;
    this.updateField();
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private tick = () => {
    if (!this.running) return;
    const p = this.parameters;
    if (
      this.ambient &&
      !this.ambientPaused &&
      !this.audioPaused &&
      p.activity > 0
    ) {
      const previous = [...this.field];
      this.field = previous.map((v, i) =>
        Math.max(
          -1,
          Math.min(
            1,
            0.82 * v +
              0.09 * (previous[(i + 11) % 12] + previous[(i + 1) % 12]) +
              (this.random() - 0.5) * 0.55,
          ),
        ),
      );
      if (this.random() < 0.22 + p.activity * 0.7) {
        const degree = Math.floor((this.field[3] + 1) * 3) % 6;
        this.playingGroup = 110;
        this.note(degree, 0, 0.3 + this.random() * 0.25, this.field[8]);
        this.playingGroup = 100;
      }
    }
    this.timer = setTimeout(
      this.tick,
      280 + (1 - p.activity) * 1100 + this.random() * 850,
    );
  };

  private later(fn: () => void, ms: number) {
    let remaining = ms,
      last = performance.now();
    const tick = () => {
      this.gestureTimers.delete(timer);
      if (!this.running) return;
      const now = performance.now();
      if (!this.audioPaused && !this.motifPaused) remaining -= now - last;
      last = now;
      if (remaining <= 0) {
        fn();
        return;
      }
      timer = setTimeout(tick, Math.min(25, remaining));
      this.gestureTimers.add(timer);
    };
    let timer = setTimeout(tick, Math.min(25, ms));
    this.gestureTimers.add(timer);
  }

  note(degree = 0, octave = 0, strength = 0.8, pan = 0) {
    if (!this.running || !this.sonic) return;
    const hz = Math.min(
      2200,
      Math.max(
        35,
        this.currentFrequencies()[((degree % 6) + 6) % 6] * 2 ** octave,
      ),
    );
    this.playHz(hz, degree, strength, pan);
  }
  private playHz(hz: number, degree: number, strength: number, pan: number) {
    if (!this.running || !this.sonic) return;
    hz = Math.min(2200, Math.max(35, hz));
    const p = this.parameters;
    const now = this.noteClock();
    this.activeNotes = this.activeNotes.filter((note) => note.until > now);
    // Bound voices under rapid drags or repeated scatter/resolve presses.
    if (this.activeNotes.length >= 36) {
      const oldest = this.activeNotes.shift();
      if (oldest) this.sonic.send("/n_free", oldest.id);
    }
    this.activeNotes.push({
      id: this.next,
      until: now + (p.decay + 2) * 1000,
      group: this.playingGroup,
    });
    const instrument =
      p.instrument === "piano"
        ? "chroma_piano"
        : p.instrument === "glass"
          ? "chroma_chime"
          : "chroma_synth";
    this.sonic.send(
      "/s_new",
      instrument,
      this.next++,
      0,
      this.playingGroup,
      "freq",
      hz,
      "amp",
      0.18 * Math.min(1, Math.max(0, strength)),
      "attack",
      p.attack,
      "decay",
      p.decay,
      "material",
      p.material,
      "hardness",
      p.hardness,
      "harmonics",
      p.harmonics,
      "detune",
      p.detune,
      "pan",
      Math.max(-1, Math.min(1, pan * p.width)),
    );
    const event = { hz, strength, x: (pan + 1) / 2, y: 0.8 - degree / 8 };
    for (const listener of this.noteListeners) listener(event);
  }

  touch(x: number, y: number) {
    if (performance.now() - this.lastTouch < 130) return;
    this.lastTouch = performance.now();
    this.note(
      Math.floor(x * 6) % 6,
      y < 0.35 ? 1 : 0,
      0.3 + (1 - y) * 0.65,
      x * 2 - 1,
    );
  }

  private schedulePhrase(phrase: number) {
    const m = this.parameters.music,
      tones = this.currentTones();
    const frame = harmonicFrame(
      m,
      this.resolved ? m.destinationStep : this.musicStep,
    );
    const notes = motif(
      m,
      tones,
      m.source === "custom" ? tones : frame.scale,
      phrase,
      frame.degree,
    );
    for (const [i, n] of notes.entries())
      if (!n.skip)
        this.later(
          () => {
            const bend = this.resolved
              ? 0
              : [0, 115, -76, 180, -145, 85][i % 6] * this.parameters.tension;
            this.playHz(
              midiHz(n.midi) * 2 ** (bend / 1200),
              i % 6,
              n.strength,
              n.pan,
            );
          },
          (n.beat * 60000) / m.bpm,
        );
    return (
      ((m.melody === "grid"
        ? m.melodyLength * m.spacing + m.rest
        : (notes.at(-1)?.beat ?? 0) + m.spacing + m.rest) *
        60000) /
      m.bpm
    );
  }
  scatter() {
    if (!this.running) return;
    this.wakeAudio();
    this.stopMotif();
    this.schedulePhrase(0);
  }
  playMotif() {
    if (!this.running || this.motifPlaying) return;
    this.wakeAudio();
    this.stopJourney();
    this.motifPaused = false;
    this.sustainRunning = this.parameters.music.sustain;
    this.cancelGesture();
    this.motifPlaying = true;
    this.phrase = 0;
    this.runPhrase();
  }
  private runPhrase = () => {
    if (!this.running || !this.motifPlaying) return;
    if (
      this.parameters.music.motifAdvance === "auto" &&
      this.phrase > 0 &&
      this.phrase % this.parameters.music.repeats === 0 &&
      !this.resolved
    )
      this.musicStep++;
    this.updateField();
    this.announceMusic();
    const ms = this.schedulePhrase(this.phrase++);
    let remaining = ms,
      last = performance.now();
    const wait = () => {
      if (!this.running || !this.motifPlaying) return;
      const now = performance.now();
      if (!this.audioPaused && !this.motifPaused) remaining -= now - last;
      last = now;
      if (remaining <= 0) this.runPhrase();
      else this.motifTimer = setTimeout(wait, 25);
    };
    this.motifTimer = setTimeout(wait, 25);
  };
  pauseMotif() {
    this.motifPaused = !this.motifPaused;
  }
  stopMotif() {
    this.motifPlaying = false;
    this.motifPaused = false;
    if (this.motifTimer) clearTimeout(this.motifTimer);
    this.motifTimer = null;
    this.cancelGesture();
    this.announceMusic();
  }
  nextHarmony() {
    if (!this.running) return;
    this.wakeAudio();
    this.resolved = false;
    this.musicStep++;
    this.updateField();
    this.announceMusic();
    if (this.motifPlaying) {
      this.cancelGesture();
      if (this.motifTimer) clearTimeout(this.motifTimer);
      this.phrase = 0;
      this.runPhrase();
    } else if (!["flight", "arrival"].includes(this.shotPhase)) {
      this.cancelGesture();
      [0, 2, 4].forEach((d, i) =>
        this.later(() => this.note(d, 0, 0.5, 0), i * 90),
      );
    }
  }

  private beginArrival(captured: boolean) {
    if (!this.shotSetup) return;
    this.arrivalCaptured = captured;
    this.arrivalFrom = this.currentTones();
    this.shotPhase = "arrival";
    this.arrivalStart = this.shotTime;
    if (captured) {
      this.resolved = true;
      this.musicStep = this.parameters.music.destinationStep;
      this.previousTones = this.arrivalFrom;
    }
    this.updateField();
    this.announceMusic();
  }
  resolve() {
    if (!this.running || this.resolved) return;
    this.wakeAudio();
    this.cancelGesture();
    if (this.shotSetup && ["flight", "arrival"].includes(this.shotPhase)) {
      this.stopMotif();
      this.shotPaused = false;
      this.shotTime = this.shotSetup.journey.duration;
      this.progress = 1;
      this.beginArrival(true);
      return;
    }
    this.resolved = true;
    this.musicStep = this.parameters.music.destinationStep;
    this.updateField();
    this.announceMusic();
    [0, 2, 4, 1, 3, 5].forEach((degree, i) =>
      this.later(
        () => this.note(degree, 0, 0.63 - i * 0.065, (i / 5 - 0.5) * 0.9),
        i * 120,
      ),
    );
  }
  explore() {
    this.resolved = false;
    this.updateField();
    this.announceMusic();
  }
  cancelGesture() {
    for (const t of this.gestureTimers) clearTimeout(t);
    this.gestureTimers.clear();
  }

  stop() {
    this.cancelShot();
    this.generation++;
    this.running = false;
    this.audioPaused = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopMotif();
    this.stopRecording();
    if (this.output && this.context?.state === "running")
      this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
    // Free sources and effects: no scheduled arpeggio or reverse tail survives Stop.
    if (this.sonic && !this.booting) this.sonic.send("/g_freeAll", 0);
  }

  private noteClock() {
    return (this.context?.currentTime ?? performance.now() / 1000) * 1000;
  }
  private wakeAudio() {
    if (this.stoppedSound) {
      this.stoppedSound = false;
      if (this.context)
        this.output?.gain.setTargetAtTime(
          this.baseParameters.volume,
          this.context.currentTime,
          0.012,
        );
    }
  }
  charge(power: number) {
    if (!this.running || !this.sonic) return;
    if (power > 0) this.wakeAudio();
    const fs = this.currentFrequencies();
    this.sonic.send(
      "/n_set",
      103,
      "amp",
      power * this.parameters.drive * 0.2,
      ...this.flightTimbre(0),
      "voices",
      3,
      "normalize",
      0.5,
      "spread",
      0,
      "converge",
      1,
      ...fs.flatMap((f, i) => [`f${i}`, f]),
    );
  }
  private cancelShot() {
    this.transportGeneration++;
    if (this.shotTimer) clearTimeout(this.shotTimer);
    this.shotTimer = null;
    this.shotPhase = "idle";
    this.shotPaused = false;
  }
  configure(setup: Setup) {
    this.update(setup.parameters);
    if (this.shotSetup) this.shotSetup = { ...setup };
  }
  playShot(setup: Setup, samples?: ColorSample[]) {
    if (!this.running || this.audioPaused) return;
    this.wakeAudio();
    this.stopMotif();
    this.cancelShot();
    this.shotSetup = setup;
    this.update(setup.parameters);
    this.seed = setup.parameters.music.seed;
    this.shotSamples =
      samples ??
      Array.from({ length: 193 }, (_, i) =>
        sampleProbe(setup.journey.probe, i / 192),
      );
    this.shotSignals = signalPath(this.shotSamples, setup.journey.duration);
    this.shotTime = 0;
    this.progress = 0;
    this.emission = 0;
    this.nextEmission = 0;
    this.sustainRunning = setup.parameters.music.sustain;
    this.shotIndex = 0;
    this.mapped = {};
    this.resolved = false;
    this.shotPhase = "flight";
    this.arrivalCaptured = false;
    if (["progress", "hue"].includes(setup.journey.advance)) this.musicStep = 0;
    this.shotStartHarmony = this.musicStep;
    if (setup.journey.advance === "shot") this.musicStep++;
    this.arrivalFrom = [];
    this.shotLast = performance.now();
    if (setup.parameters.music.melody !== "grid") this.note(0, 0, 0.8, 0);
    this.runShot();
  }
  private flightTimbre(progress: number): (string | number)[] {
    const p = this.parameters;
    return [
      "vocal",
      p.instrument === "vocal" ? 1 : 0,
      "vowel",
      p.vowel,
      "formantRatio",
      2 ** (p.formantShift / 12),
      "breath",
      p.breath,
      "vibrato",
      p.vibrato,
      "vibratoRate",
      p.vibratoRate,
      "glideTime",
      p.instrument === "vocal" ? p.glideTime : this.resolved ? 0.08 : 0.3,
      "glideRatio",
      2 ** ((p.glideStart * (1 - progress ** p.glideCurve)) / 12),
    ];
  }
  private updateFlight(level: number, arrival = 0) {
    if (!this.sonic || !this.shotSetup) return;
    const p = this.parameters;
    const fs = this.currentFrequencies();
    this.sonic.send(
      "/n_set",
      103,
      "amp",
      level * p.drive,
      ...this.flightTimbre(this.progress),
      "voices",
      p.instrument === "convergence" ? p.voices : 3,
      "normalize",
      1 / Math.sqrt(p.instrument === "convergence" ? p.voices : 3),
      "spread",
      p.instrument === "convergence" ? p.spread : 0,
      "converge",
      Math.max(p.converge, arrival),
      "harmonics",
      p.harmonics,
      "detune",
      p.detune * (1 - arrival),
      "width",
      p.width,
      ...fs.flatMap((f, i) => [`f${i}`, f]),
    );
  }
  private runShot = () => {
    if (!this.running || !this.shotSetup) return;
    const now = performance.now(),
      dt = Math.min(0.1, Math.max(0, (now - this.shotLast) / 1000));
    this.shotLast = now;
    if (this.shotPaused || this.audioPaused) {
      this.shotTimer = setTimeout(this.runShot, 30);
      return;
    }
    const j = this.shotSetup.journey;
    this.shotTime += dt;
    this.progress = clamp(this.shotTime / j.duration);
    const i = Math.min(
      this.shotSignals.length - 1,
      Math.floor(this.progress * (this.shotSignals.length - 1)),
    );
    this.liveSignals = this.shotSignals[i];
    this.liveColor = this.shotSamples[i];
    if (this.mappingMode === "on")
      this.mapped = mapSignals(
        this.shotSetup.mappings,
        this.liveSignals,
        this.mapped,
        dt,
      );
    if (this.mappingMode === "off") this.mapped = {};
    const effective = { ...this.baseParameters, ...this.mapped };
    this.applyParameters(effective);
    if (this.shotPhase === "flight") {
      if (j.advance === "progress" || j.advance === "hue")
        this.musicStep =
          this.shotStartHarmony +
          Math.min(
            j.changes,
            Math.floor(
              (j.advance === "progress"
                ? this.progress
                : this.liveSignals.hueTravel) * j.changes,
            ),
          );
      this.updateField();
      this.announceMusic();
      this.updateFlight(
        Math.sin(Math.PI * Math.min(0.98, this.progress)) * 0.8 + 0.2,
      );
      const m = this.parameters.music,
        tones = this.currentTones(),
        frame = harmonicFrame(m, this.musicStep),
        pattern = motif(
          m,
          tones,
          m.source === "custom" ? tones : frame.scale,
          Math.floor(this.shotIndex / 12),
          frame.degree,
        );
      this.emission += dt * (this.mapped.density ?? j.density);
      if (
        (j.rhythm === "density" && this.emission >= 1) ||
        (j.rhythm === "motif" && this.shotTime >= this.nextEmission)
      ) {
        this.emission %= 1;
        const k = this.shotIndex % pattern.length,
          n = pattern[k];
        this.shotIndex++;
        const beats =
          k + 1 < pattern.length
            ? pattern[k + 1].beat - n.beat
            : m.spacing / (m.melody === "grid" ? m.offspring + 1 : 1) + m.rest;
        this.nextEmission = this.shotTime + (beats * 60) / m.bpm;
        if (!n.skip)
          this.playHz(
            midiHz(n.midi + 12 * (this.mapped.register ?? 0)),
            this.shotIndex % 6,
            n.strength * 0.75,
            n.pan,
          );
      }
      if (this.progress >= 1) this.beginArrival(j.outcome === "capture");
    } else if (this.shotPhase === "arrival") {
      const a = clamp((this.shotTime - this.arrivalStart) / j.arrival);
      const shape = arrivalShape(
        a,
        this.arrivalCaptured,
        this.parameters.instrument === "convergence",
      );
      this.updateFlight(shape.gain, shape.convergence);
      if (a >= 1) {
        this.shotPhase = "settled";
        this.applyParameters(this.baseParameters);
        this.updateFlight(0, this.arrivalCaptured ? 1 : 0);
      }
    } else if (this.shotPhase === "settled") {
      if (j.repeat && this.shotTime > j.duration + j.arrival + j.gap) {
        this.playShot(this.shotSetup, this.shotSamples);
        return;
      }
      if (!j.repeat) {
        this.shotTimer = null;
        return;
      }
    }
    this.shotTimer = setTimeout(this.runShot, 25);
  };
  pauseJourney() {
    this.shotPaused = !this.shotPaused;
    if (this.shotPaused) this.updateFlight(0);
  }
  stopJourney() {
    this.sustainRunning = false;
    this.cancelShot();
    this.stopMotif();
    this.progress = 0;
    this.mapped = {};
    this.liveSignals = null;
    this.applyParameters(this.baseParameters);
    if (this.sonic && this.running) {
      this.sonic.send("/g_freeAll", 100);
      this.sonic.send("/s_new", "chroma_field", 101, 0, 100, "amp", 0);
      this.sonic.send("/s_new", "chroma_flight", 103, 1, 100);
      this.updateField();
    }
    this.activeNotes = this.activeNotes.filter((n) => n.group !== 100);
  }
  stopAmbient() {
    this.ambient = false;
    this.ambientPaused = false;
    if (this.running) this.sonic?.send("/g_freeAll", 110);
    this.activeNotes = this.activeNotes.filter((n) => n.group !== 110);
  }
  async pauseSound() {
    if (!this.context || !this.running) return;
    this.audioPaused = !this.audioPaused;
    if (this.audioPaused) await this.context.suspend();
    else {
      await this.context.resume();
      this.shotLast = performance.now();
    }
  }
  stopSound() {
    if (this.booting) {
      this.stop();
      return;
    }
    this.stopJourney();
    this.stopAmbient();
    this.clearEffects();
    this.sonic?.send("/n_set", 101, "amp", 0);
    this.stoppedSound = true;
    if (this.context)
      this.output?.gain.setTargetAtTime(0, this.context.currentTime, 0.008);
  }
  clearEffects() {
    if (!this.sonic || !this.running) return;
    this.sonic.send("/n_free", 102);
    this.sonic.send("/b_zero", 0);
    this.sonic.send("/s_new", "chroma_space", 102, 1, 0);
    this.applyParameters(this.baseParameters);
  }
  setMappingMode(mode: "on" | "paused" | "off") {
    this.mappingMode = mode;
    if (mode === "off") {
      this.mapped = {};
      this.applyParameters(this.baseParameters);
    }
  }
  setEffectsBypass(bypass: boolean) {
    this.effectsBypassed = bypass;
    this.applyParameters(this.parameters);
  }
  snapshot() {
    return {
      phase: this.shotPhase,
      resolved: this.resolved,
      destinationStep: this.parameters.music.destinationStep,
      paused: this.shotPaused,
      audioPaused: this.audioPaused,
      progress: this.progress,
      signals: this.liveSignals,
      color: this.liveColor,
      mapped: this.mapped,
      step: this.musicStep,
      motif: this.motifPlaying,
      motifPaused: this.motifPaused,
      sustain: this.sustainRunning && this.parameters.music.sustain,
      ambient: this.ambient,
      ambientPaused: this.ambientPaused,
      voices: this.activeNotes.filter((x) => x.until > this.noteClock()).length,
    };
  }

  startRecording(onComplete: (blob: Blob) => void) {
    if (!this.running || !this.context || !this.output || this.recorder)
      return false;
    if (typeof MediaRecorder === "undefined") return false;
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
      (t) => MediaRecorder.isTypeSupported(t),
    );
    this.recordingStream = this.context.createMediaStreamDestination();
    this.output.connect(this.recordingStream);
    const recorder = new MediaRecorder(
      this.recordingStream.stream,
      mime ? { mimeType: mime } : undefined,
    );
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stream = this.recordingStream;
    recorder.onstop = () => {
      try {
        this.output?.disconnect(stream);
      } catch {
        /* Already disposed. */
      }
      stream.stream.getTracks().forEach((t) => t.stop());
      this.recordingStream = null;
      this.recorder = null;
      if (!this.disposed)
        onComplete(new Blob(chunks, { type: recorder.mimeType }));
    };
    this.recorder = recorder;
    recorder.start();
    return true;
  }
  stopRecording() {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  async dispose() {
    this.disposed = true;
    this.stop();
    try {
      await this.sonic?.destroy();
    } catch {
      /* Teardown must also work after a failed boot. */
    }
    if (this.context && this.context.state !== "closed")
      await this.context.close();
    this.output?.disconnect();
    this.analyser?.disconnect();
    this.sonic = null;
    this.context = null;
  }
}
