// Small graph writer for our three fixed instruments, not an sclang interpreter.
// Format: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

class Graph {
  constructor(name, defaults) {
    this.name = name; this.constants = []; this.nodes = []; this.defaults = defaults;
    const names = Object.keys(defaults);
    this.controls = this.node('Control', 1, [], names.length);
    this.p = Object.fromEntries(names.map((key, i) => [key, this.controls[i]]));
  }
  constant(v) {
    if (!Number.isFinite(v)) throw new Error('Non-finite graph constant');
    let i = this.constants.indexOf(v); if (i < 0) { i = this.constants.length; this.constants.push(v); }
    return [-1, i];
  }
  node(name, rate, inputs = [], outputs = 1, special = 0) {
    const i = this.nodes.length;
    this.nodes.push({ name, rate, inputs: inputs.map(v => Array.isArray(v) ? v : this.constant(v)), outputs, special });
    const refs = Array.from({ length: outputs }, (_, o) => [i, o]);
    return outputs === 1 ? refs[0] : refs;
  }
  rate(v) { return Array.isArray(v) && v[0] >= 0 ? this.nodes[v[0]].rate : 0; }
  op(a, b, special) { return this.node('BinaryOpUGen', Math.max(this.rate(a), this.rate(b)), [a, b], 1, special); }
  add(a, b) { return this.op(a, b, 0); }
  mul(a, b) { return this.op(a, b, 2); }
  sub(a, b) { return this.op(a, b, 1); }
  div(a, b) { return this.op(a, b, 4); }
  sum(xs) { return xs.reduce((a, b) => this.add(a, b)); }
  lag(x, time = .15) { return this.node('Lag', 1, [x, time]); }
  pan(x, pos, amp = 1) { return this.node('Pan2', 2, [x, pos, amp], 2); }
  write(dir) {
    const chunks = [];
    const num = (v, n, float = false) => { const b = Buffer.alloc(n); if (float) b.writeFloatBE(v); else b.writeIntBE(v, 0, n); chunks.push(b); };
    const str = v => { const b = Buffer.from(v); chunks.push(Buffer.from([b.length]), b); };
    chunks.push(Buffer.from('SCgf')); num(2, 4); num(1, 2); str(this.name);
    num(this.constants.length, 4); this.constants.forEach(v => num(v, 4, true));
    const entries = Object.entries(this.defaults);
    num(entries.length, 4); entries.forEach(([, v]) => num(v, 4, true));
    num(entries.length, 4); entries.forEach(([k], i) => { str(k); num(i, 4); });
    num(this.nodes.length, 4);
    for (const n of this.nodes) {
      str(n.name); num(n.rate, 1); num(n.inputs.length, 4); num(n.outputs, 4); num(n.special, 2);
      n.inputs.forEach(([a, b]) => { num(a, 4); num(b, 4); });
      for (let i = 0; i < n.outputs; i++) num(n.rate, 1);
    }
    num(0, 2); mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${this.name}.scsyndef`, Buffer.concat(chunks));
    return { name: this.name, nodes: this.nodes.length, ugens: [...new Set(this.nodes.map(n => n.name))] };
  }
}

function chime() {
  const g = new Graph('chroma_chime', { freq: 330, amp: .15, attack: .009, decay: 3.7, material: .13, pan: 0, out: 4 });
  const p = g.p;
  const trig = g.node('Impulse', 2, [0, 0]);
  const hit = g.node('Decay2', 2, [trig, p.attack, g.add(p.attack, .025)]);
  const excitation = g.mul(g.node('PinkNoise', 2), g.mul(hit, .07));
  // DynKlank's actual SC expansion: sum of independently tuned Ringz UGens.
  const rings = [1, 2, 3, 4, 6, 7].map((ratio, i) => {
    const stretched = g.add(ratio, g.mul(p.material, i * i * .065));
    const ring = g.node('Ringz', 2, [excitation, g.mul(p.freq, stretched), g.mul(p.decay, 1 / (1 + i * .35))]);
    return g.mul(ring, [.9, .38, .2, .13, .065, .035][i]);
  });
  const signal = g.mul(g.node('LeakDC', 2, [g.sum(rings), .995]), p.amp);
  const channels = g.pan(signal, p.pan);
  g.node('Out', 2, [p.out, ...channels], 0);
  g.node('Line', 1, [0, 0, g.add(p.decay, 2), 2]);
  return g;
}

function field() {
  const g = new Graph('chroma_field', { out: 4, amp: .2, width: .7, slew: 2.8, f0: 110, f1: 165, f2: 220, f3: 247, f4: 330, f5: 440 });
  const p = g.p; const left = []; const right = [];
  for (let i = 0; i < 6; i++) {
    const f = g.lag(p[`f${i}`], p.slew);
    const wave = g.node('SinOsc', 1, [.029 + i * .009, i * 1.1]);
    const breath = g.add(.58, g.mul(wave, .26));
    const tone = g.node('SinOsc', 2, [f, i * .4]);
    const upper = g.node('SinOsc', 2, [g.mul(f, 2.001), 0]);
    const signal = g.mul(g.add(tone, g.mul(upper, .07)), g.mul(breath, .035 / (1 + i * .3)));
    const pan = g.mul(p.width, (i / 5 - .5) * 1.5);
    const channels = g.pan(signal, pan, g.lag(p.amp, .7)); left.push(channels[0]); right.push(channels[1]);
  }
  g.node('Out', 2, [p.out, g.sum(left), g.sum(right)], 0);
  return g;
}

function space() {
  const g = new Graph('chroma_space', { in: 4, out: 0, buf: 0, brightness: 3500, root: 110, ribbon: .23, motion: .19, echo: .24, delay: .44, tail: 3.6, reverse: .14, grain: .38, rate: -1, grains: .15, density: 7, lookback: .6, spray: .2, freeze: 0, room: .55, width: .72 });
  const p = g.p;
  const input = g.node('In', 2, [p.in], 2);
  const mono = g.mul(g.add(input[0], input[1]), .5);
  const frames = g.node('BufFrames', 1, [p.buf]);
  const record = g.sub(1, p.freeze);
  const writePosition = g.node('Phasor', 2, [0, record, 0, frames, 0]);
  g.node('RecordBuf', 2, [p.buf, 0, 1, 0, record, 1, 0, 0, mono], 0);
  const offset = g.div(g.add(p.lookback, g.mul(g.node('LFNoise1', 1, [3.7]), p.spray)), 6);
  const position = g.sub(g.div(writePosition, frames), offset);
  const pan = g.mul(g.node('LFNoise1', 1, [.31]), p.width);
  const grains = g.node('GrainBuf', 2, [g.node('Dust', 2, [5]), p.grain, p.buf, p.rate, position, 4, pan, -1, 32], 2);
  const cloud = g.node('GrainBuf', 2, [g.node('Dust', 2, [p.density]), p.grain, p.buf, g.mul(p.rate, -1), position, 4, g.mul(pan, -1), -1, 64], 2);
  const cloudGain = g.div(.9, g.add(1, g.mul(p.density, g.mul(p.grain, .25))));
  const brightness = g.lag(p.brightness, .22);
  const bandMix = g.lag(p.ribbon, .2);
  const channels = input.map((sig, channel) => {
    const bands = [1.5, 2.25, 3, 4.5].map((ratio, i) => {
      const wave = g.node('SinOsc', 1, [g.mul(p.motion, .7 + i * .19 + channel * .07), i * 1.4 + channel]);
      const f = g.mul(g.lag(p.root, .4), g.mul(ratio, g.add(1.2, g.mul(wave, .55))));
      return g.node('BPF', 2, [sig, f, .075]);
    });
    const filtered = g.add(g.mul(sig, g.sub(1, g.mul(bandMix, .65))), g.mul(g.sum(bands), g.mul(bandMix, 2.1)));
    const echo = g.node('CombC', 2, [filtered, 2, g.lag(g.mul(p.delay, channel ? 1.31 : 1), .35), p.tail]);
    return g.node('LPF', 2, [g.sum([filtered, g.mul(echo, g.lag(p.echo)), g.mul(grains[channel], g.mul(g.lag(p.reverse), .75)), g.mul(cloud[channel], g.mul(g.lag(p.grains), cloudGain))]), brightness]);
  });
  const wet = g.node('FreeVerb2', 2, [...channels, g.lag(p.room, .3), .87, .64], 2);
  const output = wet.map(sig => g.node('Limiter', 2, [g.node('HPF', 2, [g.mul(g.node('LeakDC', 2, [sig, .995]), 4), 35]), .7, .01]));
  g.node('Out', 2, [p.out, ...output], 0);
  return g;
}
const dir = fileURLToPath(new URL('../public/sound-lab/synthdefs', import.meta.url));
const manifest = [chime(), field(), space()].map(g => g.write(dir));
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log('Generated', manifest.map(m => m.name).join(', '));
