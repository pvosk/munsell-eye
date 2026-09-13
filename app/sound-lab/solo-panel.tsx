import { useEffect, useRef, useState, type ReactNode } from "react";
import { GROUPS, type Parameters, type SliderKey } from "./parameters";
import { KEYS, MODES, STACKS, ARPS } from "./music";
import { sanitizeSetup, type Setup } from "./presets";
import {
  SOLO_KINDS,
  soloDefault,
  type SoloGesture,
  type SoloKind,
} from "./solo-settings";
import { SoloPlayer, SOURCE_KEYS } from "./solo-player";
import { PresetLibrary } from "./preset-library";

const STORE = "chroma-solo-drafts-v1";
const initial = () =>
  Object.fromEntries(
    SOLO_KINDS.map((k) => [k.id, soloDefault(k.id)]),
  ) as Record<SoloKind, Setup>;
export function SoloPanel({
  incoming,
  onConsumed,
  onUseSound,
  signIn,
}: {
  incoming?: Setup;
  onConsumed: () => void;
  onUseSound: (s: Setup) => void;
  signIn: ReactNode;
}) {
  const [bank, setBank] = useState(initial),
    [kind, setKind] = useState<SoloKind>("glass"),
    [ready, setReady] = useState(false),
    [running, setRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Ready · press Play solo"),
    [time, setTime] = useState(0),
    [paused, setPaused] = useState(false),
    [dryOnly, setDryOnly] = useState(false),
    [recording, setRecording] = useState(false);
  const player = useRef<SoloPlayer | null>(null),
    live = useRef(true);
  const setup = bank[kind],
    p = setup.parameters,
    s = setup.solo!,
    span = kind === "pop" ? p.decay : s.duration,
    finish = kind === "convergence" ? span + s.hold + 0.5 : span;
  const current = useRef(setup);
  useEffect(() => {
    current.current = setup;
  }, [setup]);
  const load = (next: Setup) => {
    if (!next.solo) {
      setStatus(
        "Choose a Solo sounds preset here. Journey presets stay in the main workshop.",
      );
      return;
    }
    const value = sanitizeSetup(next),
      id = value.solo!.kind;
    player.current?.stop();
    setKind(id);
    setBank((b) => ({ ...b, [id]: value }));
    setStatus("Solo preset loaded. Play to audition.");
  };
  useEffect(() => {
    live.current = true;
    player.current = new SoloPlayer(current.current);
    queueMicrotask(() => {
      if (!live.current) return;
      try {
        const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
        if (saved?.bank) {
          const restored = initial();
          for (const k of SOLO_KINDS)
            if (saved.bank[k.id]?.solo?.kind === k.id)
              restored[k.id] = sanitizeSetup(saved.bank[k.id]);
          setBank(restored);
          if (SOLO_KINDS.some((k) => k.id === saved.kind)) setKind(saved.kind);
        }
      } catch {
        /* Portable library remains available. */
      }
      setReady(true);
    });
    const timer = setInterval(() => {
      const e = player.current;
      if (!e) return;
      setTime(e.time);
      setPaused(e.engine.audioPaused);
      setRunning(e.engine.running);
      if (e.error) setStatus(e.error);
    }, 80);
    const hide = () => {
      if (document.hidden) {
        player.current?.stop();
        setStatus("Stopped while the page was hidden.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      live.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      void player.current?.dispose();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    if (ready && incoming?.solo)
      queueMicrotask(() => {
        if (live.current) {
          load(incoming);
          onConsumed();
        }
      });
    // Incoming changes are explicit library recalls, not local slider edits.
  }, [incoming, ready, onConsumed]);
  useEffect(() => {
    player.current?.configure(setup);
    if (ready)
      try {
        localStorage.setItem(STORE, JSON.stringify({ bank, kind }));
      } catch {
        /* Export instead. */
      }
  }, [setup, bank, kind, ready]);
  const play = async () => {
    const e = player.current;
    if (!e || busy) return;
    setBusy(true);
    await e.play();
    if (live.current) {
      setBusy(false);
      setStatus(
        e.error ||
          "Auditioning · effects live; source tweaks retrigger when enabled.",
      );
    }
  };
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        player.current?.stop();
        setStatus("Stopped · all tails cleared; controls kept.");
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input,select,textarea,[contenteditable=true]"))
        return;
      if (
        e.key.toLowerCase() === "p" ||
        (e.code === "Space" && !target.closest("button,a"))
      ) {
        e.preventDefault();
        void playRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const change = (key: keyof Parameters, value: unknown) =>
    setBank((b) => ({
      ...b,
      [kind]: sanitizeSetup({
        ...b[kind],
        parameters: { ...b[kind].parameters, [key]: value },
      }),
    }));
  const gesture = (patch: Partial<SoloGesture>) =>
    setBank((b) => ({
      ...b,
      [kind]: sanitizeSetup({
        ...b[kind],
        solo: { ...b[kind].solo, ...patch },
      }),
    }));
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    change: (v: number) => void,
    hint?: string,
    disabled = false,
  ) => (
    <label className="sl-range" key={label}>
      <span>
        {label}
        <output>{Number.isInteger(value) ? value : value.toFixed(2)}</output>
      </span>
      <input
        type="range"
        disabled={disabled}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => change(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
  const sliders = (keys: SliderKey[]) => (
    <div className="sl-grid-3">
      {keys.map((key) => {
        const spec = GROUPS.flatMap((g) => g.sliders).find(
          (x) => x.key === key,
        )!;
        const label =
          kind === "pop" && key === "hardness"
            ? "Air transient"
            : kind === "harp" && key === "harmonics"
              ? "String brightness"
              : kind === "pop" && key === "glideStart"
                ? "Initial pitch offset"
                : kind === "pop" && key === "glideTime"
                  ? "Pitch fall seconds"
                  : spec.label;
        return range(
          label,
          p[key],
          spec.min,
          spec.max,
          spec.step,
          (v) => change(key, v),
          `${key === "motion" && !p.modulation ? "Enable Animate bands to use this control. " : kind !== "convergence" && SOURCE_KEYS.includes(key as (typeof SOURCE_KEYS)[number]) ? "New onset / retrigger. " : "Live. "}${spec.hint}`,
          key === "motion" && p.modulation === 0,
        );
      })}
    </div>
  );
  return (
    <section
      role="tabpanel"
      id="panel-solo"
      aria-labelledby="tab-solo"
      className="sl-solo"
    >
      <div className="sl-solo-transport">
        <button
          className="sl-primary"
          disabled={busy || !ready}
          onClick={() => void play()}
        >
          {busy ? "Starting…" : "▶ Play / retrigger solo · P"}
        </button>
        <button
          disabled={!running}
          onClick={() => void player.current?.pause()}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => {
            player.current?.stop();
            setStatus("Stopped · all tails cleared; controls kept.");
          }}
        >
          Stop + tails
        </button>
        <label className="sl-check">
          <input
            type="checkbox"
            checked={s.loop}
            onChange={(e) => gesture({ loop: e.target.checked })}
          />
          Loop
        </label>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await player.current?.dispose();
            if (live.current) {
              player.current = new SoloPlayer(current.current);
              setDryOnly(false);
              setRecording(false);
              setPaused(false);
              setBusy(false);
              setTime(0);
              setStatus("Audio reset. All five sound drafts are kept.");
            }
          }}
        >
          Reset audio
        </button>
        <small>
          {Math.min(time, finish + s.gap).toFixed(1)}s ·{" "}
          {paused ? "Paused" : time < span ? "Gesture" : "Tail / gap"}
        </small>
      </div>
      <h2>Solo sounds</h2>
      <p>
        One sound, a fixed pitch or chord, and a repeatable gesture. No journey
        mappings or harmonic progression.
      </p>
      <div className="sl-models">
        {SOLO_KINDS.map((k) => (
          <button
            key={k.id}
            aria-pressed={kind === k.id}
            onClick={() => {
              player.current?.stop();
              setKind(k.id);
              setTime(0);
              setStatus("Sound draft selected. Press Play solo.");
            }}
          >
            <strong>{k.name}</strong>
            <small>{k.description}</small>
          </button>
        ))}
      </div>
      <p role="status" className="sl-notice">
        {status}
      </p>
      {range("Solo output", p.volume, 0, 0.8, 0.01, (v) => change("volume", v))}
      <div className="sl-button-row">
        <label className="sl-check">
          <input
            type="checkbox"
            checked={s.autoRetrigger}
            onChange={(e) => gesture({ autoRetrigger: e.target.checked })}
          />
          Retrigger after source edits
        </label>
        <label className="sl-check">
          <input
            type="checkbox"
            checked={s.cleanLoop}
            onChange={(e) => gesture({ cleanLoop: e.target.checked })}
          />
          Clear old tails each loop
        </label>
        <label className="sl-check">
          <input
            type="checkbox"
            checked={dryOnly}
            onChange={(e) => {
              setDryOnly(e.target.checked);
              player.current?.engine.setEffectsBypass(e.target.checked);
            }}
          />
          Hear source only
        </label>
      </div>
      <p>
        {dryOnly
          ? "Effects are bypassed for comparison. Turn off Hear source only to hear filter and grain changes."
          : "Filter, grain and space controls update live. Source envelopes need a fresh onset; auto-retrigger waits until you stop adjusting for a moment."}
      </p>
      <section className="sl-card">
        <h3>Gesture & fixed reference</h3>
        <div className="sl-grid-3">
          <label>
            Key
            <select
              value={p.music.tonic}
              onChange={(e) =>
                change("music", {
                  ...p.music,
                  source: "system",
                  tonic: Number(e.target.value),
                })
              }
            >
              {KEYS.map((k, i) => (
                <option key={k} value={i}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          {kind !== "pop" && (
            <>
              <label>
                Mode / scale
                <select
                  value={p.music.mode}
                  onChange={(e) =>
                    change("music", {
                      ...p.music,
                      source: "system",
                      mode: e.target.value,
                    })
                  }
                >
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {kind === "harp"
                  ? "Resonator chord · effects only"
                  : "Fixed chord"}
                <select
                  value={p.music.stack}
                  onChange={(e) =>
                    change("music", {
                      ...p.music,
                      source: "system",
                      stack: e.target.value,
                    })
                  }
                >
                  {STACKS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {range("Reference octave", p.music.octave, 1, 4, 1, (v) =>
            change("music", { ...p.music, octave: v }),
          )}
          {kind !== "pop" &&
            range(
              kind === "convergence" ? "Gathering seconds" : "Gesture seconds",
              s.duration,
              0.15,
              12,
              0.05,
              (v) => gesture({ duration: v }),
            )}
          {range("Loop gap seconds", s.gap, 0.3, 12, 0.1, (v) =>
            gesture({ gap: v }),
          )}
          {kind === "convergence"
            ? range("Hold destination seconds", s.hold, 0, 6, 0.1, (v) =>
                gesture({ hold: v }),
              )
            : kind !== "pop" && (
                <>
                  {range("Note count", s.count, 1, 96, 1, (v) =>
                    gesture({ count: v }),
                  )}
                  {range("Octave span", s.octaves, 1, 3, 1, (v) =>
                    gesture({ octaves: v }),
                  )}
                  {range(
                    "Spacing curve",
                    s.spacingCurve,
                    0.3,
                    3,
                    0.05,
                    (v) => gesture({ spacingCurve: v }),
                    "One is even; higher values begin quickly and spread out.",
                  )}
                </>
              )}
          {kind === "harp" ? (
            <label>
              Glissando direction
              <select
                value={s.direction}
                onChange={(e) =>
                  gesture({
                    direction: e.target.value as SoloGesture["direction"],
                  })
                }
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="arch">Up then down</option>
              </select>
            </label>
          ) : (
            kind !== "pop" &&
            kind !== "convergence" && (
              <label>
                Fixed pattern
                <select
                  value={p.music.arp}
                  onChange={(e) =>
                    change("music", { ...p.music, arp: e.target.value })
                  }
                >
                  {ARPS.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )
          )}
        </div>
      </section>
      {kind === "glass" && (
        <section className="sl-card">
          <h3>Ribbon experiments</h3>
          <p>
            Compare these on the same fixed phrase. They are separate hypotheses
            for the glass-ribbon effect, not a reconstruction of the recording.
          </p>
          <div className="sl-button-row">
            {[
              {
                name: "Ringing bands",
                values: {
                  instrument: "piano",
                  dry: 0.5,
                  ribbon: 0.85,
                  reverse: 0,
                  grains: 0,
                  modulation: 1,
                  motion: 0.12,
                  sweepDepth: 0.65,
                },
              },
              {
                name: "Reverse swell",
                values: {
                  instrument: "piano",
                  dry: 0.3,
                  ribbon: 0.3,
                  reverse: 0.65,
                  grains: 0.2,
                  grain: 0.65,
                  modulation: 0,
                },
              },
              {
                name: "Synthetic ribbon",
                values: {
                  instrument: "synth",
                  dry: 0.35,
                  ribbon: 0.8,
                  harmonics: 0.65,
                  reverse: 0.15,
                  grains: 0.08,
                  modulation: 1,
                  motion: 0.18,
                  sweepDepth: 0.8,
                },
              },
            ].map((experiment) => (
              <button
                key={experiment.name}
                onClick={() =>
                  setBank((b) => ({
                    ...b,
                    [kind]: sanitizeSetup({
                      ...b[kind],
                      parameters: {
                        ...b[kind].parameters,
                        ...experiment.values,
                      },
                    }),
                  }))
                }
              >
                {experiment.name}
              </button>
            ))}
          </div>
          <label>
            Input source
            <select
              value={p.instrument}
              onChange={(e) => change("instrument", e.target.value)}
            >
              {["glass", "piano", "synth", "harp"].map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <section className="sl-card">
        <h3>
          {kind === "convergence"
            ? "Cloud & continuous convergence"
            : "Excitation & body"}
        </h3>
        {sliders(
          kind === "convergence"
            ? [
                "voices",
                "spread",
                "wander",
                "wanderRate",
                "gatherStart",
                "gatherCurve",
                "converge",
                "drive",
                "harmonics",
                "detune",
              ]
            : kind === "pop"
              ? [
                  "attack",
                  "decay",
                  "hardness",
                  "harmonics",
                  "glideStart",
                  "glideTime",
                ]
              : p.instrument === "glass"
                ? ["attack", "decay", "material"]
                : [
                    "attack",
                    "decay",
                    "hardness",
                    "harmonics",
                    ...(p.instrument === "piano" || p.instrument === "synth"
                      ? ["detune" as const]
                      : []),
                  ],
        )}
      </section>
      <details className="sl-card" open={kind === "glass"}>
        <summary>Resonant ribbon & sweep · live</summary>
        <div className="sl-button-row">
          <label className="sl-check">
            <input
              type="checkbox"
              checked={p.modulation === 1}
              onChange={(e) => change("modulation", e.target.checked ? 1 : 0)}
            />
            Animate bands
          </label>
          <label>
            Tuning
            <select
              value={p.filterFollow}
              onChange={(e) => change("filterFollow", e.target.value)}
            >
              <option value="chord">Fixed reference chord</option>
              <option value="manual">Manual resonator anchor</option>
            </select>
          </label>
          <label>
            Direction
            <select
              value={p.sweepDirection}
              onChange={(e) => change("sweepDirection", Number(e.target.value))}
            >
              <option value={1}>Forward</option>
              <option value={-1}>Reverse</option>
            </select>
          </label>
        </div>
        {sliders([
          "dry",
          "ribbon",
          "resonance",
          "sweepOffset",
          "sweepDepth",
          "motion",
          "bandSpread",
          "phaseSpread",
          ...(p.filterFollow === "manual" ? ["filterRoot" as const] : []),
        ])}
      </details>
      <details className="sl-card">
        <summary>Grains, reversal & space · live</summary>
        <label>
          Grain routing
          <select
            value={p.grainRoute}
            onChange={(e) => change("grainRoute", e.target.value)}
          >
            <option value="parallel">Alongside ribbon</option>
            <option value="before">Through ribbon</option>
          </select>
        </label>
        {sliders([
          "grains",
          "grainDensity",
          "grainLookback",
          "grainSpread",
          "reverse",
          "grain",
          "shift",
          "echo",
          "delay",
          "tail",
          "room",
          "width",
          "brightness",
        ])}
        <button onClick={() => player.current?.engine.clearEffects()}>
          Clear effect memory
        </button>
      </details>
      <details className="sl-card">
        <summary>Distortion & fragments · live</summary>
        {sliders([
          "saturate",
          "textureDrive",
          "fold",
          "crossover",
          "crossGap",
          "inside",
          "shred",
          "shredRate",
          "shredLength",
          "shredScatter",
          "shredReverse",
        ])}
      </details>
      <div className="sl-button-row">
        <button onClick={() => onUseSound(setup)}>
          Copy this sound to Journey
        </button>
        <button
          onClick={() => {
            player.current?.stop();
            setBank((b) => ({ ...b, [kind]: soloDefault(kind) }));
            setStatus(
              "This sound’s controls restored. Other sound drafts are kept.",
            );
          }}
        >
          Restore this sound’s controls
        </button>
        <button
          disabled={!running}
          onClick={() => {
            if (recording) {
              player.current?.engine.stopRecording();
              setRecording(false);
            } else {
              const ok = player.current?.engine.startRecording((blob) => {
                const url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = `chroma-solo-${kind}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 3000);
              });
              setRecording(!!ok);
            }
          }}
        >
          {recording ? "Finish recording" : "Record solo output"}
        </button>
      </div>
      <p>
        Save as Complete setup below to include this sound’s gesture and fixed
        reference. Drafts for all five sounds are kept separately in this
        browser; exported presets and account saves can travel with you.
      </p>
      <PresetLibrary setup={setup} onLoad={load} signIn={signIn} />
    </section>
  );
}
