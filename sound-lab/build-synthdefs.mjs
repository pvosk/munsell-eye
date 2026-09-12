// Small graph writer for our three fixed instruments, not an sclang interpreter.
// Format: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

class Graph {
  constructor(name, defaults) {
    this.name = name;
    this.constants = [];
    this.nodes = [];
    this.defaults = defaults;
    const names = Object.keys(defaults);
    this.controls = this.node("Control", 1, [], names.length);
    this.p = Object.fromEntries(names.map((key, i) => [key, this.controls[i]]));
  }
  constant(v) {
    if (!Number.isFinite(v)) throw new Error("Non-finite graph constant");
    let i = this.constants.indexOf(v);
    if (i < 0) {
      i = this.constants.length;
      this.constants.push(v);
    }
    return [-1, i];
  }
  node(name, rate, inputs = [], outputs = 1, special = 0) {
    const i = this.nodes.length;
    this.nodes.push({
      name,
      rate,
      inputs: inputs.map((v) => (Array.isArray(v) ? v : this.constant(v))),
      outputs,
      special,
    });
    const refs = Array.from({ length: outputs }, (_, o) => [i, o]);
    return outputs === 1 ? refs[0] : refs;
  }
  rate(v) {
    return Array.isArray(v) && v[0] >= 0 ? this.nodes[v[0]].rate : 0;
  }
  op(a, b, special) {
    return this.node(
      "BinaryOpUGen",
      Math.max(this.rate(a), this.rate(b)),
      [a, b],
      1,
      special,
    );
  }
  add(a, b) {
    return this.op(a, b, 0);
  }
  mul(a, b) {
    return this.op(a, b, 2);
  }
  sub(a, b) {
    return this.op(a, b, 1);
  }
  div(a, b) {
    return this.op(a, b, 4);
  }
  sum(xs) {
    return xs.reduce((a, b) => this.add(a, b));
  }
  lag(x, time = 0.15) {
    return this.node("Lag", 1, [x, time]);
  }
  pan(x, pos, amp = 1) {
    return this.node("Pan2", 2, [x, pos, amp], 2);
  }
  write(dir) {
    const chunks = [];
    const num = (v, n, float = false) => {
      const b = Buffer.alloc(n);
      if (float) b.writeFloatBE(v);
      else b.writeIntBE(v, 0, n);
      chunks.push(b);
    };
    const str = (v) => {
      const b = Buffer.from(v);
      chunks.push(Buffer.from([b.length]), b);
    };
    chunks.push(Buffer.from("SCgf"));
    num(2, 4);
    num(1, 2);
    str(this.name);
    num(this.constants.length, 4);
    this.constants.forEach((v) => num(v, 4, true));
    const entries = Object.entries(this.defaults);
    num(entries.length, 4);
    entries.forEach(([, v]) => num(v, 4, true));
    num(entries.length, 4);
    entries.forEach(([k], i) => {
      str(k);
      num(i, 4);
    });
    num(this.nodes.length, 4);
    for (const n of this.nodes) {
      str(n.name);
      num(n.rate, 1);
      num(n.inputs.length, 4);
      num(n.outputs, 4);
      num(n.special, 2);
      n.inputs.forEach(([a, b]) => {
        num(a, 4);
        num(b, 4);
      });
      for (let i = 0; i < n.outputs; i++) num(n.rate, 1);
    }
    num(0, 2);
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${this.name}.scsyndef`, Buffer.concat(chunks));
    return {
      name: this.name,
      nodes: this.nodes.length,
      ugens: [...new Set(this.nodes.map((n) => n.name))],
    };
  }
}

function chime() {
  const g = new Graph("chroma_chime", {
    freq: 330,
    amp: 0.15,
    attack: 0.009,
    decay: 3.7,
    material: 0.13,
    pan: 0,
    out: 4,
  });
  const p = g.p;
  const trig = g.node("Impulse", 2, [0, 0]);
  const hit = g.node("Decay2", 2, [trig, p.attack, g.add(p.attack, 0.025)]);
  const excitation = g.mul(g.node("PinkNoise", 2), g.mul(hit, 0.07));
  // DynKlank's actual SC expansion: sum of independently tuned Ringz UGens.
  const rings = [1, 2, 3, 4, 6, 7].map((ratio, i) => {
    const stretched = g.add(ratio, g.mul(p.material, i * i * 0.065));
    const ring = g.node("Ringz", 2, [
      excitation,
      g.mul(p.freq, stretched),
      g.mul(p.decay, 1 / (1 + i * 0.35)),
    ]);
    return g.mul(ring, [0.9, 0.38, 0.2, 0.13, 0.065, 0.035][i]);
  });
  const signal = g.mul(g.node("LeakDC", 2, [g.sum(rings), 0.995]), p.amp);
  const channels = g.pan(signal, p.pan);
  g.node("Out", 2, [p.out, ...channels], 0);
  g.node("Line", 1, [0, 0, g.add(p.decay, 2), 2]);
  return g;
}

function struck(name, piano) {
  const g = new Graph(name, {
    freq: 330,
    amp: 0.1,
    attack: 0.006,
    decay: 4,
    hardness: 0.4,
    harmonics: 0.4,
    detune: 0.1,
    pan: 0,
    out: 4,
  });
  const p = g.p;
  const hit = g.node("Impulse", 2, [0, 0]);
  const partials = Array.from({ length: piano ? 9 : 5 }, (_, i) => {
    const ratio = (i + 1) * (piano ? Math.sqrt(1 + 0.00012 * (i + 1) ** 2) : 1);
    const f = g.mul(p.freq, ratio),
      env = g.node("Decay2", 2, [
        hit,
        p.attack,
        g.mul(p.decay, 1 / (1 + i * 0.5)),
      ]);
    const pair = g.add(
      g.node("SinOsc", 2, [f, 0]),
      g.mul(
        g.node("SinOsc", 2, [g.mul(f, g.add(1, g.mul(p.detune, 0.004))), 0.3]),
        0.25,
      ),
    );
    return g.mul(
      pair,
      g.mul(env, i === 0 ? 0.55 : g.mul(p.harmonics, 0.5 / (i + 1))),
    );
  });
  const knock = g.mul(
    g.node("LPF", 2, [
      g.node("PinkNoise", 2),
      g.add(800, g.mul(p.hardness, 4500)),
    ]),
    g.mul(g.node("Decay2", 2, [hit, 0.001, 0.018]), g.mul(p.hardness, 0.13)),
  );
  const signal = g.mul(g.add(g.sum(partials), knock), p.amp);
  g.node("Out", 2, [p.out, ...g.pan(signal, p.pan)], 0);
  g.node("Line", 1, [0, 0, g.add(p.decay, 2), 2]);
  return g;
}
function flight() {
  const g = new Graph("chroma_flight", {
    out: 4,
    amp: 0,
    voices: 6,
    spread: 0.7,
    converge: 0,
    harmonics: 0.3,
    detune: 0.1,
    width: 0.8,
    normalize: 0.4,
    f0: 110,
    f1: 165,
    f2: 220,
    f3: 275,
    f4: 330,
    f5: 440,
  });
  const p = g.p,
    left = [],
    right = [];
  for (let i = 0; i < 18; i++) {
    const target = g.mul(
      g.lag(p[`f${i % 6}`], 0.3),
      i < 6 ? 0.5 : i < 12 ? 1 : 2,
    );
    const deviation = (Math.sin(i * 17.31) * 0.5 + 0.5) * 1.8 - 0.7;
    const f = g.mul(
      target,
      g.add(1, g.mul(g.mul(p.spread, g.sub(1, p.converge)), deviation)),
    );
    const drift = g.mul(
      g.node("SinOsc", 1, [0.09 + i * 0.007, i]),
      g.mul(p.detune, 0.004),
    );
    const tone = g.add(
      g.node("SinOsc", 2, [g.mul(f, g.add(1, drift)), i * 0.27]),
      g.mul(g.node("Saw", 2, [f]), g.mul(p.harmonics, 0.28)),
    );
    const level = g.lag(g.node("Clip", 1, [g.sub(p.voices, i), 0, 1]), 0.18);
    const amp = g.mul(
      g.mul(g.lag(p.amp, 0.05), g.lag(p.normalize, 0.18)),
      g.mul(level, 0.08),
    );
    const pair = g.pan(tone, g.mul(p.width, (i / 17 - 0.5) * 1.8), amp);
    left.push(pair[0]);
    right.push(pair[1]);
  }
  g.node("Out", 2, [p.out, g.sum(left), g.sum(right)], 0);
  return g;
}

function field() {
  const g = new Graph("chroma_field", {
    out: 4,
    amp: 0,
    width: 0.7,
    slew: 2.8,
    f0: 110,
    f1: 165,
    f2: 220,
    f3: 247,
    f4: 330,
    f5: 440,
  });
  const p = g.p;
  const left = [];
  const right = [];
  for (let i = 0; i < 6; i++) {
    const f = g.lag(p[`f${i}`], p.slew);
    const wave = g.node("SinOsc", 1, [0.029 + i * 0.009, i * 1.1]);
    const breath = g.add(0.58, g.mul(wave, 0.26));
    const tone = g.node("SinOsc", 2, [f, i * 0.4]);
    const upper = g.node("SinOsc", 2, [g.mul(f, 2.001), 0]);
    const signal = g.mul(
      g.add(tone, g.mul(upper, 0.07)),
      g.mul(breath, 0.035 / (1 + i * 0.3)),
    );
    const pan = g.mul(p.width, (i / 5 - 0.5) * 1.5);
    const channels = g.pan(signal, pan, g.lag(p.amp, 0.7));
    left.push(channels[0]);
    right.push(channels[1]);
  }
  g.node("Out", 2, [p.out, g.sum(left), g.sum(right)], 0);
  return g;
}

function space() {
  const g = new Graph("chroma_space", {
    in: 4,
    out: 0,
    buf: 0,
    brightness: 3500,
    root: 110,
    ribbon: 0.23,
    motion: 0.19,
    echo: 0.24,
    delay: 0.44,
    tail: 3.6,
    reverse: 0.14,
    grain: 0.38,
    rate: -1,
    grains: 0.15,
    density: 7,
    lookback: 0.6,
    spray: 0.2,
    freeze: 0,
    room: 0.55,
    width: 0.72,
    resonance: 0.075,
    sweepDepth: 0.4,
    sweepOffset: 0,
    sweepDirection: 1,
    bandSpread: 1,
    phaseSpread: 1,
    modulation: 1,
    dry: 1,
    grainRoute: 0,
    wet: 1,
    f0: 165,
    f1: 247.5,
    f2: 330,
    f3: 495,
  });
  const p = g.p;
  const input = g.node("In", 2, [p.in], 2);
  const mono = g.mul(g.add(input[0], input[1]), 0.5);
  const frames = g.node("BufFrames", 1, [p.buf]);
  const record = g.sub(1, p.freeze);
  const writePosition = g.node("Phasor", 2, [0, record, 0, frames, 0]);
  g.node("RecordBuf", 2, [p.buf, 0, 1, 0, record, 1, 0, 0, mono], 0);
  const offset = g.div(
    g.add(p.lookback, g.mul(g.node("LFNoise1", 1, [3.7]), p.spray)),
    6,
  );
  const position = g.sub(g.div(writePosition, frames), offset);
  const pan = g.mul(g.node("LFNoise1", 1, [0.31]), p.width);
  const grains = g.node(
    "GrainBuf",
    2,
    [g.node("Dust", 2, [5]), p.grain, p.buf, p.rate, position, 4, pan, -1, 32],
    2,
  );
  const cloud = g.node(
    "GrainBuf",
    2,
    [
      g.node("Dust", 2, [p.density]),
      p.grain,
      p.buf,
      g.mul(p.rate, -1),
      position,
      4,
      g.mul(pan, -1),
      -1,
      64,
    ],
    2,
  );
  const cloudGain = g.div(
    0.9,
    g.add(1, g.mul(p.density, g.mul(p.grain, 0.25))),
  );
  const brightness = g.lag(p.brightness, 0.22);
  const bandMix = g.lag(p.ribbon, 0.2);
  const channels = input.map((sig, channel) => {
    const fragments = g.add(
      g.mul(grains[channel], g.mul(p.reverse, 0.75)),
      g.mul(cloud[channel], g.mul(p.grains, cloudGain)),
    );
    const routed = g.add(sig, g.mul(fragments, p.grainRoute));
    const bands = [1.5, 2.25, 3, 4.5].map((ratio, i) => {
      const wave = g.node("SinOsc", 1, [
        g.mul(
          g.mul(g.mul(p.motion, p.modulation), p.sweepDirection),
          0.7 + i * 0.19 + channel * 0.07,
        ),
        g.mul(p.phaseSpread, i * 1.4 + channel),
      ]);
      const spread = g.add(1, g.mul(p.bandSpread, i * 0.22));
      const f = g.node("Clip", 1, [
        g.mul(
          g.lag(p[`f${i}`], 0.2),
          g.mul(
            spread,
            g.add(
              1.2,
              g.add(g.mul(p.sweepOffset, 0.5), g.mul(wave, p.sweepDepth)),
            ),
          ),
        ),
        40,
        14000,
      ]);
      return g.node("BPF", 2, [routed, f, g.lag(p.resonance)]);
    });
    const filtered = g.add(
      g.mul(routed, g.mul(p.dry, g.sub(1, g.mul(bandMix, 0.65)))),
      g.mul(g.sum(bands), g.mul(bandMix, 2.1)),
    );
    const echo = g.node("CombC", 2, [
      filtered,
      2,
      g.lag(g.mul(p.delay, channel ? 1.31 : 1), 0.35),
      p.tail,
    ]);
    return g.node("LPF", 2, [
      g.sum([
        filtered,
        g.mul(echo, g.lag(p.echo)),
        g.mul(fragments, g.sub(1, p.grainRoute)),
      ]),
      brightness,
    ]);
  });
  const wet = g.node(
    "FreeVerb2",
    2,
    [...channels, g.lag(p.room, 0.3), 0.87, 0.64],
    2,
  );
  const bypass = wet.map((sig, i) =>
    g.add(
      g.mul(sig, g.lag(p.wet, 0.03)),
      g.mul(input[i], g.sub(1, g.lag(p.wet, 0.03))),
    ),
  );
  const output = bypass.map((sig) =>
    g.node("Limiter", 2, [
      g.node("HPF", 2, [g.mul(g.node("LeakDC", 2, [sig, 0.995]), 4), 35]),
      0.7,
      0.01,
    ]),
  );
  g.node("Out", 2, [p.out, ...output], 0);
  return g;
}
const dir = fileURLToPath(
  new URL("../public/sound-lab/synthdefs", import.meta.url),
);
const manifest = [
  chime(),
  struck("chroma_piano", true),
  struck("chroma_synth", false),
  flight(),
  field(),
  space(),
].map((g) => g.write(dir));
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log("Generated", manifest.map((m) => m.name).join(", "));
