import {
  ARPS,
  KEYS,
  MODES,
  MUSIC_PRESETS,
  PROGRESSIONS,
  STACKS,
  harmonicFrame,
  noteName,
  sanitizeMusic,
  type MusicSettings,
} from "./music";

export function MusicPanel({
  value,
  onChange,
  enabled,
  playing,
  step,
  onPlay,
  onStop,
  onNext,
}: {
  value: MusicSettings;
  onChange: (m: MusicSettings) => void;
  enabled: boolean;
  playing: boolean;
  step: number;
  onPlay: () => void;
  onStop: () => void;
  onNext: () => void;
}) {
  const set = (key: keyof MusicSettings, v: unknown) =>
    onChange(sanitizeMusic({ ...value, [key]: v, source: "system" }));
  const frame = harmonicFrame(value, step);
  const select = (
    label: string,
    key: keyof MusicSettings,
    options: readonly (readonly [string, string])[],
  ) => (
    <label>
      {label}
      <select
        value={String(value[key])}
        onChange={(e) => set(key, e.target.value)}
      >
        {options.map(([id, name]) => (
          <option value={id} key={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  const range = (
    label: string,
    key: keyof MusicSettings,
    min: number,
    max: number,
    increment: number,
    suffix = "",
  ) => (
    <label className="sl-music-range">
      <span>
        {label}
        <output>
          {String(value[key])}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={increment}
        value={Number(value[key])}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <section className="sl-music" aria-label="Musical systems">
      <div className="sl-music-title">
        <div>
          <h2>Shape the music</h2>
          <p>A harmonic world, a motif, and room between the notes.</p>
        </div>
        <div className="sl-music-transport">
          <button
            disabled={!enabled}
            className="sl-primary"
            onClick={playing ? onStop : onPlay}
          >
            {playing ? "Stop motif" : "Play motif"}
          </button>
          <button
            disabled={!enabled || value.progression === "still"}
            onClick={onNext}
          >
            Next harmony
          </button>
        </div>
      </div>
      <div className="sl-music-presets">
        {MUSIC_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => onChange(sanitizeMusic(p.settings))}
          >
            <strong>{p.name}</strong>
            <small>{p.detail}</small>
          </button>
        ))}
      </div>
      {value.source === "custom" && (
        <p className="sl-music-notice">
          Custom cents are active. Choose a musical system or change a control
          here to return to named scales.
        </p>
      )}
      <div className="sl-music-columns">
        <div>
          <h3>Harmonic world</h3>
          <div className="sl-music-pair">
            <label>
              Key
              <select
                value={value.tonic}
                onChange={(e) => set("tonic", Number(e.target.value))}
              >
                {KEYS.map((k, i) => (
                  <option value={i} key={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Register
              <select
                value={value.octave}
                onChange={(e) => set("octave", Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((o) => (
                  <option value={o} key={o}>
                    {o} ·{" "}
                    {o === 1
                      ? "deep"
                      : o === 2
                        ? "low"
                        : o === 3
                          ? "middle"
                          : "high"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {select(
            "Mode / scale",
            "mode",
            MODES.map((m) => [m.id, m.name]),
          )}
          <p className="sl-music-help">{frame.mode.feel}</p>
          {select(
            "Interval stack",
            "stack",
            STACKS.map((s) => [s.id, s.name]),
          )}
          {select("Voicing", "voicing", [
            ["close", "Close together"],
            ["spread", "Spread across octaves"],
            ["smooth", "Smooth changes / voice leading"],
          ])}
          <p className="sl-music-help">
            Stacks use steps of the selected scale. Fourths, fifths and chord
            qualities change with that scale.
          </p>
        </div>
        <div>
          <h3>Arpeggios & hanging notes</h3>
          {select("Arpeggio pattern", "arp", ARPS)}
          {select("Available notes", "pool", [
            ["chord", "Current chord tones"],
            ["scale", "Whole selected scale"],
          ])}
          {range("Tempo", "bpm", 24, 140, 1, " BPM")}
          {range("Note spacing", "spacing", 0.25, 2, 0.25, " beats")}
          {range("Phrase breathing room", "rest", 0, 12, 0.5, " beats")}
          {range("Octave reach", "octaves", 1, 3, 1)}
          <p className="sl-music-help">
            Play motif is a separate repeating audition. The shot can use this
            tempo, spacing and rests, or its independent density control. Both
            use the selected pattern and note pool.
          </p>
        </div>
        <div>
          <h3>Progression & variation</h3>
          {select(
            "Harmonic movement",
            "progression",
            PROGRESSIONS.map((p) => [p.id, p.name]),
          )}
          {range("Phrases per harmony", "repeats", 1, 16, 1)}
          {range("Gentle variation", "variation", 0, 0.8, 0.01)}
          <label>
            Variation seed
            <input
              type="number"
              min={1}
              max={999999}
              value={value.seed}
              onChange={(e) => set("seed", Number(e.target.value))}
            />
          </label>
          <label className="sl-toggle">
            <input
              type="checkbox"
              checked={value.pedal}
              onChange={(e) => set("pedal", e.target.checked)}
            />
            Keep a home pedal note
          </label>
          <label className="sl-toggle">
            <input
              type="checkbox"
              checked={value.sustain}
              onChange={(e) => set("sustain", e.target.checked)}
            />
            Sustained harmony
          </label>
          <p className="sl-music-help">
            Sustained harmony makes a continuous tone. A fixed pedal can create
            tension as keys change; turn it off for clean circle movement.
            Resolve returns to the starting harmony and holds progression there.
          </p>
        </div>
      </div>
      <div className="sl-circle" aria-label="Circle of fifths">
        <span>Circle of fifths</span>
        {Array.from({ length: 12 }, (_, i) => (i * 7) % 12).map((k) => (
          <button
            key={k}
            aria-pressed={frame.tonic === k}
            onClick={() => set("tonic", k)}
          >
            {KEYS[k]}
          </button>
        ))}
      </div>
      <div className="sl-music-now">
        <strong>
          {value.source === "custom" ? "Custom tuning" : frame.label}
        </strong>
        <span>{frame.tones.map(noteName).join(" · ")}</span>
        <small>Scale: {frame.scale.map(noteName).join(" · ")}</small>
      </div>
    </section>
  );
}
