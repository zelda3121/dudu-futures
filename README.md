# 嘟嘟台指期槓桿計算機

[![GitHub Pages](https://img.shields.io/badge/Live-GitHub%20Pages-2C4A78?style=flat-square&logo=github)](https://zelda3121.github.io/dudu-futures/)
[![Version](https://img.shields.io/badge/version-v3.1.2-C9880C?style=flat-square)](https://zelda3121.github.io/dudu-futures/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Visitors](https://hits.sh/zelda3121.github.io/dudu-futures.svg?style=flat-square&label=visitors&labelColor=192438&color=2C4A78)](https://zelda3121.github.io/dudu-futures/)

> 台指期貨即時槓桿與風險計算工具，支援大台／小台／微台，適合個人交易者快速評估部位風險。

**🔗 Live Demo：[zelda3121.github.io/dudu-futures](https://zelda3121.github.io/dudu-futures/)**

---

## Features

| 功能 | 說明 |
|------|------|
| 🔢 **即時槓桿計算** | 依帳戶權益與口數，即時算出槓桿倍數、保證金使用率 |
| ⚠️ **追繳風險點位** | 計算距追繳線剩餘點數與觸發指數點位 |
| 🔥 **壓力測試** | 自訂跌幅情境，顯示各口數損失金額與爆倉/追繳狀態 |
| 📊 **風控建議** | 保守／標準／積極三種模式，反推建議最大口數 |
| 🎯 **決策摘要** | 點選目標口數，一鍵顯示完整風險摘要 |
| ⚡ **壓測快捷鍵** | -1,000 / -2,000 / -3,000 / 歷史最大一鍵套用 |
| 📉 **歷史大跌排行** | Top 10 台指單日跌幅，點擊直接套用壓測情境 |
| 💾 **設定自動保存** | localStorage 保存指數、權益、壓測幅度、選取口數 |
| 🔄 **自動抓取保證金** | 嘗試從 TAIFEX 官網抓取最新保證金，失敗自動 fallback |
| 📱 **合約切換** | 大台（200元/點）／小台（50元/點）／微台（10元/點） |

---

## Screenshot

![嘟嘟台指期槓桿計算機](https://zelda3121.github.io/dudu-futures/screenshot.png)

---

## Tech Stack

```
純前端，零依賴，單一 HTML 檔案即可運行
```

- **Runtime**：Vanilla JS (ES2020+)
- **Styling**：CSS Custom Properties + CSS Grid/Flexbox
- **Storage**：localStorage (client-side only)
- **Data**：TAIFEX 保證金頁面（CORS fetch，有 fallback）
- **Hosting**：GitHub Pages
- **Visit counter**：[hits.sh](https://hits.sh)
- **Bundle size**：~40 KB（無任何 npm 套件）

---

## Architecture

```
index.html
├── <style>          # CSS variables (dark premium theme)
├── #app             # Full-page flex layout
│   ├── .hdr         # Header (tool name + live index)
│   ├── .mode-bar    # Contract type switcher (大台/小台/微台)
│   ├── .params      # 7-input param grid
│   ├── .hint-bar    # TAIFEX data status indicator
│   ├── .summ        # Summary cards (7 metrics + 3 risk modes)
│   ├── .decision-wrap # Selected lot decision summary
│   ├── .twrap       # Scrollable table (100 rows)
│   └── footer.foot  # Legend + visit counter
└── <script>
    ├── Constants    # APP_VERSION, FALLBACK_MARGIN_DATE, HIST_DROPS
    ├── Utilities    # wan(), yi(), num(), readNumber()
    ├── State        # pinnedRows (Set), currentP, currentCv
    ├── render()     # Main render loop (1–100 lots)
    ├── localStorage # saveSettings() / loadSettings()
    ├── TAIFEX fetch # fetchTaifexMargins() + parseMargins()
    └── init()       # Boot sequence
```

---

## Local Development

```bash
# Clone
git clone https://github.com/zelda3121/dudu-futures.git
cd dudu-futures

# Open directly in browser — no build step required
open index.html
```

---

## Deployment

```bash
# Update and push to GitHub Pages
git add index.html
git commit -m "vX.Y.Z: description"
git push origin main
```

GitHub Pages 設定：**Settings → Pages → Branch: main / (root)**

---

## Changelog

| 版本 | 日期 | 主要變更 |
|------|------|----------|
| v3.1.2 | 2026-07-07 | 表格上限從 50 口擴展至 100 口 |
| v3.1.1 | 2026-07-07 | 訪客計數改用 hits.sh badge |
| v3.1.0 | 2026-07-07 | 決策摘要區、保守/標準/積極風控建議、壓測快捷按鈕、localStorage、readNumber 防呆 |
| v3.0.0 | 2026-07-07 | 欄位重排、壓測後損失資金、每訪客計數器（初版） |
| v2.9.0 | 2026-07-02 | 單行 Header、黑金模式切換、紅色危險欄框、歷史大跌 Modal |

---

## Disclaimer

> 本工具數據**僅供試算與風險教育用途**，不構成投資建議。
> 保證金數字來源：[TAIFEX 臺灣期貨交易所](https://www.taifex.com.tw/cht/5/indexMarging)，顯示數字可能與最新公告有落差，使用前請自行確認。
> 作者對因使用本工具產生之任何損失不負任何法律責任。

---

## License

MIT © Sammy Hsu
