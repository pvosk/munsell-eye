import {
  JOURNEY_STUDIES,
  STUDY_FAMILIES,
  type JourneyStudy,
} from "./journey-studies";
import { exportLibrary, type Scope } from "./presets";
import { downloadText } from "./preset-library";
import { KEYS, MODES, STACKS, PROGRESSIONS } from "./music";

export const FEATURED_STUDIES = [
  "sunlit-current",
  "held-light",
  "glass-thread",
  "wide-horizon",
  "breath-rising",
  "remembered-steps",
].map((id) => JOURNEY_STUDIES.find((s) => s.id === `journey-${id}`)!);

export function StudyBrowser({
  selected,
  onSelect,
  onLoad,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onLoad: (study: JourneyStudy, scope: Scope) => void;
}) {
  const study =
    JOURNEY_STUDIES.find((s) => s.id === selected) ?? JOURNEY_STUDIES[0];
  const family = STUDY_FAMILIES.find((f) => f.id === study.familyId)!;
  const { music } = study.setup.parameters;
  const { journey } = study.setup;
  return (
    <details className="sl-card sl-study-browser">
      <summary>
        Preset workshop · 10 families, 30 journeys · mix & match
      </summary>
      <p>
        Start with a complete journey, then borrow individual parts. Loading a
        part updates the controls; press Play shot for a fresh comparison or
        leave Loop on.
      </p>
      <div className="sl-button-row" aria-label="Featured complete journeys">
        {FEATURED_STUDIES.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              onSelect(s.id);
              onLoad(s, "all");
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
      <label>
        Explore a musical family
        <select
          value={family.id}
          onChange={(e) =>
            onSelect(
              STUDY_FAMILIES.find((f) => f.id === e.target.value)!.presets[0]
                .id,
            )
          }
        >
          {STUDY_FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <p>{family.description}</p>
      <div className="sl-models">
        {family.presets.map((s) => (
          <button
            key={s.id}
            aria-pressed={s.id === study.id}
            onClick={() => onSelect(s.id)}
          >
            <strong>{s.name}</strong>
            <small>{s.ride}</small>
          </button>
        ))}
      </div>
      <p>
        <strong>{study.name}</strong> · {study.listen}
      </p>
      <p>
        {music.source === "custom"
          ? "Custom cents"
          : `${KEYS[music.tonic]} · ${MODES.find((m) => m.id === music.mode)?.name} · ${STACKS.find((s) => s.id === music.stack)?.name}`}
        {" · "}
        {PROGRESSIONS.find((p) => p.id === music.progression)?.name}
        {" · "}
        {journey.advance === "manual"
          ? "manual harmony"
          : journey.advance === "shot"
            ? "harmony changes each shot"
            : `${journey.changes} changes driven by ${journey.advance === "hue" ? "hue travel" : "shot progress"}`}
        {" · "}
        {journey.duration}s flight ·{" "}
        {journey.outcome === "capture" ? "made shot" : "miss"}
      </p>
      <p className="sl-study-hint">Try: {study.tweak}</p>
      <div className="sl-button-row">
        <button className="sl-primary" onClick={() => onLoad(study, "all")}>
          Load complete journey
        </button>
        <button onClick={() => onLoad(study, "harmony")}>Use music</button>
        <button onClick={() => onLoad(study, "sound")}>Use sound</button>
        <button onClick={() => onLoad(study, "mapping")}>Use mappings</button>
        <button onClick={() => onLoad(study, "journey")}>
          Use journey + music
        </button>
      </div>
      <small>
        Music includes the melody, tuning, rhythm and progression trigger; your
        path and landing outcome stay in place. Sound keeps your music and
        existing glide settings. Mappings replace the connections; cloud and
        vocal controls need those sound models, and density needs density
        timing. Journey + music also brings the path and timing.
      </small>
      <div className="sl-button-row">
        <button
          onClick={() =>
            downloadText(
              exportLibrary(JOURNEY_STUDIES),
              "chroma-30-journeys.json",
            )
          }
        >
          Download all 30
        </button>
        <button
          onClick={() =>
            downloadText(
              exportLibrary(family.presets),
              `chroma-${family.id}.json`,
            )
          }
        >
          Download this family
        </button>
      </div>
      <small>
        Browsing does not load controls. These originals are always available
        here in every browser. Save your refinements below; use Complete setup
        to keep the combination, or a part scope to save one ingredient.
      </small>
    </details>
  );
}
