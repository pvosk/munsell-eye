import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  applyPreset,
  exportLibrary,
  normalizePreset,
  readLibrary,
  sanitizeSetup,
  validPreset,
  type Preset,
  type Scope,
  type Setup,
} from "./presets";
const STORE = "chroma-sound-library-v2";
export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function PresetLibrary({
  setup,
  onLoad,
  signIn,
}: {
  setup: Setup;
  onLoad: (s: Setup) => void;
  signIn: ReactNode;
}) {
  const [items, setItems] = useState<Preset[]>([]),
    [name, setName] = useState(""),
    [notes, setNotes] = useState(""),
    [scope, setScope] = useState<Scope>("all"),
    [message, setMessage] = useState(
      "Export a JSON backup to use in another browser or share in this chat.",
    ),
    [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    itemsRef = useRef<Preset[]>([]);
  const persist = (next: Preset[]) => {
    itemsRef.current = next;
    setItems(next);
    try {
      localStorage.setItem(STORE, exportLibrary(next));
      return true;
    } catch {
      setMessage(
        "Browser storage is unavailable. Export a JSON backup before leaving.",
      );
      return false;
    }
  };
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORE);
        let loaded: Preset[] = [];
        if (raw) loaded = readLibrary(JSON.parse(raw));
        else {
          const legacy = JSON.parse(
            localStorage.getItem("chroma-glider-sound-lab-v1") ?? "[]",
          );
          if (Array.isArray(legacy))
            loaded = legacy
              .slice(0, 100)
              .filter((x) => x?.parameters && typeof x.name === "string")
              .map((x) => ({
                id: crypto.randomUUID(),
                name: x.name.slice(0, 80),
                notes: "Migrated legacy sound and harmony.",
                scope: "all",
                updatedAt: new Date().toISOString(),
                setup: sanitizeSetup({ parameters: x.parameters }),
              }));
        }
        itemsRef.current = loaded;
        setItems(loaded);
      } catch {
        setMessage(
          "Could not read the browser library. You can import a JSON backup.",
        );
      }
    });
  }, []);
  const sync = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/sound-presets", { cache: "no-store" }),
        data = (await response.json()) as {
          error?: string;
          presets?: unknown[];
        };
      if (!response.ok)
        throw new Error(data.error ?? "Account library unavailable.");
      if (!Array.isArray(data.presets) || !data.presets.every(validPreset))
        throw new Error("Unexpected cloud library response.");
      const merged = new Map(itemsRef.current.map((x) => [x.id, x]));
      for (const v of data.presets) {
        const p = normalizePreset(v),
          local = merged.get(p.id);
        if (!local || p.updatedAt > local.updatedAt) merged.set(p.id, p);
      }
      const kept = persist([...merged.values()].slice(-100));
      if (kept)
        setMessage(
          `Loaded ${data.presets.length} account presets. Local drafts are retained; use Upload drafts to save them to this account.`,
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync unavailable.");
    } finally {
      setBusy(false);
    }
  };
  const upload = async (list: Preset[]) => {
    let count = 0;
    for (const p of list) {
      const response = await fetch("/api/sound-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          presets?: unknown[];
        };
        throw new Error(
          `${count ? `${count} uploaded. ` : ""}${data.error ?? "Cloud save failed."}`,
        );
      }
      count++;
    }
    return count;
  };
  const make = (): Preset => ({
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled discovery",
    notes,
    scope,
    updatedAt: new Date().toISOString(),
    setup: sanitizeSetup(setup),
  });
  const save = async () => {
    if (itemsRef.current.length >= 100) {
      setMessage(
        "Library full. Export a backup and remove an older local preset.",
      );
      return;
    }
    const p = make();
    const local = persist([...itemsRef.current, p]);
    setBusy(true);
    try {
      await upload([p]);
      setMessage(
        `Saved “${p.name}” to your account${local ? " and this browser" : ""}.`,
      );
    } catch (e) {
      setMessage(
        `${local ? "Local draft saved. " : ""}${e instanceof Error ? e.message : "Cloud save unavailable."}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="sl-library" aria-label="Preset library">
      <div>
        <h2>Keep a discovery</h2>
        <p>
          Complete setups or individual sections. JSON files include harmonies,
          sound controls, mappings, trajectory, seed, and your notes—not an
          audio recording.
        </p>
      </div>
      <div className="sl-grid-3">
        <label>
          Preset name
          <input
            maxLength={80}
            value={name}
            placeholder="Name this discovery"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Save / recall scope
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="all">Complete setup</option>
            <option value="journey">Journey + music only</option>
            <option value="sound">Sound only</option>
            <option value="mapping">Mapping only</option>
          </select>
        </label>
        <label>
          Listening notes
          <input
            maxLength={2000}
            value={notes}
            placeholder="What worked? What should change?"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <div className="sl-button-row">
        <button className="sl-primary" disabled={busy} onClick={save}>
          Save preset
        </button>
        <button disabled={busy} onClick={sync}>
          Load account library
        </button>
        {signIn}
        <button
          disabled={busy || !items.length}
          onClick={async () => {
            setBusy(true);
            try {
              const n = await upload(itemsRef.current);
              setMessage(`${n} presets uploaded to the signed-in account.`);
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : "Upload unavailable.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Upload local drafts
        </button>
        <button
          onClick={() =>
            downloadText(exportLibrary([make()]), "chroma-discovery.json")
          }
        >
          Export current
        </button>
        <button
          disabled={!items.length}
          onClick={() =>
            downloadText(exportLibrary(items), "chroma-library.json")
          }
        >
          Export library
        </button>
        <button onClick={() => file.current?.click()}>Import JSON</button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            if (f.size > 2000000)
              throw new Error("Library file is too large (maximum 2 MB).");
            const imported = readLibrary(JSON.parse(await f.text())),
              merged = new Map(itemsRef.current.map((x) => [x.id, x]));
            for (const p of imported) merged.set(p.id, p);
            if (merged.size > 100)
              throw new Error(
                "Import would exceed 100 presets. Export/remove older presets first.",
              );
            if (persist([...merged.values()]))
              setMessage(
                `${imported.length} presets imported locally. Load one below; upload drafts to save them to your account.`,
              );
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Import failed.");
          }
        }}
      />
      <p className="sl-notice" role="status">
        {busy ? "Working… " : ""}
        {message}
      </p>
      {!!items.length && (
        <div className="sl-library-items">
          {items.map((p) => (
            <div key={p.id}>
              <button
                onClick={() => {
                  onLoad(applyPreset(setup, p));
                  setMessage(
                    `Loaded ${p.scope === "all" ? "complete setup" : p.scope + " only"}: ${p.name}. Audio stopped; settings retained.`,
                  );
                }}
              >
                <strong>{p.name}</strong>
                <small>
                  {p.scope} ·{" "}
                  {p.notes || new Date(p.updatedAt).toLocaleDateString()}
                </small>
              </button>
              <button
                onClick={() =>
                  downloadText(exportLibrary([p]), "chroma-preset.json")
                }
              >
                Export
              </button>
              <button
                aria-label={`Remove local copy of ${p.name}`}
                onClick={() => {
                  persist(itemsRef.current.filter((x) => x.id !== p.id));
                  setMessage(
                    "Local copy removed. Any account copy remains available.",
                  );
                }}
              >
                Remove local
              </button>
              <button
                disabled={busy}
                aria-label={`Delete account copy of ${p.name}`}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await fetch(
                      `/api/sound-presets?id=${encodeURIComponent(p.id)}`,
                      { method: "DELETE" },
                    );
                    if (!r.ok)
                      throw new Error(
                        ((await r.json()) as { error?: string }).error ??
                          "Could not delete preset.",
                      );
                    setMessage(
                      "Account copy deleted. Local copy retained; remove it separately if desired.",
                    );
                  } catch (e) {
                    setMessage(
                      e instanceof Error ? e.message : "Delete failed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete account copy
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
