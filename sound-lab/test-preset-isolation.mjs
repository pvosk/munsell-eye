// Runs the actual route handlers with SQLite-backed D1 test bindings.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";
const db = new DatabaseSync(":memory:");
db.exec(
  readFileSync(
    new URL("../drizzle/0001_sound_presets.sql", import.meta.url),
    "utf8",
  ),
);
globalThis.__soundTestDB = {
  prepare(sql) {
    const q = db.prepare(sql);
    return {
      bind(...values) {
        return {
          async all() {
            return { results: q.all(...values) };
          },
          async first() {
            return q.get(...values);
          },
          async run() {
            return q.run(...values);
          },
        };
      },
    };
  },
};
const dir = mkdtempSync(join(tmpdir(), "chroma-isolation-"));
try {
  const result = await build({
    entryPoints: [
      fileURLToPath(
        new URL("../app/api/sound-presets/route.ts", import.meta.url),
      ),
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "test-db",
        setup(b) {
          b.onResolve({ filter: /lab-db$/ }, () => ({
            path: "db",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents: "export const labDB=()=>globalThis.__soundTestDB;",
          }));
        },
      },
    ],
  });
  const file = join(dir, "route.mjs");
  writeFileSync(file, result.outputFiles[0].contents);
  const route = await import(pathToFileURL(file).href);
  const preset = {
    id: "isolation",
    name: "Test",
    notes: "",
    scope: "all",
    updatedAt: new Date().toISOString(),
    setup: { parameters: {} },
  };
  const request = (owner, method = "GET", body) =>
    new Request("https://sound.test/api/sound-presets?id=isolation", {
      method,
      headers: {
        ...(owner ? { "oai-authenticated-user-id": owner } : {}),
        Origin: "https://sound.test",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await route.POST(request("a", "POST", preset))).status, 200);
  assert.equal((await route.GET(request("b"))).status, 200);
  assert.deepEqual((await (await route.GET(request("b"))).json()).presets, []);
  await route.DELETE(request("b", "DELETE"));
  assert.equal(
    (await (await route.GET(request("a"))).json()).presets.length,
    1,
  );
  assert.equal((await route.POST(request(null, "POST", preset))).status, 401);
  await route.DELETE(request("a", "DELETE"));
  assert.deepEqual((await (await route.GET(request("a"))).json()).presets, []);
  console.log(
    "Passed actual route owner isolation and owner-scoped deletion with generated SQLite schema.",
  );
} finally {
  db.close();
  delete globalThis.__soundTestDB;
  rmSync(dir, { recursive: true, force: true });
}
