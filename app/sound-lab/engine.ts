import { harmonicFrame, leadVoices, midiHz, motif } from './music';
import { DEFAULTS, frequencies, sanitizeParameters, type Parameters } from './parameters';

export type Sonic = {
  init(): Promise<void>; destroy(): Promise<void>; sync(): Promise<unknown>;
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
  resolved = false;
  ambient = true;
  motifPlaying = false;
  musicStep = 0;
  private phrase = 0;
  private motifTimer: ReturnType<typeof setTimeout> | null = null;
  private previousTones: number[] = [];
  private musicListeners = new Set<(step: number, playing: boolean) => void>();
  subscribeMusic(listener: (step: number, playing: boolean) => void) {
    this.musicListeners.add(listener); return () => { this.musicListeners.delete(listener); };
  }
  private announceMusic() { for (const fn of this.musicListeners) fn(this.musicStep, this.motifPlaying); }
  private currentTones() {
    const p = this.parameters;
    if (p.music.source === 'custom') return frequencies({...p, tension: 0}, true).map(hz=>69+12*Math.log2(hz/440));
    const next = harmonicFrame(p.music, this.resolved ? 0 : this.musicStep).tones;
    const result = p.music.voicing === 'smooth' ? leadVoices(next, this.previousTones) : next;
    this.previousTones = result; return result;
  }
  private currentFrequencies() {
    return this.currentTones().map((n,i)=>midiHz(n)*2**((this.resolved?0:[0,115,-76,180,-145,85][i]*this.parameters.tension)/1200));
  }
  analyser: AnalyserNode | null = null;
  private sonic: Sonic | null = null;
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private gestureTimers = new Set<ReturnType<typeof setTimeout>>();
  private seed = 7139;
  private field = Array.from({ length: 12 }, (_, i) => Math.sin(i * 2.17) * .6);
  private next = 200;
  private activeNotes: number[] = [];
  private lastTouch = 0;
  private disposed = false;
  private generation = 0;
  private booting = false;
  private recorder: MediaRecorder | null = null;
  private recordingStream: MediaStreamAudioDestinationNode | null = null;
  private noteListeners = new Set<(note: NoteEvent) => void>();
  subscribeNotes(listener: (note: NoteEvent) => void) {
    this.noteListeners.add(listener);
    return () => { this.noteListeners.delete(listener); };
  }
  onError?: (message: string) => void;

  async start() {
    if (this.running || this.booting || this.disposed) return;
    this.booting = true;
    const generation = ++this.generation;
    try {
      // Construct and resume in the user gesture, before loading any modules.
      if (!this.context) this.context = new AudioContext({ latencyHint: 'interactive' });
      await this.context.resume();
      if (!this.sonic) {
        // Bundle the JS entry through Vite; only worker/WASM assets live in public.
        const { SuperSonic } = await import('supersonic-scsynth');
        if (generation !== this.generation || this.disposed) return;
        const sonic = new SuperSonic({
          baseURL: new URL('/sound-lab/runtime/', location.origin).href,
          synthdefBaseURL: new URL('/sound-lab/synthdefs/', location.origin).href,
          audioContext: this.context, autoConnect: false, mode: 'postMessage',
          scsynthOptions: { numInputBusChannels: 0, numAudioBusChannels: 32, numBuffers: 32, maxNodes: 128, realTimeMemorySize: 16384, maxWireBufs: 128 },
        });
        this.sonic = sonic;
        sonic.on('error', (...args) => {
          if (!this.running) return;
          this.stop(); this.onError?.(`Audio stopped: ${args.map(String).join(' ')}`);
        });
        await sonic.init();
        this.output = this.context.createGain(); this.output.gain.value = 0;
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 1024;
        sonic.node.connect(this.output); this.output.connect(this.analyser); this.analyser.connect(this.context.destination);
        await Promise.all(['chroma_chime', 'chroma_field', 'chroma_space'].map(name => sonic.loadSynthDef(name)));
        sonic.send('/b_alloc', 0, Math.ceil(this.context.sampleRate * 6), 1);
        await sonic.sync();
      }
      if (generation !== this.generation || this.disposed) return;
      this.createNodes(); this.running = true; this.resolved = false; this.musicStep = 0; this.previousTones = []; this.announceMusic();
      this.update(this.parameters); this.tick();
    } catch (error) {
      this.stop();
      const failed = this.sonic; this.sonic = null;
      try { await failed?.destroy(); } catch { /* Permit a clean retry after a partial boot. */ }
      this.analyser = null; this.output?.disconnect(); this.output = null;
      if (this.context?.state !== 'closed') await this.context?.close();
      this.context = null;
      throw error;
    } finally { this.booting = false; }
  }

  private createNodes() {
    const s = this.sonic!;
    s.send('/g_freeAll', 0); s.send('/b_zero', 0);
    s.send('/g_new', 100, 0, 0);
    s.send('/s_new', 'chroma_field', 101, 0, 100);
    s.send('/s_new', 'chroma_space', 102, 1, 0);
    this.activeNotes = [];
  }

  update(p: Parameters) {
    const before = this.parameters.music;
    this.parameters = sanitizeParameters(p);
    const after = this.parameters.music;
    if (before.tonic !== after.tonic || before.mode !== after.mode || before.progression !== after.progression || before.source !== after.source) {
      this.musicStep = 0; this.phrase = 0; this.announceMusic();
    }
    if (!this.running || !this.sonic || !this.context || !this.output) return;
    const v = this.parameters;
    this.output.gain.setTargetAtTime(v.volume, this.context.currentTime, .04);
    this.sonic.send('/n_set', 102, 'brightness', v.brightness, 'root', v.root,
      'ribbon', v.ribbon, 'motion', v.motion, 'echo', v.echo, 'delay', v.delay, 'tail', v.tail,
      'grains', v.grains, 'density', v.grainDensity, 'lookback', v.grainLookback, 'spray', v.grainSpread, 'freeze', v.freeze,
      'reverse', v.reverse, 'grain', v.grain, 'rate', -(2 ** (v.shift / 12)), 'room', v.room, 'width', v.width);
    this.updateField();
  }

  private updateField() {
    if (!this.sonic || !this.running) return;
    const p = this.parameters;
    const fs = this.currentFrequencies();
    this.sonic.send('/n_set', 101, 'amp', p.music.sustain ? p.home * (this.resolved ? 1.2 : 1) : 0,
      'width', p.width, 'slew', this.resolved ? p.settle : .8, ...fs.flatMap((f, i) => [`f${i}`, f]));
  }

  setAmbient(on: boolean) { this.ambient = on; this.updateField(); }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private tick = () => {
    if (!this.running) return;
    const p = this.parameters;
    if (this.ambient && p.activity > 0) {
      const previous = [...this.field];
      this.field = previous.map((v, i) => Math.max(-1, Math.min(1,
        .82 * v + .09 * (previous[(i + 11) % 12] + previous[(i + 1) % 12]) + (this.random() - .5) * .55)));
      if (this.random() < .22 + p.activity * .7) {
        const degree = Math.floor((this.field[3] + 1) * 3) % 6;
        this.note(degree, 0, .3 + this.random() * .25, this.field[8]);
        if (p.activity > .6 && this.random() > .6) this.later(() => this.note((degree + 2) % 6, 1, .22, -this.field[8]), 230);
      }
    }
    this.timer = setTimeout(this.tick, 280 + (1 - p.activity) * 1100 + this.random() * 850);
  };

  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => { this.gestureTimers.delete(timer); if (this.running) fn(); }, ms);
    this.gestureTimers.add(timer);
  }

  note(degree = 0, octave = 0, strength = .8, pan = 0) {
    if (!this.running || !this.sonic) return;
    const p = this.parameters;
    const hz = Math.min(2200, Math.max(35, this.currentFrequencies()[((degree % 6) + 6) % 6] * 2 ** octave));
    this.playHz(hz, degree, strength, pan);
  }
  private playHz(hz: number, degree: number, strength: number, pan: number) {
    if (!this.running || !this.sonic) return;
    hz = Math.min(2200, Math.max(35, hz));
    const p = this.parameters;
    const now = performance.now();
    this.activeNotes = this.activeNotes.filter(until => until > now);
    // Bound voices under rapid drags or repeated scatter/resolve presses.
    if (this.activeNotes.length >= 24) return;
    this.activeNotes.push(now + (p.decay + 2) * 1000);
    this.sonic.send('/s_new', 'chroma_chime', this.next++, 0, 100,
      'freq', hz, 'amp', .18 * Math.min(1, Math.max(0, strength)), 'attack', p.attack,
      'decay', p.decay, 'material', p.material, 'pan', Math.max(-1, Math.min(1, pan * p.width)));
    const event = { hz, strength, x: (pan + 1) / 2, y: .8 - degree / 8 };
    for (const listener of this.noteListeners) listener(event);
  }

  touch(x: number, y: number) {
    if (performance.now() - this.lastTouch < 130) return;
    this.lastTouch = performance.now();
    this.note(Math.floor(x * 6) % 6, y < .35 ? 1 : 0, .3 + (1 - y) * .65, x * 2 - 1);
  }

  private schedulePhrase(phrase: number) {
    const m = this.parameters.music, tones = this.currentTones();
    const frame = harmonicFrame(m, this.resolved ? 0 : this.musicStep);
    const notes = motif(m, tones, m.source === 'custom' ? tones : frame.scale, phrase);
    for (const [i,n] of notes.entries()) if (!n.skip) this.later(()=>{
      const bend=this.resolved?0:[0,115,-76,180,-145,85][i%6]*this.parameters.tension;
      this.playHz(midiHz(n.midi)*2**(bend/1200),i%6,n.strength,n.pan);
    }, n.beat * 60000 / m.bpm);
    return ((notes.at(-1)?.beat ?? 0) + m.spacing + m.rest) * 60000 / m.bpm;
  }
  scatter() {
    if (!this.running) return;
    this.stopMotif(); this.schedulePhrase(0);
  }
  playMotif() {
    if (!this.running || this.motifPlaying) return;
    this.cancelGesture(); this.motifPlaying = true; this.phrase = 0;
    this.runPhrase();
  }
  private runPhrase = () => {
    if (!this.running || !this.motifPlaying) return;
    if (this.phrase > 0 && this.phrase % this.parameters.music.repeats === 0 && !this.resolved) this.musicStep++;
    this.updateField(); this.announceMusic();
    const ms=this.schedulePhrase(this.phrase++);
    this.motifTimer=setTimeout(this.runPhrase,ms);
  };
  stopMotif() {
    this.motifPlaying = false;
    if (this.motifTimer) clearTimeout(this.motifTimer); this.motifTimer = null;
    this.cancelGesture(); this.announceMusic();
  }
  nextHarmony() {
    if (!this.running) return;
    this.resolved = false; this.musicStep++; this.updateField(); this.announceMusic();
  }

  resolve() {
    if (!this.running || this.resolved) return;
    this.cancelGesture(); this.resolved = true; this.musicStep = 0; this.updateField(); this.announceMusic();
    [0, 2, 4, 1, 3, 5].forEach((degree, i) => this.later(() => this.note(degree, 0, .63 - i * .065, (i / 5 - .5) * .9), i * 120));
  }
  explore() { this.resolved = false; this.updateField(); this.announceMusic(); }
  cancelGesture() { for (const t of this.gestureTimers) clearTimeout(t); this.gestureTimers.clear(); }

  stop() {
    this.generation++; this.running = false;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.stopMotif(); this.stopRecording();
    if (this.output && this.context?.state === 'running') this.output.gain.setTargetAtTime(0, this.context.currentTime, .008);
    // Free sources and effects: no scheduled arpeggio or reverse tail survives Stop.
    if (this.sonic && !this.booting) this.sonic.send('/g_freeAll', 0);
  }

  startRecording(onComplete: (blob: Blob) => void) {
    if (!this.running || !this.context || !this.output || this.recorder) return false;
    if (typeof MediaRecorder === 'undefined') return false;
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
    this.recordingStream = this.context.createMediaStreamDestination();
    this.output.connect(this.recordingStream);
    const recorder = new MediaRecorder(this.recordingStream.stream, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stream = this.recordingStream;
    recorder.onstop = () => {
      try { this.output?.disconnect(stream); } catch { /* Already disposed. */ }
      stream.stream.getTracks().forEach(t => t.stop());
      this.recordingStream = null; this.recorder = null;
      if (!this.disposed) onComplete(new Blob(chunks, { type: recorder.mimeType }));
    };
    this.recorder = recorder; recorder.start(); return true;
  }
  stopRecording() { if (this.recorder?.state === 'recording') this.recorder.stop(); }

  async dispose() {
    this.disposed = true; this.stop();
    try { await this.sonic?.destroy(); } catch { /* Teardown must also work after a failed boot. */ }
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.output?.disconnect(); this.analyser?.disconnect();
    this.sonic = null; this.context = null;
  }
}
