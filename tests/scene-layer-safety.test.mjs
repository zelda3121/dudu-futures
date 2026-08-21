import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CULTIVATION_CSS = "styles/xianxia-v3.4.css";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rulesFor(source, selector) {
  const rulePattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "g");
  return [...source.matchAll(rulePattern)].map(match => match[1]);
}

function blockAfter(source, marker) {
  const markerStart = source.indexOf(marker);
  assert.notEqual(markerStart, -1, `找不到 ${marker}`);

  const bodyStart = source.indexOf("{", markerStart);
  assert.notEqual(bodyStart, -1, `${marker} 缺少區塊`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  assert.fail(`${marker} 缺少結尾大括號`);
}

test("C 版人物是頁內不可互動裝飾，且有硬性寬度上限", async () => {
  const css = await readFile(CULTIVATION_CSS, "utf8");
  const [cultivatorRule] = rulesFor(css, 'html[data-variant="c"] .c-cultivator');

  assert.ok(cultivatorRule, "應有 C 版人物規則");
  assert.match(cultivatorRule, /position:\s*absolute\s*;/);
  assert.doesNotMatch(cultivatorRule, /position:\s*fixed\s*;/);
  assert.match(cultivatorRule, /pointer-events:\s*none\s*;/);

  const hardMaxWidth = cultivatorRule.match(/max-width:\s*(\d+(?:\.\d+)?)px\s*;/);
  assert.ok(hardMaxWidth, "人物必須有 px 硬性 max-width，不能只依賴 viewport/clamp");
  assert.ok(Number(hardMaxWidth[1]) > 0);
});

test("人物 scene layer 永遠低於 dashboard 與風險表格 layer", async () => {
  const css = await readFile(CULTIVATION_CSS, "utf8");
  const sceneLayer = Number(css.match(/--x-layer-scene:\s*(-?\d+)\s*;/)?.[1]);
  const panelLayer = Number(css.match(/--x-layer-panel:\s*(-?\d+)\s*;/)?.[1]);

  assert.ok(Number.isFinite(sceneLayer), "應定義數值型 --x-layer-scene");
  assert.ok(Number.isFinite(panelLayer), "應定義數值型 --x-layer-panel");
  assert.ok(sceneLayer < panelLayer, "場景裝飾的 z-layer 必須低於面板/表格");

  const selectorsAndLayer = [
    ['html[data-variant="c"] .c-cultivator', "--x-layer-scene"],
    ['html[data-variant="c"] .c-dashboard', "--x-layer-panel"],
    ['html[data-variant="c"] .b-tablebar', "--x-layer-panel"],
    ['html[data-variant="c"] .twrap', "--x-layer-panel"]
  ];

  for (const [selector, layer] of selectorsAndLayer) {
    const rules = rulesFor(css, selector);
    assert.ok(
      rules.some(rule => new RegExp(`z-index:\\s*var\\(${escapeRegExp(layer)}\\)\\s*;`).test(rule)),
      `${selector} 應使用 ${layer}`
    );
  }
});

test("1250px 以下隱藏人物並讓 dashboard 回到單欄安全版面", async () => {
  const css = await readFile(CULTIVATION_CSS, "utf8");
  const narrowCss = blockAfter(css, "@media (max-width: 1250px)");
  const cultivatorRules = rulesFor(narrowCss, 'html[data-variant="c"] .c-cultivator');
  const dashboardRules = rulesFor(narrowCss, 'html[data-variant="c"] .c-dashboard');

  assert.ok(
    cultivatorRules.some(rule => /display:\s*none\s*;/.test(rule)),
    "<=1250px 時人物不可覆蓋面板或表格"
  );
  assert.ok(
    dashboardRules.some(rule => /grid-template-columns:\s*1fr\s*;/.test(rule)),
    "<=1250px 時 dashboard 應改為單欄"
  );
});
