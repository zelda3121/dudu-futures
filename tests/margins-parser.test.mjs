import test from "node:test";
import assert from "node:assert/strict";
import { parseTaifexMarginHtml } from "../netlify/functions/margins.mjs";

const OFFICIAL_ROWS = {
  tx: ["臺股期貨", "519,000", "538,000", "701,000"],
  mtx: ["小型臺指", "129,750", "134,500", "175,250"],
  tmf: ["微型臺指期貨", "25,950", "26,900", "35,050"]
};

function officialFixture({ omit, override = {} } = {}) {
  const rows = Object.entries(OFFICIAL_ROWS)
    .filter(([key]) => key !== omit)
    .map(([key, values]) => {
      const [name, clearing, maintenance, initial] = override[key] ?? values;
      return `
        <tr>
          <td class="text-left"><a href="/cht/5/contractName">${name}</a></td>
          <td class="text-right">${clearing}</td>
          <td class="text-right"><span>${maintenance}</span></td>
          <td class="text-right">${initial}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
    <html lang="zh-Hant">
      <body>
        <div class="date">更新日期：2026/08/12</div>
        <table class="table_f">
          <thead>
            <tr>
              <th>商品別</th>
              <th>結算保證金</th>
              <th>維持保證金</th>
              <th>原始保證金</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
}

test("TAIFEX 官方表格形狀可解析 TX/MTX/TMF 保證金與更新日期", () => {
  assert.deepEqual(parseTaifexMarginHtml(officialFixture()), {
    contracts: {
      tx: { initialMargin: 701000, maintenanceMargin: 538000 },
      mtx: { initialMargin: 175250, maintenanceMargin: 134500 },
      tmf: { initialMargin: 35050, maintenanceMargin: 26900 }
    },
    updatedAt: "2026-08-12"
  });
});

test("TAIFEX 表格缺少任一必要商品列時拒絕整份資料", async t => {
  for (const key of Object.keys(OFFICIAL_ROWS)) {
    await t.test(`缺少 ${key.toUpperCase()}`, () => {
      assert.equal(parseTaifexMarginHtml(officialFixture({ omit: key })), null);
    });
  }
});

test("任一商品 initial margin 低於 maintenance margin 時拒絕整份資料", async t => {
  for (const key of Object.keys(OFFICIAL_ROWS)) {
    await t.test(`${key.toUpperCase()} 數值倒置`, () => {
      const [name, clearing, maintenance] = OFFICIAL_ROWS[key];
      const anomalousRow = [name, clearing, maintenance, "1"];
      assert.equal(
        parseTaifexMarginHtml(officialFixture({ override: { [key]: anomalousRow } })),
        null
      );
    });
  }
});
