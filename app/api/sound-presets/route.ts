import { labDB } from "../../lab-db";
import { validPreset, normalizePreset } from "../../sound-lab/presets";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner)
    return json(
      {
        error:
          "Sign in to sync. Your local drafts and exports remain available.",
      },
      401,
    );
  try {
    const rows = await labDB()
      .prepare(
        "SELECT payload FROM sound_presets WHERE owner = ? ORDER BY updated_at DESC LIMIT 100",
      )
      .bind(owner)
      .all<{ payload: string }>();
    return json({ presets: rows.results.map((r) => JSON.parse(r.payload)) });
  } catch {
    return json(
      { error: "Cloud library unavailable. Keep a JSON backup and retry." },
      503,
    );
  }
}
export async function POST(request: Request) {
  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner)
    return json({ error: "Sign in to sync. Saved as a local draft." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Origin not allowed" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "JSON required" }, 415);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Missing preset" }, 400);
  let bytes = 0,
    raw = "";
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 96000) {
      await reader.cancel();
      return json({ error: "Preset too large" }, 413);
    }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!validPreset(value)) return json({ error: "Invalid sound preset" }, 400);
  const preset = normalizePreset(value);
  try {
    const existing = await labDB()
      .prepare(
        "SELECT preset_id FROM sound_presets WHERE owner = ? AND preset_id = ?",
      )
      .bind(owner, preset.id)
      .first();
    if (!existing) {
      const count = await labDB()
        .prepare("SELECT COUNT(*) AS n FROM sound_presets WHERE owner = ?")
        .bind(owner)
        .first<{ n: number }>();
      if ((count?.n ?? 0) >= 100)
        return json(
          {
            error:
              "Cloud library is full (100 presets). Export a backup before removing older presets.",
          },
          409,
        );
    }
    await labDB()
      .prepare(
        "INSERT INTO sound_presets (owner, preset_id, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner, preset_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
      )
      .bind(owner, preset.id, JSON.stringify(preset), new Date().toISOString())
      .run();
    return json({ saved: true });
  } catch {
    return json(
      { error: "Cloud save unavailable. Your local draft is kept." },
      503,
    );
  }
}
export async function DELETE(request: Request) {
  const owner = request.headers.get("oai-authenticated-user-id");
  if (!owner) return json({ error: "Sign in to remove a cloud preset." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Origin not allowed" }, 403);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    return json({ error: "Invalid preset ID" }, 400);
  try {
    await labDB()
      .prepare("DELETE FROM sound_presets WHERE owner = ? AND preset_id = ?")
      .bind(owner, id)
      .run();
    return json({ deleted: true });
  } catch {
    return json({ error: "Could not remove cloud preset. Retry." }, 503);
  }
}
