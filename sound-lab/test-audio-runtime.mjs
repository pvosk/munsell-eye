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
    const { SoundLabEngine } = await import("/app/sound-lab/engine.ts");
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
    const stress = sanitizeSetup({
      ...DEFAULT_SETUP,
      parameters: {
        ...DEFAULT_SETUP.parameters,
        instrument: "convergence",
        voices: 18,
        drive: 1,
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
      paused,
      held,
      resumed,
      audioBefore,
      audioAfter,
      silence,
      missResolved,
      captureResolved,
      max,
      engineError,
    };
  });
  console.log(JSON.stringify({ result, errors }, null, 2));
  await browser.close();
  if (
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
