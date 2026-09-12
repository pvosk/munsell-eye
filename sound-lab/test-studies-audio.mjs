// DSP/transport verification only: no browser UI inspection or visual assertions.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.SOUND_TEST_ORIGIN ?? "http://localhost:3018"}/sound-lab`,
  );
  const result = await page.evaluate(async () => {
    const { SoundLabEngine } = await import("/app/sound-lab/engine.ts");
    const { JOURNEY_STUDIES } = await import(
      "/app/sound-lab/journey-studies.ts"
    );
    const e = new SoundLabEngine();
    let error = "";
    e.onError = (m) => (error = m);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const results = [];
    try {
      await e.start();
      const data = new Float32Array(1024);
      for (const study of JOURNEY_STUDIES) {
        e.stopSound();
        await wait(90);
        const notes = [];
        const unsub = e.subscribeNotes((n) => notes.push(n.hz));
        e.playShot(study.setup);
        let peak = 0,
          sum = 0,
          count = 0;
        const until =
          performance.now() +
          (study.setup.journey.duration + study.setup.journey.arrival + 0.2) *
            1000;
        while (performance.now() < until) {
          e.analyser.getFloatTimeDomainData(data);
          for (const x of data) {
            if (!Number.isFinite(x))
              throw Error(`${study.name}: non-finite sound`);
            peak = Math.max(peak, Math.abs(x));
            sum += x * x;
            count++;
          }
          await wait(25);
        }
        unsub();
        const rms = Math.sqrt(sum / count);
        if (rms < 1e-6 || peak > 0.71)
          throw Error(`${study.name}: audio bounds ${peak}/${rms}`);
        if (
          e.snapshot().resolved !==
          (study.setup.journey.outcome === "capture")
        )
          throw Error(`${study.name}: wrong outcome`);
        if (study.setup.parameters.instrument === "convergence" && notes.length)
          throw Error(`${study.name}: unexpected motif`);
        if (notes.some((x) => !Number.isFinite(x)))
          throw Error(`${study.name}: invalid note`);
        if (error) throw Error(error);
        results.push({
          name: study.name,
          rms,
          peak,
          notes: notes.length,
          resolved: e.snapshot().resolved,
        });
      }
      e.stopSound();
      await wait(180);
      e.analyser.getFloatTimeDomainData(data);
      if (data.some((x) => Math.abs(x) > 1e-6))
        throw Error("Stop left audio running");
    } finally {
      await e.dispose();
    }
    return results;
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(JSON.stringify({ studies: result, errors }, null, 2));
} finally {
  await browser.close();
}
