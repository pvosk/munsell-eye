import {
  harmonicFrame,
  melodyPitchSet,
  noteName,
  scaleDegree,
  sanitizeMusic,
  type MusicSettings,
} from "./music";

export function MelodyGrid({
  value,
  onChange,
  step,
  customScale,
  onAudition,
  enabled,
  timing,
  onUseTiming,
}: {
  value: MusicSettings;
  onChange: (m: MusicSettings) => void;
  step: number;
  customScale: number[];
  onAudition: () => void;
  enabled: boolean;
  timing: string;
  onUseTiming: () => void;
}) {
  const set = (patch: Partial<MusicSettings>) =>
    onChange(sanitizeMusic({ ...value, ...patch }));
  const frame = harmonicFrame(value, step);
  const scale = value.source === "custom" ? customScale : frame.scale;
  const { root, intervals } = melodyPitchSet(scale);
  const degreeName = (degree: number) =>
    noteName(
      root +
        scaleDegree(
          intervals,
          degree + (value.melodyFollow ? frame.degree : 0),
        ),
    );
  const put = (i: number, degree: number | null) =>
    set({
      melodySteps: value.melodySteps.map((n, j) => (j === i ? degree : n)),
    });
  return (
    <section className="sl-card" aria-label="Main melody editor">
      <div className="sl-section-head">
        <div>
          <h2>Main melody</h2>
          <p>
            Draw the phrase that the arpeggios grow from. Your grid stays saved
            when you switch back to procedural.
          </p>
        </div>
        <label>
          Phrase source
          <select
            value={value.melody}
            onChange={(e) =>
              set({ melody: e.target.value as MusicSettings["melody"] })
            }
          >
            <option value="procedural">Procedural motif</option>
            <option value="grid">Custom melody grid</option>
          </select>
        </label>
      </div>
      {value.melody === "grid" && (
        <>
          <div className="sl-grid-3">
            <label>
              Phrase length
              <select
                value={value.melodyLength}
                onChange={(e) => set({ melodyLength: Number(e.target.value) })}
              >
                <option value={8}>8 steps</option>
                <option value={16}>16 steps</option>
              </select>
            </label>
            <label>
              Arpeggio notes between main notes
              <select
                value={value.offspring}
                onChange={(e) => set({ offspring: Number(e.target.value) })}
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None · melody alone" : n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Melody movement
              <select
                value={String(value.melodyFollow)}
                onChange={(e) =>
                  set({ melodyFollow: e.target.value === "true" })
                }
              >
                <option value="false">Stay in the current key / scale</option>
                <option value="true">Follow progression degree too</option>
              </select>
            </label>
          </div>
          <p>
            Columns are time; rows are 15 steps of the selected scale. Click a
            note to place it, or click it again for a rest. Note names follow
            your tuning and current harmony. Main notes stay exact; variation
            affects only their arpeggios.
          </p>
          <div
            className="sl-melody-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable melody grid"
          >
            <div
              className="sl-melody-grid"
              style={{
                gridTemplateColumns: `minmax(90px, 1.6fr) repeat(${value.melodyLength}, minmax(34px, 1fr))`,
              }}
            >
              <span>Scale step</span>
              {Array.from({ length: value.melodyLength }, (_, i) => (
                <span className="sl-melody-heading" key={`h${i}`}>
                  {i + 1}
                </span>
              ))}
              {Array.from({ length: 15 }, (_, r) => 14 - r).map((degree) => (
                <MelodyRow
                  key={degree}
                  degree={degree}
                  name={degreeName(degree)}
                  steps={value.melodySteps.slice(0, value.melodyLength)}
                  put={put}
                />
              ))}
              <span>Rest</span>
              {value.melodySteps.slice(0, value.melodyLength).map((n, i) => (
                <button
                  type="button"
                  key={`rest${i}`}
                  className="sl-melody-cell"
                  aria-label={`Step ${i + 1}: rest`}
                  aria-pressed={n === null}
                  onClick={() => put(i, null)}
                >
                  —
                </button>
              ))}
            </div>
          </div>
          <div className="sl-button-row">
            <button disabled={timing === "motif"} onClick={onUseTiming}>
              {timing === "motif" ? "Grid timing active" : "Use grid timing"}
            </button>
            <button disabled={!enabled} onClick={onAudition}>
              Hear phrase once
            </button>
            <button
              onClick={() =>
                set({
                  melodySteps: value.melodySteps.map((n, i) =>
                    i < value.melodyLength ? null : n,
                  ),
                })
              }
            >
              Clear visible steps
            </button>
            <button
              onClick={() =>
                set({
                  melodySteps: [
                    ...value.melodySteps.slice(0, 8),
                    ...value.melodySteps.slice(0, 8),
                  ],
                  melodyLength: 16,
                })
              }
            >
              Copy first 8 → next 8
            </button>
          </div>
          <p>
            Use <strong>Motif tempo, spacing and rests</strong> for the drawn
            rhythm, or density timing to scatter the same sequence along the
            shot. Arpeggio type, stack, octave range and variation below shape
            the offspring. The sustained harmony remains the harmonic
            background; this grid governs the foreground phrase.
          </p>
        </>
      )}
    </section>
  );
}
function MelodyRow({
  degree,
  name,
  steps,
  put,
}: {
  degree: number;
  name: string;
  steps: (number | null)[];
  put: (i: number, d: number | null) => void;
}) {
  return (
    <>
      <span className="sl-melody-label">
        {degree + 1} · {name}
      </span>
      {steps.map((n, i) => (
        <button
          type="button"
          className="sl-melody-cell"
          key={i}
          aria-label={`Step ${i + 1}: ${name}, scale step ${degree + 1}`}
          aria-pressed={n === degree}
          onClick={() => put(i, n === degree ? null : degree)}
        >
          {n === degree ? "●" : ""}
        </button>
      ))}
    </>
  );
}
