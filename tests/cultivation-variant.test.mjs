import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `應定義共用 ${name} helper`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${name} helper 缺少結尾大括號`);
}

test("C 版是獨立修仙概念介面，並保留 NTD 1:1 說明", async () => {
  const html = await readFile("index.html", "utf8");
  const css = await readFile("styles/xianxia-v3.4.css", "utf8");

  assert.match(html, /\['a', 'b', 'c'\]\.includes\(requestedVariant\) \? requestedVariant : 'c'/);
  assert.match(html, /activeVariant !== 'a'/);
  assert.match(html, /APP_VARIANT === 'c'/);
  assert.match(html, /先觀劫數，再問長生。/);
  assert.match(html, /1 靈石＝NT\$1/);
  assert.match(html, /靈石為介面代稱/);
  assert.match(html, /html\[data-variant="c"\] \.b-intro/);
  assert.match(html, /taifexLeverageCalc\.settings\.c/);
  assert.match(html, /class="c-currency-notice c-only"/);
  assert.match(css, /assets\/cultivation-bg-clean-v2\.png/);
  assert.match(html, /class="c-identity-rail c-only"/);
  assert.match(html, /class="c-dashboard"/);
  assert.match(html, /assets\/xianxia-v3\.4\/headline\.webp/);
  await access("assets/cultivation-bg-clean-v2.png");
  await access("assets/xianxia-v3.4/headline.webp");
  await access("assets/xianxia-v3.4/seal.webp");
});

test("C 版版本資訊已升至 v3.4.0", async () => {
  const html = await readFile("index.html", "utf8");
  const pkg = JSON.parse(await readFile("package.json", "utf8"));

  assert.match(html, /const APP_VERSION\s*=\s*'v3\.4\.0'/);
  assert.equal(pkg.version, "3.4.0");
});

test("B/C 雙向切換使用真實按鈕，且 C 版極簡模式位於收起玄機左側", async () => {
  const html = await readFile("index.html", "utf8");
  const actionGroup = html.match(/<div class="b-actions">([\s\S]*?)<\/div>/)?.[1];

  assert.ok(actionGroup, "應保留 B/C 共用操作列");
  const switchButton = actionGroup.match(
    /<button\b(?=[^>]*\bid="variant-switch")[^>]*>[\s\S]*?<\/button>/
  )?.[0];
  assert.ok(switchButton, "風格切換必須是 #variant-switch <button>");
  assert.match(switchButton, /\btype="button"/);
  assert.ok(
    actionGroup.indexOf('id="variant-switch"') < actionGroup.indexOf('id="b-advanced"'),
    "C 版「極簡模式」必須在「收起玄機」左側"
  );

  assert.match(
    html,
    /CULTIVATION_MODE\s*\?\s*['"]◇ 極簡模式['"]\s*:\s*['"]修仙模式['"]/,
    "C 版應顯示極簡模式，B 版應顯示修仙模式"
  );
  assert.match(
    html,
    /const targetVariant\s*=\s*CULTIVATION_MODE\s*\?\s*['"]b['"]\s*:\s*['"]c['"]/,
    "C 應切至 B，B 應切至 C"
  );
  assert.match(
    html,
    /variantSwitch\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*switchVariant\(targetVariant\)\)/,
    "風格按鈕應呼叫共用 switchVariant helper"
  );
  assert.match(html, /variantSwitch\.addEventListener\(['"]keydown['"]/);
  assert.match(html, /event\.key\s*!==\s*['"]Enter['"]\s*&&\s*event\.key\s*!==\s*['"] ['"]/);
});

test("共用 switchVariant 保留 query/hash 與當前輸入、選取狀態，不會 reset storage", async () => {
  const html = await readFile("index.html", "utf8");
  const settingsKeySource = extractNamedFunction(html, "settingsKeyForVariant");
  const switchVariantSource = extractNamedFunction(html, "switchVariant");
  const runSwitchVariant = new Function(
    "window",
    "localStorage",
    "STORE_KEY",
    "APP_VARIANT",
    "saveSettings",
    "URL",
    "targetVariant",
    `"use strict"; ${settingsKeySource}; ${switchVariantSource}; switchVariant(targetVariant);`
  );

  for (const [currentVariant, targetVariant] of [["c", "b"], ["b", "c"]]) {
    const currentKey = `taifexLeverageCalc.settings.${currentVariant}`;
    const targetKey = `taifexLeverageCalc.settings.${targetVariant}`;
    const freshState = JSON.stringify({
      mode: "mtx",
      idx: "48123",
      eq: "777",
      im: "19.25",
      mm: "14.8",
      pv: "55",
      st: "2345",
      ld: "0.08",
      contractFieldsCustomized: true,
      pinned: [3, 11]
    });
    const values = new Map([[targetKey, JSON.stringify({ idx: "old" })]]);
    let saveCalls = 0;
    let resetCalls = 0;
    const localStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: () => { resetCalls += 1; },
      clear: () => { resetCalls += 1; }
    };
    const window = {
      location: {
        href: `http://127.0.0.1:4173/dist/index.html?variant=${currentVariant}&account=demo&debug=1#risk`
      }
    };
    const saveSettings = () => {
      saveCalls += 1;
      values.set(currentKey, freshState);
    };

    runSwitchVariant(
      window,
      localStorage,
      currentKey,
      currentVariant,
      saveSettings,
      URL,
      targetVariant
    );

    const switchedUrl = new URL(window.location.href);
    assert.equal(switchedUrl.searchParams.get("variant"), targetVariant);
    assert.equal(switchedUrl.searchParams.get("account"), "demo");
    assert.equal(switchedUrl.searchParams.get("debug"), "1");
    assert.equal(switchedUrl.hash, "#risk");
    assert.equal(saveCalls, 1, "導航前應先儲存當前輸入與選取狀態");
    assert.equal(values.get(currentKey), freshState, "原 variant 的設定不可被清除");
    assert.equal(values.get(targetKey), freshState, "目標 variant 應承接相同設定");
    assert.equal(resetCalls, 0, "風格切換不得清除 localStorage");
  }
});

