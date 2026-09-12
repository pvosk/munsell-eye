import assert from "node:assert/strict";
import { STARTERS } from "../app/sound-lab/presets.ts";
const origin = process.env.SOUND_TEST_ORIGIN ?? "http://localhost:3018";
const id = `test-sound-${Date.now()}`,
  preset = { ...STARTERS[0], id, name: "Local test preset" };
const call = (owner, method = "GET", value, extra = {}) =>
  fetch(
    `${origin}/api/sound-presets${method === "DELETE" ? `?id=${id}` : ""}`,
    {
      method,
      headers: {
        ...(owner === "sound-test-a" ? { Cookie: "__sites_local_auth=1" } : {}),
        "Content-Type": "application/json",
        Origin: origin,
        ...extra,
      },
      ...(value ? { body: JSON.stringify(value) } : {}),
    },
  );
try {
  let r = await call("sound-test-a", "POST", preset);
  assert.equal(r.status, 200, await r.text());
  r = await call("sound-test-a");
  let data = await r.json();
  assert(data.presets.some((x) => x.id === id));
  r = await call("sound-test-b");
  assert.equal(r.status, 401, "Anonymous client must not read account presets");
  r = await call("sound-test-b", "DELETE");
  assert.equal(r.status, 401);
  r = await call("sound-test-a");
  data = await r.json();
  assert(
    data.presets.some((x) => x.id === id),
    "Other owner deleted preset",
  );
  r = await call("sound-test-a", "POST", {
    ...preset,
    name: "Updated",
    scope: "harmony",
  });
  assert.equal(r.status, 200);
  r = await call("sound-test-a");
  data = await r.json();
  assert.equal(data.presets.filter((x) => x.id === id).length, 1);
  assert.equal(data.presets.find((x) => x.id === id).name, "Updated");
  assert.equal(data.presets.find((x) => x.id === id).scope, "harmony");
  r = await call("sound-test-a", "POST", preset, {
    Origin: "https://elsewhere.invalid",
  });
  assert.equal(r.status, 403);
  r = await call("sound-test-a", "POST", { ...preset, scope: "invalid" });
  assert.equal(r.status, 400);
  console.log(
    "Passed preset save/load/update, anonymous rejection, signed-in delete, invalid input and origin rejection against local D1.",
  );
} finally {
  await call("sound-test-a", "DELETE");
}
