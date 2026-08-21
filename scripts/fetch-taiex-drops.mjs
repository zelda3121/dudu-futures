// 預設重建 UI 公開標示的 2024 年以來資料；可傳入起、迄年做更長區間的分段稽核。
const requestedStartYear = Number.parseInt(process.argv[2] || "2024", 10);
const requestedEndYear = Number.parseInt(process.argv[3] || String(new Date().getFullYear()), 10);
const startYear = Number.isFinite(requestedStartYear) ? Math.max(2004, requestedStartYear) : 2024;
const now = new Date();
const endYear = Number.isFinite(requestedEndYear)
  ? Math.min(now.getFullYear(), Math.max(startYear, requestedEndYear))
  : now.getFullYear();
const months = [];

for (let year = startYear; year <= endYear; year += 1) {
  const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  for (let month = 1; month <= lastMonth; month += 1) {
    months.push(`${year}${String(month).padStart(2, "0")}01`);
  }
}

function westernDate(rocDate) {
  const [year, month, day] = rocDate.split("/").map(Number);
  return `${year + 1911}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const rows = [];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchMonth(date) {
  const url = `https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date=${date}&response=json`;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "dudu-futures-data-check/3.2" } });
    if (response.ok) return response.json();
    if (![307, 429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`TWSE ${date}: HTTP ${response.status}`);
    }
    await wait(1200 * (attempt + 1));
  }
  throw new Error(`TWSE ${date}: retry limit reached`);
}

for (const date of months) {
  const payload = await fetchMonth(date);
  if (payload.stat !== "OK") throw new Error(`TWSE ${date}: ${payload.stat}`);

  for (const item of payload.data || []) {
    const close = Number(String(item[4]).replaceAll(",", ""));
    const change = Number(String(item[5]).replaceAll(",", ""));
    if (!Number.isFinite(close) || !Number.isFinite(change) || change >= 0) continue;
    const previousClose = close - change;
    rows.push({
      date: westernDate(item[0]),
      close,
      points: Math.abs(change),
      pct: Math.abs(change) / previousClose * 100
    });
  }
  await wait(240);
}

const top = rows.sort((a, b) => b.points - a.points).slice(0, 20);
console.log(JSON.stringify({
  source: "TWSE FMTQIK",
  range: `${startYear}-01-01..${endYear === now.getFullYear() ? now.toISOString().slice(0, 10) : `${endYear}-12-31`}`,
  checkedThrough: now.toISOString().slice(0, 10),
  top
}, null, 2));