test("自訂契約參數與空選取狀態可保存，官方更新不覆寫使用者設定", async () => {
  const html = await readFile("index.html", "utf8");
  const saveSource = extractNamedFunction(html, "saveSettings");
  const loadSource = extractNamedFunction(html, "loadSettings");
  const initSource = extractNamedFunction(html, "init");

  assert.match(saveSource, /im:\s+g\('v-im'\)\.value/);
  assert.match(saveSource, /mm:\s+g\('v-mm'\)\.value/);
  assert.match(saveSource, /pv:\s+g\('v-pv'\)\.value/);
  assert.match(saveSource, /contractFieldsCustomized/);
  assert.match(loadSource, /s\.contractFieldsCustomized === true/);
  assert.match(initSource, /!hadStoredSettings && pinnedRows\.size === 0/);
  assert.match(initSource, /applyActiveMode\(\{ preserveCustom: true \}\)/);
});

test("v3.4 天機法器結構、動效與無固定前景回歸已接入", async () => {
  const html = await readFile("index.html", "utf8");
  const css = await readFile("styles/xianxia-v3.4.css", "utf8");
  const build = await readFile("scripts/build.mjs", "utf8");

  assert.match(html, /styles\/xianxia-v3\.4\.css/);
  assert.doesNotMatch(html, /class="c-character-foreground c-only"/);
  assert.doesNotMatch(css, /\.c-character-foreground\s*\{/);
  assert.match(css, /cultivation-bg-clean-v2\.png/);
  assert.match(html, /洞悉天機/);
  assert.match(html, /方得長生/);
  assert.match(html, /觀劫知命/);
  assert.match(html, /避天改運/);
  assert.match(html, /仙門傳音/);
  assert.match(css, /small-divider\.webp/);
  assert.match(css, /mid-divider\.webp/);
  assert.match(css, /@keyframes xian-border-flow/);
  assert.match(css, /@keyframes xian-row-lock/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(build, /cp\("styles", "dist\/styles"/);
});

test("Round 3 help tips、點位單位與前景圖定位回歸", async () => {
  const html = await readFile("index.html", "utf8");
  const css = await readFile("styles/xianxia-v3.4.css", "utf8");

  const helpButtons = html.match(/<button\b[^>]*class="tip"[^>]*>\?<\/button>/g) ?? [];
  assert.equal(helpButtons.length, 7, "所有 7 個 help tip 都應保留為可點擊按鈕");
  for (const button of helpButtons) {
    assert.match(button, /\btype="button"/);
    assert.match(button, /\bdata-tip="[^"]+"/);
    assert.match(button, /\baria-label="[^"]+"/);
    assert.match(button, /\baria-expanded="false"/);
  }
  assert.doesNotMatch(html, /<span\b[^>]*class="tip"/);
  assert.match(
    html,
    /function initHelpTips\(\)[\s\S]*?document\.querySelectorAll\('\.tip'\)[\s\S]*?document\.addEventListener\('click'[\s\S]*?event\.target\.closest\('button\.tip'\)/
  );
  assert.match(html, /if \(CULTIVATION_MODE\) \{[\s\S]*?applyCultivationCopy\(\);[\s\S]*?\}\s*initHelpTips\(\);/);

  assert.match(html, /<span class="c-ticker-unit">點<\/span>/);
  assert.match(html, /document\.querySelector\('\.c-ticker-unit'\)\.textContent\s*=\s*'點'/);
  assert.doesNotMatch(html, /document\.querySelector\('\.c-ticker-unit'\)\.textContent\s*=\s*'靈石'/);

  assert.match(html, /class="c-cultivator c-only"[^>]+cultivator-foreground-v1\.png/);
  const cultivatorRule = css.match(/html\[data-variant="c"\]\s+\.c-cultivator\s*\{([^}]*)\}/);
  assert.ok(cultivatorRule, "C 版應有獨立的 cultivator 前景定位規則");
  assert.match(cultivatorRule[1], /position:\s*absolute\s*;/);
  assert.doesNotMatch(cultivatorRule[1], /position:\s*fixed\s*;/);
  assert.doesNotMatch(cultivatorRule[1], /(?:width:\s*100vw|height:\s*100vh|inset:\s*0)\s*;/);

  assert.match(css, /url\("\.\.\/assets\/cultivation-bg-clean-v2\.png"\)/);
  assert.doesNotMatch(css, /url\("\.\.\/assets\/cultivation-bg-v1\.png"\)/);
  await access("assets/cultivation-bg-clean-v2.png");
  await access("assets/xianxia-v3.4/cultivator-foreground-v1.png");
});
