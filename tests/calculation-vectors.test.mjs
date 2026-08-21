import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createInputHarness,
  extractConstObjectLiteral,
  extractNamedFunction,
  renderScenario,
  rowCells
} from "./helpers/inline-calculator-harness.mjs";

await import("../scripts/risk-model.js");

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const modelSource = await readFile(new URL("../scripts/risk-model.js", import.meta.url), "utf8");
const riskModel = globalThis.DuduRiskModel;

// TAIFEX 2026-08-12 fallback margins + official contract multipliers/codes.
const CONTRACT_SPECS = {
  tx:  { symbol: "TX",  pointValue: 200, initialMargin: 701_000, maintenanceMargin: 538_000 },
  mtx: { symbol: "MTX", pointValue: 50,  initialMargin: 175_250, maintenanceMargin: 134_500 },
  tmf: { symbol: "TMF", pointValue: 10,  initialMargin: 35_050,  maintenanceMargin: 26_900 }
};

const BASELINE = {
  indexPrice: 47_000,
  equity: 20_000_000,
  stressPoints: 2_000,
  extremeRate: 0.10,
  contracts: 9
};

function formatNumber(value, digits = 0) {
  return value.toLocaleString("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatWan(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value) / 10_000, 2)} 萬`;
}

function modelParams(spec, input = BASELINE) {
  return {
    indexPrice: input.indexPrice,
    equity: input.equity,
    initialMargin: spec.initialMargin,
    maintenanceMargin: spec.maintenanceMargin,
    pointValue: spec.pointValue,
    stressPoints: input.stressPoints,
    extremeRate: input.extremeRate
  };
}

function inlineParams(params, mode) {
  return {
    idx: params.indexPrice,
    eq: params.equity,
    im: params.initialMargin,
    mm: params.maintenanceMargin,
    pv: params.pointValue,
    st: params.stressPoints,
    ld: params.extremeRate,
    mode
  };
}

function recommendationLots(params, contractValue, leverage, marginRate) {
  return Math.floor(Math.min(
    params.equity / params.initialMargin,
    leverage * params.equity / contractValue,
    marginRate * params.equity / params.initialMargin
  ));
}

function expectedMetrics(spec, input = BASELINE) {
  const params = modelParams(spec, input);
  const contractValue = params.indexPrice * params.pointValue;
  const maxOpen = Math.floor(params.equity / params.initialMargin);
  const rawStressMax = Math.floor(
    params.equity / (params.stressPoints * params.pointValue + params.maintenanceMargin)
  );
  const stressMax = Math.min(maxOpen, Math.max(0, rawStressMax));
  const n = input.contracts;
  const leverage = n * contractValue / params.equity;
  const marginPct = n * params.initialMargin / params.equity * 100;
  const liquidationDistance = (
    params.equity - n * params.maintenanceMargin
  ) / (n * params.pointValue);

  return {
    params,
    contractValue,
    limitLoss: params.indexPrice * params.extremeRate * params.pointValue,
    maxOpen,
    stressMax,
    conservative: recommendationLots(params, contractValue, 4, 0.30),
    standard: recommendationLots(params, contractValue, 6, 0.50),
    aggressive: recommendationLots(params, contractValue, 8, 0.70),
    leverage,
    marginPct,
    liquidationDistance,
    liquidationIndex: params.indexPrice - liquidationDistance,
    stressLoss: n * params.stressPoints * params.pointValue,
    pnl100: n * 100 * params.pointValue,
    available: params.equity - n * params.initialMargin
  };
}

function assertBaselineVector(mode) {
  const spec = CONTRACT_SPECS[mode];
  const expected = expectedMetrics(spec);
  const summary = riskModel.calculateRiskSummary(expected.params);
  const position = riskModel.calculatePosition(expected.params, BASELINE.contracts);

  assert.equal(summary.valid, true);
  assert.equal(summary.notionalPerContract, expected.contractValue);
  assert.equal(summary.extremeScenarioLossPerContract, expected.limitLoss);
  assert.equal(summary.maximumContracts, expected.maxOpen);
  assert.equal(summary.stressSurvivableContracts, expected.stressMax);
  assert.equal(summary.conservativeContracts, expected.conservative);
  assert.equal(summary.standardContracts, expected.standard);
  assert.equal(summary.aggressiveContracts, expected.aggressive);
  assert.equal(position.valid, true);
  assert.equal(position.leverage, expected.leverage);
  assert.equal(position.initialMarginUsagePct, expected.marginPct);
  assert.equal(position.maintenanceDistancePoints, expected.liquidationDistance);
  assert.equal(position.maintenanceThresholdPrice, expected.liquidationIndex);
  assert.equal(position.stressLoss, expected.stressLoss);
  assert.equal(position.pnlPer100Points, expected.pnl100);
  assert.equal(position.availableBalance, expected.available);

  const inputHarness = createInputHarness(html, {
    mode,
    contractSpecs: riskModel.CONTRACT_SPECS
  });
  inputHarness.applyActiveMode();
  const pageParams = inputHarness.getP();
  assert.equal(pageParams.idx, expected.params.indexPrice);
  assert.equal(pageParams.eq, expected.params.equity);
  assert.equal(pageParams.im, expected.params.initialMargin);
  assert.equal(pageParams.mm, expected.params.maintenanceMargin);
  assert.equal(pageParams.pv, expected.params.pointValue);
  assert.equal(pageParams.st, expected.params.stressPoints);
  assert.equal(pageParams.ld, expected.params.extremeRate);
  assert.equal(pageParams.mode.symbol, spec.symbol);

  const output = renderScenario(html, inlineParams(expected.params, pageParams.mode), {
    pinned: [BASELINE.contracts],
    riskModel
  });
  assert.equal(output.state.currentCv, expected.contractValue);
  assert.equal(output.state.currentLimitLoss, expected.limitLoss);
  assert.equal(output.text("s-cv"), formatWan(expected.contractValue));
  assert.equal(output.text("s-ml"), `${expected.maxOpen} 口`);
  assert.equal(output.text("s-ll"), `▼ ${formatWan(expected.limitLoss)}`);
  assert.equal(output.text("s-sm"), `${expected.stressMax} 口`);
  assert.equal(output.text("s-rm-c"), `${expected.conservative} 口`);
  assert.equal(output.text("s-rm-s"), `${expected.standard} 口`);
  assert.equal(output.text("s-rm-a"), `${expected.aggressive} 口`);
  const expectedRowLimit = Math.min(1_000, Math.max(
    100,
    expected.maxOpen + 5,
    expected.stressMax + 5
  ));
  assert.equal(output.rows.length, expectedRowLimit);

  assert.deepEqual(rowCells(output.rows[BASELINE.contracts - 1]), [
    String(BASELINE.contracts),
    `${formatNumber(expected.leverage, 2)}x`,
    `${formatNumber(expected.liquidationDistance, 0)} pt`,
    expected.liquidationIndex > 0
      ? formatNumber(expected.liquidationIndex, 0)
      : "跌至 0 前未達",
    `▼ ${formatWan(expected.stressLoss)}`,
    formatWan(expected.pnl100),
    `${formatNumber(expected.marginPct, 1)}%`,
    formatWan(expected.available)
  ]);
}

test("TX / MTX / TMF 規格只有一個計算資料來源", () => {
  const normalizedSpecs = Object.fromEntries(
    Object.entries(riskModel.CONTRACT_SPECS).map(([mode, spec]) => [mode, {
      symbol: spec.symbol,
      pointValue: spec.pointValue,
      initialMargin: spec.initialMargin,
      maintenanceMargin: spec.maintenanceMargin
    }])
  );
  assert.deepEqual(normalizedSpecs, CONTRACT_SPECS);

  const modeButtons = [...html.matchAll(/<button\b[^>]*\bdata-mode="([^"]+)"/g)]
    .map(match => match[1]);
  assert.deepEqual(modeButtons, ["tx", "mtx", "tmf"]);
  assert.match(
    html,
    /const MODES\s*=\s*Object\.fromEntries\(Object\.entries\(CONTRACT_SPECS\)/
  );
  assert.match(extractNamedFunction(html, "fetchTaifexMargins"), /\['tx', 'mtx', 'tmf'\]/);

  const specsLiteral = extractConstObjectLiteral(modelSource, "CONTRACT_SPECS");
  assert.deepEqual(
    [...specsLiteral.matchAll(/\bpointValue:\s*(200|50|10)\b/g)].map(match => Number(match[1])),
    [200, 50, 10]
  );
  const modelWithoutSpecs = modelSource.replace(specsLiteral, "{}");
  assert.doesNotMatch(
    modelWithoutSpecs,
    /\bpointValue\s*:\s*(?:200|50|10)\b/,
    "點值乘數只能存在 CONTRACT_SPECS"
  );
  assert.doesNotMatch(
    html,
    /\bpv\s*:\s*(?:200|50|10)\b/,
    "index.html 不得另外 hardcode 點值乘數"
  );
});

test("TX baseline 47,000 / 2,000 萬 / 壓測 2,000 / 9 口固定向量", () => {
  assertBaselineVector("tx");
});

test("MTX / TMF 依合約規格驅動同一套公式", async t => {
  for (const mode of ["mtx", "tmf"]) {
    await t.test(mode.toUpperCase(), () => assertBaselineVector(mode));
  }
});

test("0、負數、空值、NaN 與 Infinity 都被拒絕，不進入公式", async t => {
  const base = modelParams(CONTRACT_SPECS.mtx);
  const invalidValues = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const invalid of invalidValues) {
    await t.test(String(invalid), () => {
      for (const field of Object.keys(base)) {
        const validation = riskModel.validateRiskInputs({ ...base, [field]: invalid });
        assert.equal(validation.valid, false, `${field}=${invalid} 應為 invalid`);
        assert.ok(validation.errors.some(error => error.field === field));
      }
    });
  }

  await t.test("空白 DOM 輸入", () => {
    const harness = createInputHarness(html, {
      mode: "mtx",
      contractSpecs: riskModel.CONTRACT_SPECS
    });
    harness.applyActiveMode();
    for (const id of ["v-idx", "v-eq", "v-im", "v-mm", "v-pv", "v-st", "v-ld"]) {
      harness.setValue(id, "");
    }
    const params = harness.getP();
    const validation = riskModel.validateRiskInputs({
      indexPrice: params.idx,
      equity: params.eq,
      initialMargin: params.im,
      maintenanceMargin: params.mm,
      pointValue: params.pv,
      stressPoints: params.st,
      extremeRate: params.ld
    });
    assert.equal(validation.valid, false);
    assert.equal(validation.errors.length, 7);
  });
});

test("超大 finite 輸入與派生溢位都安全失敗，不回傳 Infinity/NaN", async t => {
  const base = modelParams(CONTRACT_SPECS.tx);
  for (const field of Object.keys(base)) {
    await t.test(field, () => {
      const params = { ...base, [field]: 1e308 };
      assert.equal(riskModel.validateRiskInputs(params).valid, false);
      assert.equal(riskModel.calculateRiskSummary(params).valid, false);
      assert.equal(riskModel.calculatePosition(params, 9).valid, false);
    });
  }

  await t.test("單項皆 finite 但相乘超過 safe integer", () => {
    const params = {
      ...base,
      indexPrice: Number.MAX_SAFE_INTEGER / 2,
      pointValue: 3,
      stressPoints: 1
    };
    assert.equal(riskModel.validateRiskInputs(params).valid, true);
    assert.equal(riskModel.calculateRiskSummary(params).valid, false);
    assert.equal(riskModel.calculatePosition(params, 9).valid, false);
  });
});

test("初始保證金邊界使用 floor：剛好足夠可開，少 1 元即不可開", () => {
  const base = modelParams(CONTRACT_SPECS.tx);
  const exact = { ...base, equity: 10 * base.initialMargin };
  assert.equal(riskModel.calculateRiskSummary(exact).maximumContracts, 10);
  assert.equal(riskModel.calculatePosition(exact, 10).canOpen, true);
  assert.equal(riskModel.calculatePosition(exact, 11).canOpen, false);

  const oneDollarShort = { ...exact, equity: exact.equity - 1 };
  assert.equal(riskModel.calculateRiskSummary(oneDollarShort).maximumContracts, 9);
  assert.equal(riskModel.calculatePosition(oneDollarShort, 10).canOpen, false);

  const output = renderScenario(html, inlineParams(exact, riskModel.CONTRACT_SPECS.tx), { riskModel });
  assert.equal(output.rows[9].classList.contains("boundary-open"), true);
  assert.equal(output.rows[10].classList.contains("closed"), true);
});

test("30% / 50% / 70% 建議口數在 IEEE-754 精確邊界不會少算", () => {
  const exactBoundary = {
    ...modelParams(CONTRACT_SPECS.tmf),
    indexPrice: 1_000,
    equity: 350_500,
    stressPoints: 100
  };
  const exact = riskModel.calculateRiskSummary(exactBoundary);

  assert.equal(exact.valid, true);
  assert.equal(exact.maximumContracts, 10);
  assert.equal(exact.conservativeContracts, 3, "30% 邊界數學上可配置 3 口");
  assert.equal(exact.standardContracts, 5, "50% 邊界數學上可配置 5 口");
  assert.equal(exact.aggressiveContracts, 7, "70% 邊界數學上可配置 7 口");

  const oneDollarShort = riskModel.calculateRiskSummary({
    ...exactBoundary,
    equity: exactBoundary.equity - 1
  });
  assert.equal(oneDollarShort.valid, true);
  assert.equal(oneDollarShort.conservativeContracts, 2, "低於 30% 邊界 1 元不可進位");
  assert.equal(oneDollarShort.standardContracts, 4, "低於 50% 邊界 1 元不可進位");
  assert.equal(oneDollarShort.aggressiveContracts, 6, "低於 70% 邊界 1 元不可進位");
});

test("壓測安全口數同時受初始保證金上限約束，且使用 floor", () => {
  const base = modelParams(CONTRACT_SPECS.tx);
  const lowStress = riskModel.calculateRiskSummary({ ...base, stressPoints: 1 });
  assert.equal(lowStress.maximumContracts, 28);
  assert.equal(lowStress.stressSurvivableContracts, 28);

  const denominator = base.stressPoints * base.pointValue + base.maintenanceMargin;
  const fractional = riskModel.calculateRiskSummary({
    ...base,
    equity: 3 * denominator - 1
  });
  assert.equal(fractional.stressSurvivableContracts, 2);
});

test("壓測損失超過或恰好等於權益時標示權益耗盡", async t => {
  const base = {
    ...modelParams(CONTRACT_SPECS.tx),
    equity: 6_000_000,
    stressPoints: 30_000
  };
  for (const [label, equity] of [
    ["超過權益", base.equity - 1],
    ["權益歸零", base.equity]
  ]) {
    await t.test(label, () => {
      const params = { ...base, equity };
      const position = riskModel.calculatePosition(params, 1);
      assert.equal(position.valid, true);
      assert.ok(position.stressRemainingEquity <= 0);

      const output = renderScenario(html, inlineParams(params, riskModel.CONTRACT_SPECS.tx), { riskModel });
      assert.equal(output.text("s-sm"), "0 口");
      const stressCell = rowCells(output.rows[0])[4];
      assert.match(stressCell, /權益耗盡/);
      assert.doesNotMatch(stressCell, /低於維持/);
    });
  }
});

test("TX 9 口顯示層固定小數位與四捨五入，不把 floor 套到金額", () => {
  const params = modelParams(CONTRACT_SPECS.tx);
  const output = renderScenario(html, inlineParams(params, riskModel.CONTRACT_SPECS.tx), {
    pinned: [9],
    riskModel
  });
  const cells = rowCells(output.rows[8]);
  assert.equal(cells[1], "4.23x");
  assert.equal(cells[2], "8,421 pt");
  assert.equal(cells[3], "38,579");
  assert.equal(cells[4], "▼ 360.00 萬");
  assert.equal(cells[5], "18.00 萬");
  assert.equal(cells[6], "31.5%");
  assert.equal(cells[7], "1,369.10 萬");
});
