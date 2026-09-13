import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3018/sound-lab");
  const result = await page.evaluate(async () => {
    const { SoloPlayer } = await import("/app/sound-lab/solo-player.ts");
    const { SOLO_KINDS, soloDefault } = await import(
      "/app/sound-lab/solo-settings.ts"
    );
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const player = new SoloPlayer(soloDefault("glass"));
    const data = new Float32Array(1024);
    const measure = async (ms) => {
      const end = performance.now() + ms;
      let peak = 0,
        sum = 0,
        n = 0;
      while (performance.now() < end) {
        player.engine.analyser.getFloatTimeDomainData(data);
        for (const x of data) {
          if (!Number.isFinite(x)) throw Error("Non-finite sample");
          peak = Math.max(peak, Math.abs(x));
          sum += x * x;
          n++;
        }
        await wait(20);
      }
      return { peak, rms: Math.sqrt(sum / n) };
    };
    const models = [];
    try {
      for (const { id } of SOLO_KINDS) {
        player.stop();
        player.configure(soloDefault(id));
        const notes = [];
        const unsub = player.engine.subscribeNotes((n) => notes.push(n));
        await player.play();
        const audio = await measure(
          (player.setup.solo.duration + player.setup.solo.hold + 0.6) * 1000,
        );
        unsub();
        if (audio.rms < 1e-6 || audio.peak > 0.71 || player.error)
          throw Error(`${id}: ${JSON.stringify(audio)} ${player.error}`);
        if (id === "convergence" && notes.length)
          throw Error("Convergence has note layer");
        if (id === "pop" && notes.length !== 1)
          throw Error("Release pop is not a single onset");
        if (player.engine.musicStep !== 0) throw Error("Harmony advanced");
        models.push({ id, ...audio, notes: notes.length });
      }
      player.stop();
      const setup = soloDefault("piano");
      setup.solo.loop = true;
      setup.solo.duration = 1;
      setup.solo.gap = 0.3;
      setup.solo.hold = 0;
      player.configure(setup);
      await player.play();
      await wait(300);
      const before = player.time;
      player.configure({
        ...setup,
        parameters: { ...setup.parameters, brightness: 700 },
      });
      await wait(180);
      if (player.time < before || player.engine.parameters.brightness !== 700)
        throw Error("Live FX restarted or ignored controls");
      await player.pause();
      const paused = player.time;
      await wait(200);
      if (player.time !== paused) throw Error("Paused clock moved");
      await player.pause();
      const onsets = [];
      const off = player.engine.subscribeNotes((n) => onsets.push(n));
      player.configure({
        ...setup,
        parameters: { ...setup.parameters, decay: 0.6 },
      });
      await wait(450);
      if (player.time > 0.2 || !onsets.length)
        throw Error("Source edit did not auto-retrigger");
      off();
      await wait(2000);
      if (!player.active || player.time > 1.8)
        throw Error("Loop did not repeat");
      player.stop();
      await wait(200);
      const silence = await measure(100);
      if (silence.peak > 1e-6) throw Error("Stop left sound");
      player.configure({
        ...setup,
        parameters: { ...setup.parameters, decay: 2 },
      });
      await wait(450);
      if (player.active) throw Error("Stopped source restarted on edit");
      return {
        models,
        silence,
        sourceRetrigger: true,
        effectsLive: true,
        pausedClock: true,
        loop: true,
      };
    } finally {
      await player.dispose();
    }
  });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
} finally {
  await browser.close();
}
