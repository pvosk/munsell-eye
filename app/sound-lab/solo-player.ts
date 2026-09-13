import { SoundLabEngine } from "./engine";
import { sanitizeSetup, type Setup } from "./presets";
import { sanitizeSolo, soloNotes } from "./solo-settings";

export const SOURCE_KEYS = [
  "instrument",
  "attack",
  "decay",
  "hardness",
  "harmonics",
  "material",
  "detune",
  "glideStart",
  "glideTime",
  "music",
  "root",
  "intervals",
] as const;
export class SoloPlayer {
  engine = new SoundLabEngine();
  setup: Setup;
  active = false;
  auditioned = false;
  time = 0;
  error = "";
  private next = 0;
  private last = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retrigger: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private disposed = false;
  constructor(setup: Setup) {
    this.setup = this.fixed(setup);
    this.engine.onError = (message) => {
      this.error = message;
      this.stop();
    };
  }
  private fixed(s: Setup) {
    return sanitizeSetup({
      ...s,
      mappings: [],
      solo: sanitizeSolo(s.solo),
      parameters: {
        ...s.parameters,
        tension: 0,
        music: {
          ...s.parameters.music,
          progression: "still",
          destinationStep: 0,
          sustain: false,
        },
      },
    });
  }
  configure(setup: Setup) {
    const old = this.setup;
    this.setup = this.fixed(setup);
    this.engine.update(this.setup.parameters);
    const sourceChanged = SOURCE_KEYS.filter(
      (k) =>
        this.setup.solo!.kind !== "convergence" ||
        !["harmonics", "detune", "attack", "decay"].includes(k),
    ).some(
      (k) =>
        JSON.stringify(old.parameters[k]) !==
        JSON.stringify(this.setup.parameters[k]),
    );
    const shapeChanged = [
      "duration",
      "hold",
      "count",
      "octaves",
      "direction",
      "spacingCurve",
    ].some(
      (k) =>
        old.solo?.[k as keyof NonNullable<Setup["solo"]>] !==
        this.setup.solo?.[k as keyof NonNullable<Setup["solo"]>],
    );
    if (
      this.retrigger &&
      (sourceChanged || shapeChanged || !this.setup.solo!.autoRetrigger)
    )
      clearTimeout(this.retrigger);
    if (
      this.auditioned &&
      !this.engine.audioPaused &&
      this.setup.solo!.autoRetrigger &&
      (sourceChanged || shapeChanged)
    )
      this.retrigger = setTimeout(() => {
        this.retrigger = null;
        void this.play();
      }, 350);
  }
  async play() {
    const token = ++this.generation;
    this.cancelTimers();
    this.error = "";
    try {
      if (!this.engine.running) await this.engine.start();
      if (this.engine.audioPaused) await this.engine.pauseSound();
      if (this.disposed || token !== this.generation || !this.engine.running)
        return;
      this.engine.beginSolo(this.setup.parameters, true);
      this.active = this.auditioned = true;
      this.time = 0;
      this.next = 0;
      this.last = performance.now();
      this.tick();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Could not start solo audio.";
      this.stop();
    }
  }
  private tick = () => {
    if (!this.active || this.disposed) return;
    const now = performance.now();
    if (!this.engine.audioPaused) {
      this.time += Math.min(0.1, (now - this.last) / 1000);
      const s = this.setup.solo!;
      const notes = soloNotes(s, this.setup.parameters);
      // Fixed sequence identity; current source/effect controls are used at each onset.
      while (this.next < notes.length && notes[this.next].time <= this.time) {
        const n = notes[this.next++];
        this.engine.soloNote(n.hz, n.strength, n.pan);
      }
      if (s.kind === "convergence") {
        const gather = Math.min(1, this.time / s.duration);
        const level =
          Math.min(1, this.time / 0.15) *
          Math.max(
            0,
            Math.min(1, (s.duration + s.hold + 0.5 - this.time) / 0.5),
          );
        this.engine.soloCloud(this.time, gather, level);
      }
      const finish =
        s.kind === "convergence"
          ? s.duration + s.hold + 0.5
          : s.kind === "pop"
            ? this.setup.parameters.decay
            : s.duration;
      if (this.time >= finish + s.gap) {
        if (s.loop) {
          this.engine.beginSolo(this.setup.parameters, s.cleanLoop);
          this.time = 0;
          this.next = 0;
        } else {
          this.active = false;
          this.timer = null;
          return;
        }
      }
    }
    this.last = now;
    this.timer = setTimeout(this.tick, 20);
  };
  async pause() {
    if (this.retrigger) clearTimeout(this.retrigger);
    this.retrigger = null;
    await this.engine.pauseSound();
    this.last = performance.now();
  }
  private cancelTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.retrigger) clearTimeout(this.retrigger);
    this.timer = this.retrigger = null;
  }
  stop() {
    this.generation++;
    this.cancelTimers();
    this.active = this.auditioned = false;
    this.engine.stopSound();
  }
  async dispose() {
    this.disposed = true;
    this.stop();
    await this.engine.dispose();
  }
}
