import assert from "node:assert/strict";

export function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `index.html 應定義 ${name}()`);

  const parametersStart = source.indexOf("(", start);
  let parametersEnd = -1;
  let parenthesesDepth = 0;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parenthesesDepth += 1;
    if (source[index] === ")") parenthesesDepth -= 1;
    if (parenthesesDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  assert.notEqual(parametersEnd, -1, `${name}() 缺少參數結尾括號`);

  const bodyStart = source.indexOf("{", parametersEnd + 1);
  assert.notEqual(bodyStart, -1, `${name}() 缺少函式本體`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${name}() 缺少結尾大括號`);
}

export function extractConstObjectLiteral(source, name) {
  const declarationStart = source.indexOf(`const ${name} =`);
  assert.notEqual(declarationStart, -1, `index.html 應定義 ${name}`);

  const assignment = source.indexOf("=", declarationStart);
  const objectStart = source.indexOf("{", assignment + 1);
  assert.notEqual(objectStart, -1, `${name} 應包含 object literal`);
  let depth = 0;
  for (let index = objectStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(objectStart, index + 1);
  }

  assert.fail(`${name} 缺少結尾大括號`);
}

export function createInputHarness(source, {
  mode = "tx",
  values = {},
  contractSpecs
} = {}) {
  assert.ok(contractSpecs, "input harness 需要 risk model CONTRACT_SPECS");
  const defaults = {
    "v-idx": "47000",
    "v-eq": "2000",
    "v-im": "70.1",
    "v-mm": "53.8",
    "v-pv": "200",
    "v-st": "2000",
    "v-ld": "10"
  };
  const elements = new Map(
    Object.entries({ ...defaults, ...values }).map(([id, initialValue]) => {
      let value = String(initialValue);
      return [id, {
        get value() { return value; },
        set value(nextValue) { value = String(nextValue); }
      }];
    })
  );
  const activeMode = { dataset: { mode } };
  const document = {
    querySelector(selector) {
      if (selector === ".mode-tab.active") return activeMode;
      throw new Error(`Unexpected input-harness selector: ${selector}`);
    }
  };
  const g = id => {
    assert.ok(elements.has(id), `input harness 缺少 #${id}`);
    return elements.get(id);
  };
  const modes = Object.fromEntries(
    Object.entries(contractSpecs).map(([key, spec]) => [key, {
      symbol: spec.symbol,
      pv: spec.pointValue,
      im: spec.initialMargin / 10_000,
      mm: spec.maintenanceMargin / 10_000
    }])
  );
  const readNumberSource = extractNamedFunction(source, "readNumber");
  const getPSource = extractNamedFunction(source, "getP");
  const applyActiveModeSource = extractNamedFunction(source, "applyActiveMode");
  const factory = new Function(
    "document",
    "g",
    "MODES",
    `"use strict";
      ${readNumberSource}
      ${getPSource}
      let contractFieldsCustomized = false;
      ${applyActiveModeSource}
      return { MODES, readNumber, getP, applyActiveMode };`
  );
  const api = factory(document, g, modes);

  return {
    ...api,
    setMode(nextMode) { activeMode.dataset.mode = nextMode; },
    setValue(id, value) { g(id).value = String(value); },
    value(id) { return g(id).value; }
  };
}

function createClassList() {
  const values = new Set();
  return {
    add(...tokens) { tokens.forEach(token => values.add(token)); },
    contains(token) { return values.has(token); },
    values() { return [...values]; }
  };
}

function createRow() {
  return {
    classList: createClassList(),
    innerHTML: "",
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); }
  };
}

export function renderScenario(source, params, { pinned = [], riskModel } = {}) {
  assert.ok(riskModel, "render harness 需要 DuduRiskModel");
  const elements = new Map();
  for (const id of [
    "disp-idx", "s-cv", "s-ml", "s-ll", "s-sm",
    "s-rm-c", "s-rm-s", "s-rm-a"
  ]) {
    elements.set(id, { textContent: "", innerHTML: "", style: {} });
  }

  const rows = [];
  const tbody = {
    get innerHTML() { return this._innerHTML ?? ""; },
    set innerHTML(value) {
      this._innerHTML = String(value);
      if (value === "") rows.length = 0;
    },
    appendChild(row) { rows.push(row); }
  };
  elements.set("tbody", tbody);
  const ticker = {
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
  };
  const rowCount = { textContent: "" };
  const document = {
    querySelector(selector) {
      if (selector === ".hdr-ticker") return ticker;
      if (selector === ".b-row-count") return rowCount;
      throw new Error(`Unexpected render-harness selector: ${selector}`);
    },
    createElement(tagName) {
      assert.equal(tagName, "tr");
      return createRow();
    }
  };
  const g = id => {
    assert.ok(elements.has(id), `render harness 缺少 #${id}`);
    return elements.get(id);
  };
  const wanSource = extractNamedFunction(source, "wan");
  const numSource = extractNamedFunction(source, "num");
  const toModelParamsSource = extractNamedFunction(source, "toModelParams");
  const renderSource = extractNamedFunction(source, "render");
  const pinnedRows = new Set(pinned);
  const calls = { updateSel: [], decisions: [], saves: 0 };
  const updateSel = (...args) => calls.updateSel.push(args);
  const updateDecisionSummary = (...args) => calls.decisions.push(args);
  const saveSettings = () => { calls.saves += 1; };
  const setValidationState = () => {};
  const renderInvalid = errors => { calls.invalid = errors; };
  const getP = () => ({ ...params });
  const factory = new Function(
    "document",
    "g",
    "getP",
    "updateSel",
    "pinnedRows",
    "updateDecisionSummary",
    "saveSettings",
    "setValidationState",
    "renderInvalid",
    "validateRiskInputs",
    "calculateRiskSummary",
    "calculatePosition",
    `"use strict";
      const CULTIVATION_MODE = false;
      ${wanSource}
      ${numSource}
      ${toModelParamsSource}
      let currentP = null, currentCv = 0, currentLimitLoss = 0;
      ${renderSource}
      return {
        render,
        state: () => ({ currentP, currentCv, currentLimitLoss })
      };`
  );
  const api = factory(
    document,
    g,
    getP,
    updateSel,
    pinnedRows,
    updateDecisionSummary,
    saveSettings,
    setValidationState,
    renderInvalid,
    riskModel.validateRiskInputs,
    riskModel.calculateRiskSummary,
    riskModel.calculatePosition
  );

  api.render();
  return {
    rows,
    ticker,
    rowCount,
    calls,
    state: api.state(),
    text(id) { return g(id).textContent; }
  };
}

export function rowCells(row) {
  return [...row.innerHTML.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)]
    .map(([, cell]) => cell.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());
}
