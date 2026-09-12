import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = process.env.SOUND_TEST_ORIGIN ?? "http://localhost:3018";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${origin}/sound-lab`);
  const result = await page.evaluate(async () => {
    const { SoundLabEngine, cloudFrequencies } = await import(
      "/app/sound-lab/engine.ts"
    );
    const { STARTERS, sanitizeSetup, DEFAULT_SETUP } = await import(
      "/app/sound-lab/presets.ts"
    );
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const e = new SoundLabEngine();
    let engineError = "";
    e.onError = (m) => (engineError = m);
    await e.start();
    const data = new Float32Array(1024),
      measure = async (ms = 600) => {
        let peak = 0,
          sum = 0,
          n = 0;
        const until = performance.now() + ms;
        while (performance.now() < until) {
          e.analyser.getFloatTimeDomainData(data);
          for (const x of data) {
            if (!Number.isFinite(x)) throw Error("Non-finite audio");
            peak = Math.max(peak, Math.abs(x));
            sum += x * x;
            n++;
          }
          await wait(20);
        }
        return { peak, rms: Math.sqrt(sum / n) };
      };
    const models = [];
    for (const s of STARTERS) {
      e.stopSound();
      await wait(80);
      e.playShot(s.setup);
      models.push({ name: s.name, ...(await measure(1100)) });
    }
    e.stopSound();
    await wait(80);
    const gridSetup = sanitizeSetup({
      ...DEFAULT_SETUP,
      mappings: [],
      parameters: {
        ...DEFAULT_SETUP.parameters,
        tension: 0,
        drive: 0,
        music: {
          ...DEFAULT_SETUP.parameters.music,
          melody: "grid",
          melodySteps: [0, null, 4, null, 2, null, 1, null],
          offspring: 0,
          variation: 0,
          bpm: 120,
          spacing: 0.25,
          progression: "still",
        },
      },
      journey: {
        ...DEFAULT_SETUP.journey,
        rhythm: "motif",
        duration: 2.8,
        advance: "manual",
      },
    });
    const gridNotes = [];
    const unsub = e.subscribeNotes((n) => gridNotes.push(n.hz));
    e.playShot(gridSetup);
    await wait(950);
    e.stopSound();
    unsub();
    const { harmonicFrame, midiHz } = await import("/app/sound-lab/music.ts");
    const gridScale = harmonicFrame(gridSetup.parameters.music).scale;
    const gridExpected = [0, 4, 2, 1].map((d) => midiHz(gridScale[d]));
    if (
      gridNotes.length !== 4 ||
      gridNotes.some((n, i) => Math.abs(n - gridExpected[i]) > 0.01)
    )
      throw Error(
        "Grid shot notes/rests differ from drawn melody: " +
          JSON.stringify(gridNotes),
      );
    e.configure(gridSetup);
    e.scatter();
    const gridAudition = await measure(500);
    if (gridAudition.rms <= 1e-6)
      throw Error("Phrase audition stayed muted after Stop all");
    e.stopSound();
    await wait(80);
    const cloudNotes = [];
    const unCloud = e.subscribeNotes((n) => cloudNotes.push(n));
    e.playShot(STARTERS[1].setup);
    await wait(450);
    unCloud();
    if (cloudNotes.length !== 0)
      throw Error(
        "Convergence emitted a normal motif despite note layer being off",
      );
    const targetHz = harmonicFrame(
      STARTERS[1].setup.parameters.music,
      0,
    ).tones.map(midiHz);
    const gathered = cloudFrequencies(
      STARTERS[1].setup.parameters,
      2,
      targetHz,
      1,
    );
    if (
      gathered.some(
        (f, i) =>
          Math.abs(f - targetHz[i % 6] * (i < 6 ? 0.5 : i < 12 ? 1 : 2)) > 1e-6,
      )
    )
      throw Error("Cloud did not reach its harmonic targets");
    const live = sanitizeSetup({
      ...STARTERS[1].setup,
      mappings: [],
      journey: {
        ...STARTERS[1].setup.journey,
        duration: 1.2,
        arrival: 0.2,
        gap: 1,
        repeat: true,
      },
    });
    e.playShot(live);
    await wait(230);
    const beforeEdit = e.progress;
    const edited = sanitizeSetup({
      ...live,
      parameters: { ...live.parameters, brightness: 5100, wander: 5 },
      journey: {
        ...live.journey,
        duration: 0.7,
        probe: { ...live.journey.probe, hue: 70, hueTravel: 0 },
      },
    });
    e.configure(edited);
    const afterEdit = e.progress;
    await wait(90);
    if (
      Math.abs(e.snapshot().color.h - 70) > 0.01 ||
      e.parameters.brightness !== 5100 ||
      beforeEdit !== afterEdit
    )
      throw Error(
        "Live edit failed to update path/parameters while retaining progress",
      );
    const generation = e.transportGeneration;
    await wait(2100);
    if (e.transportGeneration <= generation || e.shotSamples[0].h !== 70)
      throw Error("Loop reused stale path");
    e.configure({ ...edited, journey: { ...edited.journey, repeat: false } });
    await wait(1500);
    const stoppedGeneration = e.transportGeneration;
    await wait(500);
    if (e.transportGeneration !== stoppedGeneration)
      throw Error("Loop did not stop after toggle off");
    e.stopSound();
    const textures = [];
    for (const key of ["saturate", "fold", "crossover", "inside", "shred"]) {
      e.stopSound();
      await wait(80);
      e.playShot(
        sanitizeSetup({
          ...DEFAULT_SETUP,
          mappings: [],
          parameters: {
            ...DEFAULT_SETUP.parameters,
            [key]: 1,
            textureDrive: 12,
            ribbon: 0,
            echo: 0,
            reverse: 0,
            grains: 0,
            room: 0,
          },
        }),
      );
      textures.push({ key, ...(await measure(700)) });
    }
    e.stopSound();
    await wait(250);
    const textureSilence = await measure(120);
    e.stopSound();
    await wait(100);
    e.playShot(STARTERS[0].setup);
    await wait(450);
    e.pauseJourney();
    const paused = e.progress;
    await wait(300);
    const held = e.progress;
    e.pauseJourney();
    await wait(150);
    const resumed = e.progress;
    await e.pauseSound();
    const audioBefore = e.progress;
    await wait(250);
    const audioAfter = e.progress;
    await e.pauseSound();
    e.stopSound();
    await wait(250);
    const silence = await measure(180);
    const miss = sanitizeSetup({
      ...STARTERS[1].setup,
      journey: {
        ...STARTERS[1].setup.journey,
        duration: 0.7,
        arrival: 0.2,
        outcome: "miss",
      },
    });
    e.playShot(miss);
    await wait(1200);
    const missResolved = e.resolved;
    e.playShot({ ...miss, journey: { ...miss.journey, outcome: "capture" } });
    await wait(1200);
    const captureResolved = e.resolved;
    e.playShot(miss, undefined, true);
    await wait(150);
    e.configure(miss);
    await wait(1000);
    if (!e.resolved || miss.journey.outcome !== "miss")
      throw Error(
        "Resolve demo lost capture override or changed saved outcome",
      );
    e.stopSound();
    await wait(100);
    const landing = sanitizeSetup({
      ...STARTERS[1].setup,
      parameters: {
        ...STARTERS[1].setup.parameters,
        music: {
          ...STARTERS[1].setup.parameters.music,
          progression: "modal",
          destinationStep: 2,
          motifAdvance: "manual",
        },
      },
      journey: {
        ...STARTERS[1].setup.journey,
        outcome: "miss",
        duration: 3,
        arrival: 1.8,
        advance: "hue",
      },
    });
    const commands = [];
    const originalSend = e.sonic.send.bind(e.sonic);
    e.sonic.send = (address, ...args) => {
      if (address === "/n_set" && args[0] === 103)
        commands.push(
          Object.fromEntries(
            Array.from({ length: (args.length - 1) / 2 }, (_, i) => [
              args[i * 2 + 1],
              args[i * 2 + 2],
            ]),
          ),
        );
      return originalSend(address, ...args);
    };
    e.playShot(landing);
    await wait(400);
    e.resolve();
    await wait(620);
    const resolvedBody = await measure(220);
    const arrivalReadout = e.snapshot();
    if (
      !arrivalReadout.resolved ||
      arrivalReadout.step !== 2 ||
      arrivalReadout.phase !== "arrival"
    )
      throw Error(
        "Manual resolve did not enter the selected destination arrival",
      );
    if (
      !commands.some(
        (c) => c.converge === 1 && c.amp > 0.1 && c.detune === 0,
      ) ||
      resolvedBody.rms <= 1e-5
    )
      throw Error("Convergence must sound after pitches fully gather");
    await wait(1100);
    if (e.snapshot().phase !== "settled" || e.snapshot().step !== 2)
      throw Error("Destination was overwritten by hue advancement");
    e.sonic.send = originalSend;
    e.stopSound();
    e.configure(landing);
    e.explore();
    e.playMotif();
    await wait(150);
    e.resolve();
    await wait(100);
    if (!e.resolved || e.musicStep !== 2)
      throw Error("Motif resolve lost destination");
    e.explore();
    if (e.resolved) throw Error("Leave resolution failed");
    e.stopSound();
    const stress = sanitizeSetup({
      ...DEFAULT_SETUP,
      parameters: {
        ...DEFAULT_SETUP.parameters,
        instrument: "convergence",
        voices: 18,
        drive: 1,
        saturate: 1,
        fold: 1,
        crossover: 1,
        inside: 1,
        shred: 1,
        shredRate: 32,
        shredLength: 0.5,
        textureDrive: 16,
        volume: 0.8,
        decay: 9,
        ribbon: 1,
        resonance: 0.015,
        grains: 1,
        reverse: 1,
        grainDensity: 30,
        grain: 0.9,
        echo: 0.8,
        tail: 9,
        room: 0.9,
      },
      journey: { ...DEFAULT_SETUP.journey, density: 24, duration: 3.2 },
    });
    e.playShot(stress);
    const max = await measure(900);
    await e.dispose();
    return {
      models,
      gridNotes,
      cloudNoteCount: cloudNotes.length,
      livePathHue: 70,
      gridAudition,
      textures,
      textureSilence,
      paused,
      held,
      resumed,
      audioBefore,
      audioAfter,
      silence,
      missResolved,
      captureResolved,
      resolvedBody,
      arrivalReadout,
      max,
      engineError,
    };
  });
  console.log(JSON.stringify({ result, errors }, null, 2));
  await browser.close();
  if (
    result.textures.some((x) => x.rms <= 1e-6 || x.peak > 0.71) ||
    result.textureSilence.peak > 1e-4 ||
    result.max.peak > 0.71 ||
    result.models.some((x) => x.rms <= 1e-6) ||
    result.paused !== result.held ||
    result.resumed <= result.held ||
    result.audioBefore !== result.audioAfter ||
    result.silence.peak > 1e-4 ||
    result.missResolved ||
    !result.captureResolved ||
    result.engineError ||
    errors.length
  )
    process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
