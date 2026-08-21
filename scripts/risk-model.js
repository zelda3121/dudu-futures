(function attachDuduRiskModel(root) {
  'use strict';

  const CONTRACT_SPECS = Object.freeze({
    tx: Object.freeze({
      symbol: 'TX',
      name: '臺股期貨',
      pointValue: 200,
      initialMargin: 701000,
      maintenanceMargin: 538000
    }),
    mtx: Object.freeze({
      symbol: 'MTX',
      name: '小型臺指期貨',
      pointValue: 50,
      initialMargin: 175250,
      maintenanceMargin: 134500
    }),
    tmf: Object.freeze({
      symbol: 'TMF',
      name: '微型臺指期貨',
      pointValue: 10,
      initialMargin: 35050,
      maintenanceMargin: 26900
    })
  });

  const INPUT_FIELDS = Object.freeze([
    ['indexPrice', '台指期推演點位'],
    ['equity', '帳戶權益'],
    ['initialMargin', '原始保證金'],
    ['maintenanceMargin', '維持保證金'],
    ['pointValue', '每點價值'],
    ['stressPoints', '壓力測試跌點'],
    ['extremeRate', '極端情境幅度']
  ]);

  function validationError(field, message) {
    return { field, message };
  }

  function validateRiskInputs(input) {
    const errors = [];

    for (const [field, label] of INPUT_FIELDS) {
      const value = input?.[field];
      if (!Number.isFinite(value)) {
        errors.push(validationError(field, `${label}必須是有限數字`));
      }
    }
    if (errors.length) return { valid: false, errors };

    const positiveFields = INPUT_FIELDS.filter(([field]) => field !== 'stressPoints');
    for (const [field, label] of positiveFields) {
      if (input[field] <= 0) errors.push(validationError(field, `${label}必須大於 0`));
    }
    if (input.stressPoints <= 0) {
      errors.push(validationError('stressPoints', '壓力測試跌點必須大於 0'));
    }
    if (input.stressPoints > input.indexPrice) {
      errors.push(validationError('stressPoints', '壓力測試跌點不可高於目前推演點位'));
    }
    if (input.extremeRate > 0.5) {
      errors.push(validationError('extremeRate', '極端情境幅度不可高於 50%'));
    }
    if (input.maintenanceMargin > input.initialMargin) {
      errors.push(validationError('maintenanceMargin', '維持保證金不可高於原始保證金'));
    }

    for (const [field, label] of INPUT_FIELDS) {
      if (Math.abs(input[field]) > Number.MAX_SAFE_INTEGER) {
        errors.push(validationError(field, `${label}超出可安全計算範圍`));
      }
    }

    return { valid: errors.length === 0, errors };
  }

  function finiteResults(values) {
    return Object.values(values).every(value => Number.isFinite(value));
  }

  function invalidCalculation() {
    return {
      valid: false,
      errors: [validationError('general', '輸入數值過大，無法安全完成風險推演')]
    };
  }

  // Financial thresholds often land mathematically on an integer but binary
  // floating point can represent that value as 6.999999999999999. Snap only
  // machine-error-sized differences; genuinely underfunded values still floor.
  function floorAtIntegerBoundary(value) {
    const nearest = Math.round(value);
    const tolerance = Math.min(
      1e-7,
      Number.EPSILON * Math.max(1, Math.abs(value)) * 8
    );
    return Math.floor(Math.abs(value - nearest) <= tolerance ? nearest : value);
  }

  function policyContracts(params, notionalPerContract, maximumContracts, leverageCap, marginCap) {
    const byLeverage = floorAtIntegerBoundary(params.equity * leverageCap / notionalPerContract);
    const byMargin = floorAtIntegerBoundary(params.equity * marginCap / params.initialMargin);
    return Math.max(0, Math.min(maximumContracts, byLeverage, byMargin));
  }

  function calculateRiskSummary(params) {
    const validation = validateRiskInputs(params);
    if (!validation.valid) return validation;

    const notionalPerContract = params.indexPrice * params.pointValue;
    const extremeScenarioLossPerContract = notionalPerContract * params.extremeRate;
    const maximumContracts = Math.max(0, floorAtIntegerBoundary(params.equity / params.initialMargin));
    const stressCostPerContract = params.stressPoints * params.pointValue + params.maintenanceMargin;
    const stressSurvivableContracts = Math.max(
      0,
      Math.min(maximumContracts, floorAtIntegerBoundary(params.equity / stressCostPerContract))
    );
    const conservativeContracts = policyContracts(params, notionalPerContract, maximumContracts, 4, 0.30);
    const standardContracts = policyContracts(params, notionalPerContract, maximumContracts, 6, 0.50);
    const aggressiveContracts = policyContracts(params, notionalPerContract, maximumContracts, 8, 0.70);

    const values = {
      notionalPerContract,
      extremeScenarioLossPerContract,
      maximumContracts,
      stressCostPerContract,
      stressSurvivableContracts,
      conservativeContracts,
      standardContracts,
      aggressiveContracts
    };
    if (!finiteResults(values) || Object.values(values).some(value => Math.abs(value) > Number.MAX_SAFE_INTEGER)) {
      return invalidCalculation();
    }
    return { valid: true, errors: [], ...values };
  }

  function calculatePosition(params, contracts) {
    const validation = validateRiskInputs(params);
    if (!validation.valid) return validation;
    if (!Number.isSafeInteger(contracts) || contracts <= 0) {
      return {
        valid: false,
        errors: [validationError('contracts', '契約口數必須是大於 0 的安全整數')]
      };
    }

    const notionalPerContract = params.indexPrice * params.pointValue;
    const totalNotional = notionalPerContract * contracts;
    const leverage = totalNotional / params.equity;
    const initialMarginUsed = params.initialMargin * contracts;
    const initialMarginUsagePct = initialMarginUsed / params.equity * 100;
    const pnlPer100Points = contracts * params.pointValue * 100;
    const stressLoss = contracts * params.pointValue * params.stressPoints;
    const availableBalance = params.equity - initialMarginUsed;
    const maintenanceRequirement = params.maintenanceMargin * contracts;
    const maintenanceBuffer = params.equity - maintenanceRequirement;
    const lossPerPoint = contracts * params.pointValue;
    const maintenanceDistancePoints = maintenanceBuffer / lossPerPoint;
    const maintenanceThresholdPrice = params.indexPrice - maintenanceDistancePoints;
    const stressRemainingEquity = params.equity - stressLoss;

    const values = {
      contracts,
      notionalPerContract,
      totalNotional,
      leverage,
      initialMarginUsed,
      initialMarginUsagePct,
      pnlPer100Points,
      stressLoss,
      availableBalance,
      maintenanceRequirement,
      maintenanceBuffer,
      lossPerPoint,
      maintenanceDistancePoints,
      maintenanceThresholdPrice,
      stressRemainingEquity
    };
    if (!finiteResults(values) || Object.values(values).some(value => Math.abs(value) > Number.MAX_SAFE_INTEGER)) {
      return invalidCalculation();
    }

    return {
      valid: true,
      errors: [],
      ...values,
      canOpen: initialMarginUsed <= params.equity,
      stressMeetsMaintenance: stressRemainingEquity >= maintenanceRequirement
    };
  }

  root.DuduRiskModel = Object.freeze({
    CONTRACT_SPECS,
    validateRiskInputs,
    calculateRiskSummary,
    calculatePosition
  });
})(globalThis);
