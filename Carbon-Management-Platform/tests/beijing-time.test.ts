import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Beijing time is identical across host time zones and rolls over at midnight", () => {
  const script = `
    import { formatBeijingTime } from "./src/shared/beijing-time.ts";
    const timestamp = "2026-10-20T16:00:11.000Z";
    console.log(JSON.stringify([
      formatBeijingTime(timestamp),
      formatBeijingTime(timestamp, "minute"),
      formatBeijingTime(timestamp, "date"),
    ]));
  `;

  for (const timeZone of ["America/Puerto_Rico", "UTC", "Asia/Shanghai"]) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      { encoding: "utf8", env: { ...process.env, TZ: timeZone } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout),
      ["2026/10/21 00:00:11", "2026/10/21 00:00", "2026/10/21"],
      timeZone,
    );
  }
});
