import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("歷史跌點表為 10 筆且依跌點遞減", async () => {
  const html = await readFile("index.html", "utf8");
  const source = html.match(/const HIST_DROPS = (\[[\s\S]*?\n  \]);/)?.[1];
  assert.ok(source, "找不到 HIST_DROPS");
  const rows = new Function(`return ${source}`)();
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map(row => row.points), [...rows.map(row => row.points)].sort((a, b) => b - a));
  assert.deepEqual(rows[0], {
    date: "2026-07-17",
    event: "全球晶片股賣壓・權值股估值修正",
    points: 2953.71,
    pct: 6.47,
    close: 42671.27
  });
  assert.equal(rows.at(-1).points, 1478.90);
});
