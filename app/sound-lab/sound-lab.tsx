"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SoundLabEngine } from "./engine";
import {
  GROUPS,
  PRESETS,
  SOUND_MODELS,
  TUNINGS,
  sanitizeParameters,
  type Parameters,
  type SliderSpec,
} from "./parameters";
import { MelodyGrid } from "./melody-grid";
import { MusicPanel } from "./music-panel";
import { DEFAULT_SETUP, STARTERS, sanitizeSetup, type Setup } from "./presets";
import { PresetLibrary } from "./preset-library";
import {
  PROBES,
  INPUTS,
  OUTPUTS,
  sampleProbe,
  signalPath,
  type Mapping,
  type Journey,
  type ColorSample,
  type Destination,
} from "./journey";
import { loadGame, paintTrace } from "./paint-trace";
import "./sound-lab.css";

type Tab = "journey" | "sound" | "mapping";
const format = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
function Range({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="sl-range">
      <span>
        {label}
        <output>{format(value)}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Slider({
  spec,
  value,
  onChange,
  mapped,
}: {
  spec: SliderSpec;
  value: number;
  onChange: (n: number) => void;
  mapped?: number;
}) {
  return (
    <Range
      label={spec.label + (spec.unit ? ` (${spec.unit})` : "")}
      value={value}
      min={spec.min}
      max={spec.max}
      step={spec.step}
      onChange={onChange}
      hint={
        mapped === undefined
          ? spec.hint
          : `Mapped live: ${format(mapped)}. Slider stores the unmapped base value.`
      }
    />
  );
}
const rgb = (c: ColorSample) => `rgb(${c.rgb.map(Math.round).join(" ")})`;
const point = (c: ColorSample) =>
  [
    300 + Math.cos((c.h * Math.PI) / 180) * c.edge * 220,
    125 - (c.l - 0.5) * 140 + Math.sin((c.h * Math.PI) / 180) * c.edge * 55,
  ].map((x) => Math.round(x * 1000) / 1000);
function Trace({
  samples,
  progress,
}: {
  samples: ColorSample[];
  progress: number;
}) {
  const i = Math.min(
      samples.length - 1,
      Math.floor(progress * (samples.length - 1)),
    ),
    current = samples[i],
    pos = point(current);
  return (
    <svg
      className="sl-trace"
      viewBox="0 0 600 240"
      role="img"
      aria-label="Shot trace projection. The bright marker follows the current color; the ring marks the endpoint."
    >
      <ellipse
        cx="300"
        cy="125"
        rx="220"
        ry="55"
        fill="none"
        stroke="#a4c5cc30"
      />
      <line x1="300" x2="300" y1="30" y2="210" stroke="#a4c5cc30" />
      {samples.slice(1).map((c, j) => {
        const a = point(samples[j]),
          b = point(c);
        return (
          <line
            key={j}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={rgb(c)}
            strokeWidth={j < i ? 4 : 2}
            opacity={j < i ? 1 : 0.4}
          />
        );
      })}
      <circle
        cx={point(samples.at(-1)!)[0]}
        cy={point(samples.at(-1)!)[1]}
        r="12"
        fill="none"
        stroke="#d8eee4"
      />
      <circle
        cx={pos[0]}
        cy={pos[1]}
        r="7"
        fill={rgb(current)}
        stroke="white"
        strokeWidth="2"
      />
      <text x="18" y="220" fill="#a9bdbb" fontSize="13">
        Hue around · lightness up · boundary fraction outward
      </text>
    </svg>
  );
}

export default function SoundLab({ signIn }: { signIn: ReactNode }) {
  const [setup, setSetup] = useState<Setup>(() => sanitizeSetup(DEFAULT_SETUP)),
    [tab, setTab] = useState<Tab>("journey"),
    [status, setStatus] = useState<"off" | "loading" | "on" | "error">("off"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [snapshot, setSnapshot] = useState<ReturnType<
      SoundLabEngine["snapshot"]
    > | null>(null),
    [heldSeconds, setHeldSeconds] = useState(0),
    [holding, setHolding] = useState(false),
    [mappingMode, setMappingMode] = useState<"on" | "paused" | "off">("on"),
    [fxBypass, setFxBypass] = useState(false),
    [recording, setRecording] = useState(false),
    [undo, setUndo] = useState<Setup | null>(null),
    [hydrated, setHydrated] = useState(false);
  const [paintInfo, setPaintInfo] = useState<Awaited<
      ReturnType<typeof paintTrace>
    > | null>(null),
    [palettes, setPalettes] = useState<
      { name: string; paints: { name: string }[] }[]
    >([]),
    [paintError, setPaintError] = useState("");
  const engine = useRef<SoundLabEngine | null>(null),
    alive = useRef(false),
    hold = useRef<number | null>(null),
    recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    setupRef = useRef(setup);
  const p = setup.parameters,
    j = setup.journey,
    enabled = status === "on",
    busy = status === "loading";
  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);
  const update = useCallback(
    (next: Setup) => setSetup(sanitizeSetup(next)),
    [],
  );
  const change = (key: keyof Parameters, value: unknown) =>
    setSetup((s) =>
      sanitizeSetup({ ...s, parameters: { ...s.parameters, [key]: value } }),
    );
  const setJourney = (patch: Partial<Journey>) =>
    setSetup((s) =>
      sanitizeSetup({ ...s, journey: { ...s.journey, ...patch } }),
    );
  const updateRow = (id: string, patch: Partial<Mapping>) =>
    setSetup((s) => ({
      ...s,
      mappings: s.mappings.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  useEffect(() => {
    alive.current = true;
    const e = new SoundLabEngine();
    engine.current = e;
    e.onError = (message) => {
      if (alive.current) {
        setError(message);
        setStatus("error");
      }
    };
    queueMicrotask(() => {
      try {
        const draft = localStorage.getItem("chroma-sound-draft-v2");
        if (draft) setSetup(sanitizeSetup(JSON.parse(draft)));
      } catch {
        /* Cloud/library files remain usable. */
      }
      setHydrated(true);
    });
    const timer = setInterval(() => {
      if (engine.current && alive.current)
        setSnapshot(engine.current.snapshot());
      if (hold.current !== null) {
        const seconds = (performance.now() - hold.current) / 1000;
        setHeldSeconds(seconds);
        engine.current?.charge(Math.min(1, seconds / 2.2));
      }
    }, 60);
    const hide = () => {
      if (document.hidden) {
        hold.current = null;
        setHolding(false);
        engine.current?.stop();
        setStatus("off");
        setRecording(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hold.current = null;
        setHolding(false);
        engine.current?.stopSound();
        setNotice("Sources and effect memory stopped. Settings kept.");
      }
    };
    const blur = () => {
      hold.current = null;
      setHolding(false);
      engine.current?.charge(0);
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keydown", escape);
    return () => {
      alive.current = false;
      clearInterval(timer);
      if (recordTimer.current) clearTimeout(recordTimer.current);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", blur);
      void engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.configure(setup);
    if (!hydrated) return;
    try {
      localStorage.setItem("chroma-sound-draft-v2", JSON.stringify(setup));
    } catch {
      /* Explicit exports are available. */
    }
  }, [setup, hydrated]);
  useEffect(() => {
    if (j.path !== "paint") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setPaintError("");
    });
    loadGame()
      .then((game) => {
        if (!cancelled) setPalettes(game.PLAY_LEVELS);
      })
      .catch(() => {
        if (!cancelled)
          setPaintError("Could not load the existing game engine.");
      });
    paintTrace(j.paint)
      .then((info) => {
        if (!cancelled) setPaintInfo(info);
      })
      .catch(() => {
        if (!cancelled) setPaintError("Could not calculate this paint trace.");
      });
    return () => {
      cancelled = true;
    };
  }, [j.path, j.paint]);
  const probeSamples = useMemo(
    () => Array.from({ length: 193 }, (_, i) => sampleProbe(j.probe, i / 192)),
    [j.probe],
  );
  const samples =
    j.path === "paint" && paintInfo ? paintInfo.samples : probeSamples;
  const pathSignals = useMemo(
    () => signalPath(samples, j.duration),
    [samples, j.duration],
  );
  const start = async () => {
    setStatus("loading");
    setError("");
    try {
      const e = engine.current!;
      e.parameters = sanitizeParameters(setupRef.current.parameters);
      await e.start();
      if (alive.current) setStatus(e.running ? "on" : "off");
    } catch (err) {
      if (alive.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not start sound.");
      }
    }
  };
  const reset = async () => {
    hold.current = null;
    setHolding(false);
    setStatus("loading");
    setRecording(false);
    const old = engine.current;
    engine.current = null;
    try {
      await old?.dispose();
    } finally {
      if (alive.current) {
        const next = new SoundLabEngine();
        next.onError = (message) => {
          setError(message);
          setStatus("error");
        };
        engine.current = next;
        next.configure(setupRef.current);
        next.setMappingMode(mappingMode);
        next.effectsBypassed = fxBypass;
        setStatus("off");
        setSnapshot(next.snapshot());
        setNotice(
          "Audio engine and all tails cleared. Every preference and preset is kept.",
        );
      }
    }
  };
  const load = (next: Setup) => {
    hold.current = null;
    setHolding(false);
    engine.current?.stopSound();
    setUndo(setup);
    update(next);
    setNotice("Setup loaded. Press Play shot to audition.");
  };
  const play = async (holdTime?: number) => {
    if (!engine.current?.running) return;
    const active = engine.current,
      revision = active.transportGeneration;
    hold.current = null;
    engine.current.charge(0);
    const next = sanitizeSetup(setupRef.current);
    let trace: ColorSample[] | undefined;
    if (next.journey.path === "paint") {
      if (holdTime !== undefined)
        next.journey.paint.hold = Math.min(4.4, holdTime);
      try {
        const info = await paintTrace(next.journey.paint);
        if (
          engine.current !== active ||
          revision !== active.transportGeneration ||
          !active.running
        )
          return;
        trace = info.samples;
        next.journey.duration = info.duration;
        if (next.journey.paint.target)
          next.journey.outcome = info.captured ? "capture" : "miss";
        setPaintInfo(info);
        update(next);
      } catch {
        setPaintError("Could not calculate this shot.");
        return;
      }
    }
    engine.current?.playShot(next, trace);
  };
  const beginHold = () => {
    if (!enabled || snapshot?.audioPaused) return;
    engine.current?.stopJourney();
    hold.current = performance.now();
    setHolding(true);
    setHeldSeconds(0);
  };
  const releaseHold = () => {
    if (hold.current === null) return;
    const t = (performance.now() - hold.current) / 1000;
    hold.current = null;
    setHolding(false);
    void play(t);
  };
  const cancelHold = () => {
    hold.current = null;
    setHolding(false);
    engine.current?.charge(0);
    setHeldSeconds(0);
  };
  const stopAll = () => {
    hold.current = null;
    setHolding(false);
    engine.current?.charge(0);
    engine.current?.stopSound();
  };
  const capture = () => {
    if (recording) {
      engine.current?.stopRecording();
      setRecording(false);
      if (recordTimer.current) clearTimeout(recordTimer.current);
      return;
    }
    const ok = engine.current?.startRecording((blob) => {
      const u = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = u;
      a.download = `chroma-shot-${Date.now()}.${blob.type.includes("mp4") ? "m4a" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
      if (alive.current) setRecording(false);
    });
    if (!ok) {
      setNotice(
        "Recording is unavailable in this browser. You can export the setup.",
      );
      return;
    }
    setRecording(true);
    recordTimer.current = setTimeout(() => {
      engine.current?.stopRecording();
      setRecording(false);
    }, 60000);
  };
  const currentSignals = snapshot?.signals ?? pathSignals[0],
    currentModel = SOUND_MODELS.find((x) => x.id === p.instrument)!;
  return (
    <main className="sl-root sl-v2">
      <header className="sl-header">
        <Link className="sl-back" href="/?mode=play">
          ← Munsell Eye
        </Link>
        <strong>Sound lab</strong>
        <span className="sl-status">
          {status === "loading"
            ? "Starting…"
            : enabled
              ? snapshot?.audioPaused
                ? "Audio paused"
                : "Audio ready"
              : "Audio off"}
        </span>
      </header>
      <div className="sl-workspace">
        <div className="sl-master">
          <div className="sl-button-row">
            <button
              className="sl-primary"
              disabled={busy}
              onClick={enabled ? stopAll : start}
            >
              {enabled ? "Stop all sources" : "Enable audio"}
            </button>
            <button
              disabled={!enabled}
              onClick={() => engine.current?.pauseSound()}
            >
              {snapshot?.audioPaused ? "Resume audio" : "Pause audio"}
            </button>
            <button disabled={busy} onClick={reset}>
              Reset audio · clear all
            </button>
            <button disabled={!enabled} onClick={capture}>
              {recording ? "Finish recording" : "Record output"}
            </button>
          </div>
          <Range
            label="Output"
            value={p.volume}
            min={0}
            max={0.8}
            onChange={(v) => change("volume", v)}
          />
        </div>
        {error && (
          <p role="alert" className="sl-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="sl-notice">
            {notice}
          </p>
        )}
        <section className="sl-shot" aria-label="Shared shot audition">
          <div className="sl-shot-view">
            <Trace samples={samples} progress={snapshot?.progress ?? 0} />
            <div className="sl-shot-badge">
              <strong>
                {holding
                  ? "Holding"
                  : snapshot?.paused
                    ? "Journey paused"
                    : (snapshot?.phase ?? "idle")}
              </strong>
              <span>
                {Math.round((snapshot?.progress ?? 0) * 100)}% ·{" "}
                {currentModel.name}
              </span>
            </div>
          </div>
          <div className="sl-shot-controls">
            <h1>Shape one journey</h1>
            <div className="sl-button-row">
              <button
                className="sl-primary"
                disabled={!enabled || snapshot?.audioPaused || !!paintError}
                onClick={() => play()}
              >
                Play shot
              </button>
              <button
                className="sl-hold"
                disabled={!enabled || snapshot?.audioPaused}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  beginHold();
                }}
                onPointerUp={releaseHold}
                onPointerCancel={cancelHold}
                onLostPointerCapture={() => {
                  if (hold.current !== null) cancelHold();
                }}
                onKeyDown={(e) => {
                  if ([" ", "Enter"].includes(e.key) && !e.repeat) {
                    e.preventDefault();
                    beginHold();
                  }
                }}
                onKeyUp={(e) => {
                  if ([" ", "Enter"].includes(e.key)) {
                    e.preventDefault();
                    releaseHold();
                  }
                }}
              >
                Hold & release{holding ? ` · ${heldSeconds.toFixed(1)}s` : ""}
              </button>
            </div>
            <div className="sl-button-row">
              <button
                disabled={
                  !enabled ||
                  !["flight", "arrival"].includes(snapshot?.phase ?? "")
                }
                onClick={() => engine.current?.pauseJourney()}
              >
                {snapshot?.paused ? "Resume journey" : "Pause journey"}
              </button>
              <button
                disabled={!enabled}
                onClick={() => {
                  cancelHold();
                  engine.current?.stopJourney();
                }}
              >
                Stop journey
              </button>
              <label className="sl-toggle">
                <input
                  type="checkbox"
                  checked={j.repeat}
                  onChange={(e) => setJourney({ repeat: e.target.checked })}
                />
                Repeat shot
              </label>
            </div>
            <p>
              Pause holds the journey position; existing tails continue. Stop
              ends its sources. Reset audio clears all buffers and keeps
              settings.
            </p>
            <div className="sl-grid-2">
              <Range
                label="Flight seconds"
                value={j.duration}
                min={0.7}
                max={12}
                step={0.1}
                onChange={(v) => setJourney({ duration: v })}
              />
              <label>
                Arrival test
                <select
                  disabled={j.path === "paint" && !!j.paint.target}
                  value={j.outcome}
                  onChange={(e) =>
                    setJourney({
                      outcome: e.target.value as Journey["outcome"],
                    })
                  }
                >
                  <option value="capture">Capture · complete arrival</option>
                  <option value="miss">Near miss · leave open</option>
                </select>
              </label>
            </div>
            <p>
              {j.path === "paint"
                ? "Paint trace uses the existing dose, mass and strength calculations. Flight is a lab preview without camera or capture deformation. Saved target determines the outcome when present."
                : "Color probe: a controlled sound experiment, not a scored game shot."}
            </p>
          </div>
        </section>
        <div className="sl-activity" aria-label="What is making sound">
          <span>Shot: {snapshot?.phase ?? "idle"}</span>
          <span>
            Motif:{" "}
            {snapshot?.motif
              ? snapshot.motifPaused
                ? "paused"
                : "repeating"
              : "off"}
          </span>
          <span>
            Ambient:{" "}
            {snapshot?.ambient
              ? snapshot.ambientPaused
                ? "paused"
                : "on"
              : "off"}
          </span>
          <span>
            Sustain:{" "}
            {snapshot?.sustain ? "on" : p.music.sustain ? "armed" : "off"}
          </span>
          <span>
            Echo: {fxBypass ? "bypassed" : p.echo > 0 ? "enabled" : "off"}
          </span>
          <span>
            Grains:{" "}
            {fxBypass
              ? "bypassed"
              : p.freeze
                ? "frozen memory"
                : p.grains + p.reverse > 0
                  ? "rolling memory"
                  : "off"}
          </span>
          <span>Mappings: {mappingMode}</span>
        </div>
        <div className="sl-tabs" role="tablist" aria-label="Journey workbench">
          {(["journey", "sound", "mapping"] as Tab[]).map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
            >
              {t === "journey"
                ? "Journey"
                : t === "sound"
                  ? "Sound"
                  : "Mapping"}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "journey" && (
            <>
              <div className="sl-section-head">
                <div>
                  <h2>One harmony, many moving notes</h2>
                  <p>
                    Progression, arpeggio density, and sound effects remain
                    independent.
                  </p>
                </div>
                <div className="sl-button-row">
                  <button
                    disabled={!enabled || !snapshot?.motif}
                    onClick={() => engine.current?.pauseMotif()}
                  >
                    {snapshot?.motifPaused ? "Resume motif" : "Pause motif"}
                  </button>
                  <button
                    disabled={!enabled}
                    onClick={() => engine.current?.stopMotif()}
                  >
                    Stop motif
                  </button>
                </div>
              </div>
              <MelodyGrid
                value={p.music}
                onChange={(music) => change("music", music)}
                step={snapshot?.step ?? 0}
                customScale={p.intervals.map(
                  (cents) => 69 + 12 * Math.log2(p.root / 440) + cents / 100,
                )}
                timing={j.rhythm}
                onUseTiming={() => setJourney({ rhythm: "motif" })}
                onAudition={() => {
                  engine.current?.stopJourney();
                  engine.current?.scatter();
                }}
                enabled={enabled && !snapshot?.audioPaused}
              />
              <details className="sl-card" open={p.instrument === "vocal"}>
                <summary>Vocal shot glide</summary>
                <p>
                  The Vocal glide model slides toward the current harmonic
                  voices. Pitch shape is separate from the vowel and breath
                  controls in Sound.
                </p>
                <div className="sl-grid-3">
                  {GROUPS.flatMap((g) => g.sliders)
                    .filter((spec) =>
                      ["glideTime", "glideStart", "glideCurve"].includes(
                        spec.key,
                      ),
                    )
                    .map((spec) => (
                      <Slider
                        key={spec.key}
                        spec={spec}
                        value={p[spec.key]}
                        mapped={snapshot?.mapped[spec.key as Destination]}
                        onChange={(v) => change(spec.key, v)}
                      />
                    ))}
                </div>
              </details>
              <div className="sl-grid-3 sl-card">
                <label>
                  Advance harmony by
                  <select
                    value={j.advance}
                    onChange={(e) =>
                      setJourney({
                        advance: e.target.value as Journey["advance"],
                      })
                    }
                  >
                    <option value="manual">Manual · Next harmony</option>
                    <option value="shot">Once per shot</option>
                    <option value="progress">Shot progress</option>
                    <option value="hue">Accumulated hue travel</option>
                  </select>
                </label>
                <Range
                  label="Harmony changes per arc"
                  min={0}
                  max={8}
                  step={1}
                  value={j.changes}
                  onChange={(v) => setJourney({ changes: v })}
                />
                <label>
                  Shot rhythm
                  <select
                    value={j.rhythm}
                    onChange={(e) =>
                      setJourney({
                        rhythm: e.target.value as Journey["rhythm"],
                      })
                    }
                  >
                    <option value="density">
                      Notes per second / density mappings
                    </option>
                    <option value="motif">
                      Motif tempo, spacing and rests
                    </option>
                  </select>
                </label>
                <Range
                  label="Arpeggio notes / second"
                  min={1}
                  max={24}
                  step={1}
                  value={j.density}
                  onChange={(v) => setJourney({ density: v })}
                />
                <Range
                  label="Arrival seconds"
                  min={0.2}
                  max={6}
                  step={0.1}
                  value={j.arrival}
                  onChange={(v) => setJourney({ arrival: v })}
                />
                <Range
                  label="Repeat gap seconds"
                  min={1}
                  max={15}
                  step={0.5}
                  value={j.gap}
                  onChange={(v) => setJourney({ gap: v })}
                />
                <Range
                  label="Hanging note ring time"
                  min={0.4}
                  max={9}
                  step={0.1}
                  value={p.decay}
                  onChange={(v) => change("decay", v)}
                />
              </div>
              <MusicPanel
                value={p.music}
                onChange={(music) => change("music", music)}
                enabled={enabled && !snapshot?.audioPaused}
                playing={!!snapshot?.motif}
                step={snapshot?.step ?? 0}
                onPlay={() => engine.current?.playMotif()}
                onStop={() => engine.current?.stopMotif()}
                onNext={() => engine.current?.nextHarmony()}
              />
              <details className="sl-card">
                <summary>Custom tuning · foundation and six intervals</summary>
                <label className="sl-toggle">
                  <input
                    type="checkbox"
                    checked={p.music.source === "custom"}
                    onChange={(e) =>
                      change("music", {
                        ...p.music,
                        source: e.target.checked ? "custom" : "system",
                      })
                    }
                  />
                  Use custom cents instead of named scale
                </label>
                <Range
                  label="Custom foundation Hz"
                  min={45}
                  max={220}
                  step={0.1}
                  value={p.root}
                  onChange={(v) => change("root", v)}
                />
                <label>
                  Tuning starting point
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const tuning = TUNINGS[Number(e.target.value)];
                      if (tuning) change("intervals", tuning.intervals);
                    }}
                  >
                    <option value="" disabled>
                      Choose intervals…
                    </option>
                    {TUNINGS.map((t, i) => (
                      <option key={t.name} value={i}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sl-grid-3">
                  {p.intervals.map((v, i) => (
                    <label key={i}>
                      Voice {i + 1} · cents
                      <input
                        type="number"
                        min={-1200}
                        max={3600}
                        step={0.01}
                        value={v}
                        onChange={(e) =>
                          change(
                            "intervals",
                            p.intervals.map((x, k) =>
                              k === i ? Number(e.target.value) : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
              <section className="sl-card">
                <h3>Optional ambient layer</h3>
                <div className="sl-button-row">
                  <button
                    disabled={!enabled}
                    onClick={() => {
                      engine.current?.setAmbient(true);
                      if (engine.current) engine.current.ambientPaused = false;
                    }}
                  >
                    Start ambient
                  </button>
                  <button
                    disabled={!enabled || !snapshot?.ambient}
                    onClick={() => {
                      if (engine.current)
                        engine.current.ambientPaused =
                          !engine.current.ambientPaused;
                    }}
                  >
                    {snapshot?.ambientPaused
                      ? "Resume ambient"
                      : "Pause ambient"}
                  </button>
                  <button
                    disabled={!enabled}
                    onClick={() => engine.current?.stopAmbient()}
                  >
                    Stop ambient
                  </button>
                </div>
                <Range
                  label="Ambient activity"
                  value={p.activity}
                  min={0}
                  max={1}
                  onChange={(v) => change("activity", v)}
                />
                <p>
                  Independent of the shot and motif. Pausing stops new notes;
                  stopping also ends its sounding sources. Shared effects can
                  still ring.
                </p>
              </section>
            </>
          )}
          {tab === "sound" && (
            <>
              <div className="sl-section-head">
                <div>
                  <h2>Instrument & ribbon</h2>
                  <p>
                    Sound models change the source and its controls. Your
                    harmony and mappings stay in place.
                  </p>
                </div>
                <div className="sl-button-row">
                  <button
                    disabled={!enabled}
                    onClick={() => engine.current?.pauseSound()}
                  >
                    {snapshot?.audioPaused ? "Resume sound" : "Pause sound"}
                  </button>
                  <button disabled={!enabled} onClick={stopAll}>
                    Stop sound
                  </button>
                </div>
              </div>
              <div className="sl-models">
                {SOUND_MODELS.map((model) => (
                  <button
                    key={model.id}
                    aria-pressed={p.instrument === model.id}
                    onClick={() => {
                      engine.current?.stopJourney();
                      setSetup((s) =>
                        sanitizeSetup({
                          ...s,
                          parameters: { ...s.parameters, ...model.values },
                        }),
                      );
                    }}
                  >
                    <strong>{model.name}</strong>
                    <small>{model.description}</small>
                  </button>
                ))}
              </div>
              <p className="sl-notice">
                Piano is generated synthesis, not an acoustic sample.
                Convergence is an original voice-gathering instrument. Glass
                ribbon is an experiment, not a verified recording
                reconstruction.
              </p>
              <div className="sl-routing">
                <strong>
                  Source →{" "}
                  {p.grainRoute === "before"
                    ? "grains → resonant bands"
                    : "resonant bands + parallel grains"}{" "}
                  → echoes → room
                </strong>
                <div className="sl-button-row">
                  <button
                    disabled={!enabled || snapshot?.audioPaused}
                    onClick={() => engine.current?.note(0, 1, 0.8)}
                  >
                    Strike input
                  </button>
                  <button
                    disabled={!enabled || snapshot?.audioPaused}
                    onClick={() => engine.current?.scatter()}
                  >
                    Play input phrase once
                  </button>
                  <button
                    onClick={() => {
                      setFxBypass(!fxBypass);
                      engine.current?.setEffectsBypass(!fxBypass);
                    }}
                  >
                    {fxBypass ? "Enable effects" : "Bypass effects"}
                  </button>
                  <button
                    disabled={!enabled}
                    onClick={() => engine.current?.clearEffects()}
                  >
                    Clear effect memory
                  </button>
                </div>
              </div>
              <div className="sl-grid-3 sl-card">
                <label>
                  Filter tuning
                  <select
                    value={p.filterFollow}
                    onChange={(e) => change("filterFollow", e.target.value)}
                  >
                    <option value="chord">Follow current chord voices</option>
                    <option value="manual">Independent manual anchor</option>
                  </select>
                </label>
                <label>
                  Granular routing
                  <select
                    value={p.grainRoute}
                    onChange={(e) => change("grainRoute", e.target.value)}
                  >
                    <option value="parallel">Alongside the ribbon</option>
                    <option value="before">Through the ribbon</option>
                  </select>
                </label>
                <label>
                  Sweep clock
                  <select
                    value={p.modulation}
                    onChange={(e) =>
                      change("modulation", Number(e.target.value))
                    }
                  >
                    <option value={1}>Free oscillator</option>
                    <option value={0}>
                      Paused oscillator · use shot mapping
                    </option>
                  </select>
                </label>
              </div>
              <div className="sl-control-groups">
                {GROUPS.map((group) => (
                  <details
                    key={group.name}
                    className="sl-card"
                    open={
                      group.name === "Instrument detail" ||
                      group.name === "Ribbon workbench"
                    }
                  >
                    <summary>{group.name}</summary>
                    <p>{group.subtitle}</p>
                    <div className="sl-grid-3">
                      {group.sliders
                        .filter(
                          (spec) =>
                            ![
                              "root",
                              "activity",
                              "glideTime",
                              "glideStart",
                              "glideCurve",
                            ].includes(spec.key),
                        )
                        .filter(
                          (spec) =>
                            p.instrument === "convergence" ||
                            !["voices", "spread", "converge"].includes(
                              spec.key,
                            ),
                        )
                        .map((spec) => (
                          <Slider
                            key={spec.key}
                            spec={spec}
                            value={p[spec.key]}
                            mapped={snapshot?.mapped[spec.key as Destination]}
                            onChange={(v) => change(spec.key, v)}
                          />
                        ))}
                    </div>
                  </details>
                ))}
              </div>
              <details className="sl-card">
                <summary>Earlier sound starting points</summary>
                <div className="sl-button-row">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() =>
                        setSetup((s) =>
                          sanitizeSetup({
                            ...s,
                            parameters: {
                              ...preset.values,
                              music: s.parameters.music,
                              root: s.parameters.root,
                              intervals: s.parameters.intervals,
                            },
                          }),
                        )
                      }
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </details>
            </>
          )}
          {tab === "mapping" && (
            <>
              <div className="sl-section-head">
                <div>
                  <h2>What movement changes</h2>
                  <p>
                    One connection per destination. Base sliders remain intact;
                    the live value appears alongside them.
                  </p>
                </div>
                <div className="sl-button-row">
                  <button
                    onClick={() => {
                      const next = mappingMode === "paused" ? "on" : "paused";
                      setMappingMode(next);
                      engine.current?.setMappingMode(next);
                    }}
                  >
                    {mappingMode === "paused"
                      ? "Resume mappings"
                      : "Pause mappings"}
                  </button>
                  <button
                    onClick={() => {
                      setMappingMode("off");
                      engine.current?.setMappingMode("off");
                    }}
                  >
                    Stop mappings
                  </button>
                  <button
                    onClick={() => {
                      setMappingMode("on");
                      engine.current?.setMappingMode("on");
                    }}
                  >
                    Enable mappings
                  </button>
                </div>
              </div>
              <p className="sl-notice">
                Pause holds the last mapped values. Stop returns to the base
                controls. Neither deletes your connections.
              </p>
              <section className="sl-card">
                <label>
                  Trajectory source
                  <select
                    value={j.path}
                    onChange={(e) =>
                      setJourney({ path: e.target.value as Journey["path"] })
                    }
                  >
                    <option value="probe">Editable color probe</option>
                    <option value="paint">Existing game paint mixing</option>
                  </select>
                </label>
                {j.path === "probe" ? (
                  <>
                    <div className="sl-button-row">
                      {PROBES.map((pr) => (
                        <button
                          key={pr.name}
                          onClick={() =>
                            setJourney({
                              probe: pr.probe,
                              duration: pr.duration,
                            })
                          }
                        >
                          {pr.name}
                        </button>
                      ))}
                    </div>
                    <div className="sl-grid-3">
                      {(
                        [
                          ["hue", "Starting hue", 0, 360, 1],
                          ["hueTravel", "Hue travel degrees", -360, 360, 1],
                          ["lightness", "Starting lightness", 0.05, 0.95, 0.01],
                          ["lift", "Lightness development", -0.8, 0.8, 0.01],
                          ["edge", "Starting boundary fraction", 0, 1, 0.01],
                          ["edgeEnd", "Ending boundary fraction", 0, 1, 0.01],
                          ["bow", "Interior / outward bow", -1, 1, 0.01],
                        ] as const
                      ).map(([key, label, min, max, step]) => (
                        <Range
                          key={key}
                          label={label}
                          value={j.probe[key]}
                          min={min}
                          max={max}
                          step={step}
                          onChange={(v) =>
                            setJourney({ probe: { ...j.probe, [key]: v } })
                          }
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <label>
                      Palette
                      <select
                        value={j.paint.level}
                        onChange={(e) => {
                          const level = Number(e.target.value);
                          setJourney({
                            paint: {
                              ...j.paint,
                              level,
                              before: palettes[level].paints.map((_, i) =>
                                i === 0 ? 1 : 0,
                              ),
                              index: 1,
                            },
                          });
                        }}
                      >
                        {palettes.map((pl, i) => (
                          <option key={i} value={i}>
                            {pl.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="sl-grid-3">
                      {palettes[j.paint.level]?.paints.map((paint, i) => (
                        <label key={i}>
                          {paint.name} · starting parts
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            step={0.1}
                            value={j.paint.before[i] ?? 0}
                            onChange={(e) =>
                              setJourney({
                                paint: {
                                  ...j.paint,
                                  before: palettes[j.paint.level].paints.map(
                                    (_, k) =>
                                      k === i
                                        ? Number(e.target.value)
                                        : (j.paint.before[k] ?? 0),
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="sl-grid-2">
                      <label>
                        Paint to add
                        <select
                          value={j.paint.index}
                          onChange={(e) =>
                            setJourney({
                              paint: {
                                ...j.paint,
                                index: Number(e.target.value),
                              },
                            })
                          }
                        >
                          {palettes[j.paint.level]?.paints.map((paint, i) => (
                            <option value={i} key={i}>
                              {paint.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Range
                        label="Saved hold seconds"
                        min={0}
                        max={4.4}
                        step={0.01}
                        value={j.paint.hold}
                        onChange={(v) =>
                          setJourney({ paint: { ...j.paint, hold: v } })
                        }
                      />
                    </div>
                    <div className="sl-button-row">
                      <button
                        disabled={!paintInfo}
                        onClick={() =>
                          setJourney({
                            paint: { ...j.paint, target: paintInfo!.endpoint },
                          })
                        }
                      >
                        Use this endpoint as target
                      </button>
                      <button
                        disabled={!j.paint.target}
                        onClick={() =>
                          setJourney({ paint: { ...j.paint, target: null } })
                        }
                      >
                        Clear target
                      </button>
                      <button
                        disabled={!paintInfo}
                        onClick={() =>
                          setJourney({
                            paint: { ...j.paint, before: paintInfo!.after },
                          })
                        }
                      >
                        Continue from this mixture
                      </button>
                    </div>
                    <p>
                      {paintError ||
                        (!paintInfo
                          ? "Calculating trace…"
                          : `${paintInfo.freeBase ? "Free base · " : ""}${paintInfo.amount.toFixed(3)} parts added · ${paintInfo.duration.toFixed(2)}s flight${paintInfo.distance === null ? " · no target: audition outcome above" : ` · endpoint Δ ${paintInfo.distance.toFixed(4)} · ${paintInfo.captured ? "capture" : "miss"}`}`)}
                    </p>
                  </>
                )}
                <p>
                  Boundary reference: sRGB at the current OKLab lightness and
                  hue. This is distinct from the palette’s reachable hull and
                  the game’s displayed Munsell field.
                </p>
              </section>
              <div className="sl-signal-grid">
                {INPUTS.map(([key, label]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <meter min={0} max={1} value={currentSignals[key]} />
                    <output>{currentSignals[key].toFixed(2)}</output>
                  </div>
                ))}
              </div>
              <p>
                Edge travel accumulates chromatic hue movement while staying
                near the boundary. Neutral ascent accumulates upward travel at
                low absolute chroma. Hue fades near neutral; signed developments
                use 0.5 as no change.
              </p>
              <div className="sl-mappings">
                {setup.mappings.map((row) => {
                  const dest = OUTPUTS.find((o) => o[0] === row.target)!;
                  return (
                    <section className="sl-card" key={row.id}>
                      <div className="sl-map-row">
                        <label className="sl-toggle">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) =>
                              updateRow(row.id, { enabled: e.target.checked })
                            }
                          />
                          On
                        </label>
                        <label>
                          Movement
                          <select
                            value={row.source}
                            onChange={(e) =>
                              updateRow(row.id, {
                                source: e.target.value as Mapping["source"],
                              })
                            }
                          >
                            {INPUTS.map(([id, name]) => (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span aria-hidden="true">→</span>
                        <label>
                          Sound / music
                          <select
                            value={row.target}
                            onChange={(e) => {
                              const out = OUTPUTS.find(
                                (o) => o[0] === e.target.value,
                              )!;
                              updateRow(row.id, {
                                target: out[0],
                                low: out[2],
                                high: out[3],
                              });
                            }}
                          >
                            {OUTPUTS.map(([id, name]) => (
                              <option
                                key={id}
                                value={id}
                                disabled={setup.mappings.some(
                                  (r) => r.id !== row.id && r.target === id,
                                )}
                              >
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() =>
                            setSetup((s) => ({
                              ...s,
                              mappings: s.mappings.filter(
                                (r) => r.id !== row.id,
                              ),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <div className="sl-grid-4">
                        <Range
                          label="From"
                          value={row.low}
                          min={dest[2]}
                          max={dest[3]}
                          step={dest[3] > 30 ? 1 : 0.01}
                          onChange={(v) => updateRow(row.id, { low: v })}
                        />
                        <Range
                          label="To"
                          value={row.high}
                          min={dest[2]}
                          max={dest[3]}
                          step={dest[3] > 30 ? 1 : 0.01}
                          onChange={(v) => updateRow(row.id, { high: v })}
                        />
                        <label>
                          Response shape
                          <select
                            value={row.curve}
                            onChange={(e) =>
                              updateRow(row.id, {
                                curve: e.target.value as Mapping["curve"],
                              })
                            }
                          >
                            <option value="linear">Linear</option>
                            <option value="ease">Ease in / out</option>
                            <option value="grow">Build gradually</option>
                            <option value="arch">Rise then fall</option>
                          </select>
                        </label>
                        <Range
                          label="Smoothing seconds"
                          value={row.smooth}
                          min={0}
                          max={2}
                          step={0.05}
                          onChange={(v) => updateRow(row.id, { smooth: v })}
                        />
                      </div>
                      <p>
                        {row.enabled
                          ? `Live output: ${format(snapshot?.mapped[row.target] ?? row.low)}`
                          : "Bypassed"}
                        {["voices", "spread", "converge"].includes(row.target)
                          ? " · used by Chromatic convergence sound model"
                          : ""}
                      </p>
                    </section>
                  );
                })}
              </div>
              <button
                disabled={setup.mappings.length >= 12}
                onClick={() => {
                  const out = OUTPUTS.find(
                    (o) => !setup.mappings.some((r) => r.target === o[0]),
                  );
                  if (out)
                    setSetup((s) => ({
                      ...s,
                      mappings: [
                        ...s.mappings,
                        {
                          id: crypto.randomUUID(),
                          enabled: true,
                          source: "progress",
                          target: out[0],
                          low: out[2],
                          high: out[3],
                          curve: "ease",
                          smooth: 0.2,
                        },
                      ],
                    }));
                }}
              >
                Add connection
              </button>
            </>
          )}
        </div>
        <section className="sl-starting-setups">
          <h2>Complete starting setups</h2>
          <p>
            Loads Journey, Sound and Mapping together. Each is an original
            starting point to tune.
          </p>
          <div className="sl-models">
            {STARTERS.map((s) => (
              <button key={s.id} onClick={() => load(s.setup)}>
                <strong>{s.name}</strong>
                <small>{s.notes}</small>
              </button>
            ))}
          </div>
        </section>
        <PresetLibrary setup={setup} onLoad={load} signIn={signIn} />
        <details className="sl-card">
          <summary>Restore controls</summary>
          <p>
            This restores the current workbench to defaults. Saved presets
            remain. Reset audio above only clears sound.
          </p>
          <div className="sl-button-row">
            <button
              onClick={() => {
                setUndo(setup);
                engine.current?.stopSound();
                update(DEFAULT_SETUP);
                setNotice(
                  "Default controls restored. You can undo this change.",
                );
              }}
            >
              Restore all defaults
            </button>
            {undo && (
              <button
                onClick={() => {
                  engine.current?.stopSound();
                  update(undo);
                  setUndo(null);
                }}
              >
                Undo settings change
              </button>
            )}
          </div>
        </details>
        <footer className="sl-footer">
          <span>Browser SuperCollider · generated sources</span>
          <span>Shared journey · isolated game lab</span>
          <a href="/sound-lab/runtime/LICENSE">Engine license</a>
        </footer>
      </div>
    </main>
  );
}
