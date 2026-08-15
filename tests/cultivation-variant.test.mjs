import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

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
  assert.match(html, /function initHelpTips\(\)[\s\S]*?document\.querySelectorAll\('\.tip'\)[\s\S]*?tip\.addEventListener\('click'/);
  assert.match(html, /applyCultivationCopy\(\);\s*initHelpTips\(\);/);

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
