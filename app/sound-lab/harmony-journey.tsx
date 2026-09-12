import {
  harmonicFrame,
  noteName,
  PROGRESSIONS,
  sanitizeMusic,
  type MusicSettings,
} from "./music";
import type { Journey } from "./journey";

export function HarmonyJourney({
  music,
  onChange,
  journey,
  step,
  resolved,
  phase,
  motifPlaying,
  enabled,
  onNext,
  onResolve,
  onExplore,
}: {
  music: MusicSettings;
  onChange: (m: MusicSettings) => void;
  journey: Journey;
  step: number;
  resolved: boolean;
  phase: string;
  motifPlaying: boolean;
  enabled: boolean;
  onNext: () => void;
  onResolve: () => void;
  onExplore: () => void;
}) {
  const frames = [
    harmonicFrame(music, step),
    harmonicFrame(music, step + 1),
    harmonicFrame(music, music.destinationStep),
  ];
  const progression = PROGRESSIONS.find((p) => p.id === music.progression)!;
  const count = progression.fifths ? 12 : progression.degrees.length;
  const moving = ["flight", "arrival"].includes(phase);
  const automatic = phase === "arrival" || (moving && journey.advance !== "manual");
  const shotClock = {
    manual: "Manual harmony",
    shot: "One harmony step per launched shot",
    progress: "Shot progress advances harmony",
    hue: "Accumulated hue travel advances harmony",
  }[journey.advance];
  return (
    <section
      className="sl-card sl-harmony-journey"
      aria-label="Harmony and resolution"
    >
      <div className="sl-section-head">
        <div>
          <h2>Harmony & resolution</h2>
          <p aria-live="polite">
            {phase === "arrival"
              ? resolved
                ? "Resolving toward destination"
                : "Near miss · leaving open"
              : resolved
                ? "Resolved · destination reached"
                : `Progression position ${(step % count) + 1} of ${count}`}{" "}
            ·{" "}
            {motifPlaying
              ? music.motifAdvance === "auto"
                ? "Motif clock · advances after phrase repeats"
                : "Motif clock · manual harmony"
              : moving
                ? shotClock
                : "Ready · choose motif or shot playback"}
          </p>
        </div>
        <div className="sl-button-row">
          <button
            disabled={
              !enabled || automatic || count === 1 || music.source === "custom"
            }
            onClick={onNext}
          >
            Next harmony
          </button>
          <button
            className="sl-primary"
            disabled={!enabled || resolved}
            onClick={onResolve}
          >
            Resolve now
          </button>
          <button disabled={!enabled || !resolved || phase === "arrival"} onClick={onExplore}>
            Leave resolution
          </button>
        </div>
      </div>
      <div className="sl-grid-3">
        {frames.map((frame, i) => (
          <div key={i} className="sl-harmony-state">
            <small>{["CURRENT", "NEXT", "DESTINATION"][i]}</small>
            <strong>
              {music.source === "custom" ? "Custom cents tuning" : frame.label}
            </strong>
            <span>
              {music.source === "custom"
                ? "Custom tuning stays fixed; resolution releases tension."
                : frame.tones.map(noteName).join(" · ")}
            </span>
          </div>
        ))}
      </div>
      <div className="sl-grid-2">
        <label>
          Resolve to
          <select
            disabled={music.source === "custom"}
            value={music.destinationStep % count}
            onChange={(e) =>
              onChange(
                sanitizeMusic({
                  ...music,
                  destinationStep: Number(e.target.value),
                }),
              )
            }
          >
            {Array.from({ length: count }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "Starting harmony" : `Position ${i + 1}`} ·{" "}
                {harmonicFrame(music, i).label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Motif progression clock
          <select
            value={music.motifAdvance}
            onChange={(e) =>
              onChange(
                sanitizeMusic({ ...music, motifAdvance: e.target.value }),
              )
            }
          >
            <option value="auto">Advance after phrase repeats</option>
            <option value="manual">Manual · use Next harmony</option>
          </select>
        </label>
      </div>
      <p>
        Resolve now brings a moving shot into a successful arrival; during motif
        audition it plays the destination and holds it. Leave resolution allows
        development again. Capture uses this same destination automatically; a
        near miss stays open.
      </p>
      <p>
        Shot clock: <strong>{shotClock}</strong>. Selecting a paint alone does
        not advance harmony.{" "}
        {automatic
          ? "Next harmony is unavailable while the shot clock owns progression. "
          : ""}
        Existing echo tails retain the notes already played.
      </p>
    </section>
  );
}
