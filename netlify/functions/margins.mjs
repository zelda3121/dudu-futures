const TAIFEX_MARGIN_URL = "https://www.taifex.com.tw/cht/5/indexMarging";
const PRODUCT_PATTERNS = {
  tx: /^(?:臺股期貨|台股期貨)$/,
  mtx: /^(?:小型臺指|小型台指)$/,
  tmf: /^(?:微型臺指期貨|微型台指期貨)$/
};

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function numberFromCell(value) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseTaifexMarginHtml(html) {
  const contracts = {};
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(match => decodeHtml(match[1]));
    if (cells.length < 4) continue;

    const [name, , maintenanceCell, initialCell] = cells;
    const initialMargin = numberFromCell(initialCell);
    const maintenanceMargin = numberFromCell(maintenanceCell);
    if (!initialMargin || !maintenanceMargin || initialMargin < maintenanceMargin) continue;

    for (const [key, pattern] of Object.entries(PRODUCT_PATTERNS)) {
      if (pattern.test(name)) {
        contracts[key] = { initialMargin, maintenanceMargin };
        break;
      }
    }
  }

  const dateMatch = String(html).match(/更新日期[^0-9]*(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  const updatedAt = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
    : null;

  return Object.keys(contracts).length === 3 ? { contracts, updatedAt } : null;
}

function json(body, status = 200, cache = "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400") {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": cache,
      "x-content-type-options": "nosniff"
    }
  });
}

export default async request => {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, "no-store");

  try {
    const response = await fetch(TAIFEX_MARGIN_URL, {
      headers: { accept: "text/html", "user-agent": "dudu-futures-margin-check/3.4" },
      signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) throw new Error(`TAIFEX HTTP ${response.status}`);
    const parsed = parseTaifexMarginHtml(await response.text());
    if (!parsed) throw new Error("TAIFEX margin table format changed");
    return json({ ...parsed, source: TAIFEX_MARGIN_URL });
  } catch (error) {
    return json({ error: "目前無法取得 TAIFEX 保證金資料。", detail: error.message }, 502, "no-store");
  }
};

export const config = { path: "/api/margins" };
