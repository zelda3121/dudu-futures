import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractNamedFunction } from "./helpers/inline-calculator-harness.mjs";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const cultivationCss = await readFile(
  new URL("../styles/xianxia-v3.4.css", import.meta.url),
  "utf8"
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rulesFor(source, selector) {
  const pattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "g");
  return [...source.matchAll(pattern)].map(match => match[1]);
}

function blockAfter(source, marker) {
  const markerStart = source.indexOf(marker);
  assert.notEqual(markerStart, -1, `找不到 ${marker}`);
  const bodyStart = source.indexOf("{", markerStart);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  assert.fail(`${marker} 缺少結尾大括號`);
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...tokens) { tokens.forEach(token => values.add(token)); },
    remove(...tokens) { tokens.forEach(token => values.delete(token)); },
    contains(token) { return values.has(token); },
    toggle(token, force) {
      const enabled = force === undefined ? !values.has(token) : Boolean(force);
      if (enabled) values.add(token);
      else values.delete(token);
      return enabled;
    }
  };
}

function textContentOf(fragment) {
  return fragment.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function declarationPixels(rule, property) {
  const match = rule.match(new RegExp(`${escapeRegExp(property)}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`));
  return match ? Number(match[1]) : null;
}

function createHelpInteractionHarness() {
  const documentListeners = new Map();
  const popoverListeners = new Map();
  const insidePopoverTarget = {
    closest(selector) {
      if (selector === "#help-popover") return popover;
      if (selector === "button.tip") return null;
      return null;
    }
  };
  const popover = {
    classList: createClassList(["hidden"]),
    addEventListener(type, listener) { popoverListeners.set(type, listener); },
    contains(target) { return target === insidePopoverTarget; }
  };
  const makeTip = ({ glossary = false } = {}) => ({
    dataset: {
      tip: glossary ? "長篇名詞說明" : "短提示",
      ...(glossary ? { helpTemplate: "table-glossary-template" } : {})
    },
    attributes: new Map(),
    contains() { return false; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
  });
  const glossaryTip = makeTip({ glossary: true });
  const regularTip = makeTip();
  const targetForTip = tip => ({
    closest(selector) {
      if (selector === "button.tip") return tip;
      if (selector === "#help-popover") return null;
      return null;
    }
  });
  const outsideTarget = { closest() { return null; } };
  const document = {
    querySelectorAll(selector) {
      assert.equal(selector, ".tip");
      return [glossaryTip, regularTip];
    },
    addEventListener(type, listener) { documentListeners.set(type, listener); }
  };
  const window = { addEventListener() {} };
  const g = id => id === "help-popover" ? popover : null;
  const initSource = extractNamedFunction(html, "initHelpTips");
  const factory = new Function(
    "document",
    "window",
    "g",
    `"use strict";
      const APP_VARIANT = "b";
      let activeHelpTip = null;
      let helpPopoverLocked = false;
      const calls = { opens: [], closes: 0 };
      const positionHelpPopover = () => {};
      function openHelpPopover(tip, locked = false, focusPopover = false) {
        activeHelpTip = tip;
        helpPopoverLocked = locked;
        calls.opens.push({ tip, locked, focusPopover });
      }
      function closeHelpPopover() {
        activeHelpTip = null;
        helpPopoverLocked = false;
        calls.closes += 1;
      }
      ${initSource}
      initHelpTips();
      return {
        calls,
        openHelpPopover,
        state: () => ({ activeHelpTip, helpPopoverLocked })
      };`
  );
  const api = factory(document, window, g);

  return {
    api,
    documentListeners,
    glossaryTip,
    regularTip,
    insidePopoverTarget,
    outsideTarget,
    targetForTip
  };
}

test("風險表 glossary 使用真實按鈕並連到八組 dt/dd template", () => {
  const button = html.match(
    /<button\b[^>]*class="[^"]*\btable-glossary\b[^"]*"[^>]*>[\s\S]*?<\/button>/
  )?.[0];
  assert.ok(button, "應保留風險表 glossary 按鈕");
  assert.match(button, /\btype="button"/);
  assert.match(button, /\bclass="[^"]*\btip\b[^"]*"/);
  assert.match(button, /\bdata-help-template="table-glossary-template"/);
  assert.match(button, /\baria-expanded="false"/);
  assert.match(button, /\baria-controls="help-popover"/);

  const template = html.match(
    /<template\s+id="table-glossary-template">([\s\S]*?)<\/template>/
  )?.[1];
  assert.ok(template, "data-help-template 必須指向存在的 template");
  assert.equal((template.match(/<div\s+class="help-glossary-item">/g) ?? []).length, 8);
  assert.equal((template.match(/<dt\b/g) ?? []).length, 8);
  assert.equal((template.match(/<dd\b/g) ?? []).length, 8);
  assert.match(template, /class="help-glossary-note"/);
  assert.match(template, /實際保證金通知、盤中風控與代沖銷規則/);

  const termLabels = [...template.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/g)]
    .map(match => textContentOf(match[1]));
  const aliases = [
    ["槓桿倍數", "靈壓倍數"],
    ["距維持保證金臨界值", "距護陣臨界"],
    ["維持保證金臨界點位", "護陣臨界點位"],
    ["壓力測試情境損失", "天劫推演損失"],
    ["每 100 點損益", "每 100 點靈石損益"],
    ["保證金使用率", "靈石封印率"],
    ["扣除原始保證金後餘額", "剩餘可用靈石"]
  ];
  assert.equal((template.match(/class="help-glossary-alias"/g) ?? []).length, 7);
  for (const [minimalTerm, cultivationTerm] of aliases) {
    assert.ok(
      termLabels.some(label => label.includes(minimalTerm) && label.includes(cultivationTerm)),
      `glossary 應同列呈現「${minimalTerm}」與「${cultivationTerm}」`
    );
  }

  const keyboardHandling = extractNamedFunction(html, "initHelpTips");
  assert.match(keyboardHandling, /event\.target\.closest\?\.\('button\.tip'\)/);
  assert.match(keyboardHandling, /event\.key !== 'Enter' && event\.key !== ' '/);
});

test("openHelpPopover clone glossary 並切換 has-glossary，close 時完整清除", () => {
  const openSource = extractNamedFunction(html, "openHelpPopover");
  const closeSource = extractNamedFunction(html, "closeHelpPopover");
  const popover = {
    classList: createClassList(["hidden"]),
    children: [],
    dataset: { placement: "bottom" },
    attributes: new Map([
      ["role", "tooltip"],
      ["aria-live", "polite"]
    ]),
    replaceChildren(...children) { this.children = children; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    toggleAttribute(name, force) {
      const enabled = force === undefined ? !this.attributes.has(name) : Boolean(force);
      if (enabled) this.attributes.set(name, "");
      else this.attributes.delete(name);
      return enabled;
    },
    set textContent(value) {
      this._textContent = String(value);
      if (value === "") this.children = [];
    },
    get textContent() { return this._textContent ?? ""; }
  };
  let cloneDeep;
  const clonedGlossary = { kind: "glossary-clone" };
  const template = {
    content: {
      cloneNode(deep) {
        cloneDeep = deep;
        return clonedGlossary;
      }
    }
  };
  const tipAttributes = new Map([["aria-expanded", "false"]]);
  const tip = {
    classList: createClassList(["tip", "table-glossary"]),
    dataset: {
      tip: "fallback",
      helpTitle: "風險表名詞說明",
      helpTemplate: "table-glossary-template"
    },
    setAttribute(name, value) { tipAttributes.set(name, String(value)); },
    removeAttribute(name) { tipAttributes.delete(name); },
    toggleAttribute(name, force) {
      const enabled = force === undefined ? !tipAttributes.has(name) : Boolean(force);
      if (enabled) tipAttributes.set(name, "");
      else tipAttributes.delete(name);
      return enabled;
    }
  };
  const elements = new Map([
    ["help-popover", popover],
    ["table-glossary-template", template]
  ]);
  const g = id => elements.get(id) ?? null;
  const document = {
    createElement(tagName) { return { tagName, className: "", textContent: "" }; }
  };
  const factory = new Function(
    "g",
    "document",
    "requestAnimationFrame",
    `"use strict";
      let activeHelpTip = null;
      let helpPopoverLocked = false;
      const positionHelpPopover = () => {};
      ${closeSource}
      ${openSource}
      return { openHelpPopover, closeHelpPopover };`
  );
  const api = factory(g, document, () => {});

  api.openHelpPopover(tip, true);
  assert.equal(cloneDeep, true, "template.content 必須以 deep clone 插入");
  assert.equal(popover.children.at(-1), clonedGlossary);
  assert.equal(popover.classList.contains("has-glossary"), true);
  assert.equal(popover.classList.contains("hidden"), false);
  assert.equal(tip.classList.contains("is-open"), true);
  assert.equal(tipAttributes.get("aria-expanded"), "true");
  assert.equal(popover.attributes.get("role"), "dialog");
  assert.equal(popover.attributes.get("aria-live"), "off");
  assert.equal(popover.attributes.get("aria-modal"), "false");

  api.closeHelpPopover();
  assert.equal(popover.classList.contains("has-glossary"), false);
  assert.equal(popover.classList.contains("hidden"), true);
  assert.equal(popover.children.length, 0);
  assert.equal(tip.classList.contains("is-open"), false);
  assert.equal(tipAttributes.get("aria-expanded"), "false");
  assert.equal(popover.attributes.get("role"), "tooltip");
  assert.equal(popover.attributes.get("aria-live"), "polite");
  assert.equal("placement" in popover.dataset, false);
});

test("長 glossary 只由明確操作開啟，且 popover 內點擊不觸發 outside close", () => {
  const {
    api,
    documentListeners,
    glossaryTip,
    regularTip,
    insidePopoverTarget,
    outsideTarget,
    targetForTip
  } = createHelpInteractionHarness();
  const mouseover = documentListeners.get("mouseover");
  const focusin = documentListeners.get("focusin");
  const click = documentListeners.get("click");
  assert.equal(typeof mouseover, "function");
  assert.equal(typeof focusin, "function");
  assert.equal(typeof click, "function");

  mouseover({ target: targetForTip(glossaryTip), relatedTarget: null });
  focusin({ target: targetForTip(glossaryTip) });
  assert.equal(api.calls.opens.length, 0, "長 glossary 不應因 hover/focus 自動展開");

  mouseover({ target: targetForTip(regularTip), relatedTarget: null });
  assert.equal(api.calls.opens.length, 1, "一般短 tooltip 仍應保留 hover 行為");

  api.openHelpPopover(glossaryTip, true);
  api.calls.opens.length = 0;
  api.calls.closes = 0;
  click({ target: insidePopoverTarget });
  assert.equal(api.calls.closes, 0, "點擊 glossary popover 內容不應被視為 outside click");
  assert.equal(api.state().activeHelpTip, glossaryTip);
  assert.equal(api.state().helpPopoverLocked, true);

  click({ target: outsideTarget });
  assert.equal(api.calls.closes, 1, "真正的外部點擊仍應關閉 glossary");
  assert.equal(api.state().activeHelpTip, null);
});

test("glossary 桌機採寬版雙欄，600px 以下改為單欄", () => {
  const bWideRule = rulesFor(html, 'html[data-variant="b"] .help-popover.has-glossary');
  const cWideRule = rulesFor(
    cultivationCss,
    'html[data-variant="c"] .help-popover.has-glossary'
  );
  const desktopItemRules = rulesFor(html, ".help-glossary-item");
  const narrowCss = blockAfter(html, "@media (max-width: 600px)");
  const narrowItemRules = rulesFor(narrowCss, ".help-glossary-item");

  assert.ok(bWideRule.some(rule => /width:\s*min\(640px,\s*calc\(100vw - 24px\)\)/.test(rule)));
  assert.ok(cWideRule.some(rule => /width:\s*min\(660px,\s*calc\(100vw - 24px\)\)/.test(rule)));
  assert.ok(desktopItemRules.some(rule => (
    /grid-template-columns:\s*minmax\([^)]*\)\s+minmax\([^)]*\)/.test(rule)
  )));
  assert.ok(narrowItemRules.some(rule => /grid-template-columns:\s*1fr\s*;/.test(rule)));
});

test("B/C glossary 按鈕最小 hit target 高度皆不少於 24px", () => {
  const bHitRules = [
    ...rulesFor(html, ".table-glossary"),
    ...rulesFor(html, 'html[data-variant="b"] .table-glossary'),
    ...rulesFor(html, 'html[data-variant="b"] .tip.help-link.table-glossary')
  ];
  const cHitRules = [
    ...rulesFor(cultivationCss, 'html[data-variant="c"] .tip.help-link'),
    ...rulesFor(cultivationCss, 'html[data-variant="c"] .table-glossary'),
    ...rulesFor(cultivationCss, 'html[data-variant="c"] .tip.help-link.table-glossary')
  ];
  const hasMinimumHeight = rules => rules.some(rule => (
    (declarationPixels(rule, "min-height") ?? 0) >= 24 ||
    (declarationPixels(rule, "height") ?? 0) >= 24
  ));

  assert.ok(hasMinimumHeight(bHitRules), "B 版 glossary hit target 高度應至少 24px");
  assert.ok(hasMinimumHeight(cHitRules), "C 版 glossary hit target 高度應至少 24px");
});
