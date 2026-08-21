# 嘟嘟台指期槓桿計算機

[![Demo](https://img.shields.io/badge/🚀%20立即使用-hilarious--narwhal--c43429.netlify.app-2C6B2F?style=flat-square)](https://hilarious-narwhal-c43429.netlify.app/)
[![Version](https://img.shields.io/badge/version-v3.4.0-C9880C?style=flat-square)](https://hilarious-narwhal-c43429.netlify.app/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Visitors](https://hits.sh/zelda3121.github.io/dudu-futures.svg?style=flat-square&label=visitors&labelColor=192438&color=2C4A78)](https://hilarious-narwhal-c43429.netlify.app/)

> 台指期貨即時槓桿與風險計算工具，支援大台／小台／微台，適合個人交易者快速評估部位風險。

**🔗 Live Demo：[hilarious-narwhal-c43429.netlify.app](https://hilarious-narwhal-c43429.netlify.app/)**

---

## Features

| 功能 | 說明 |
|------|------|
| 🔢 **即時槓桿計算** | 依帳戶權益與口數，即時算出槓桿倍數、保證金使用率 |
| ⚠️ **維持保證金臨界估算** | 估算距維持保證金門檻的點數與臨界點位；實際通知與代沖銷依期貨商規定 |
| 🔥 **多單下跌壓力測試** | 自訂下跌情境，顯示各口數損失與是否低於維持保證金需求 |
| 📊 **比較分級** | 以本站自訂的槓桿／保證金使用率門檻，反推保守／標準／積極口數 |
| 🎯 **決策摘要** | 點選目標口數，一鍵顯示完整風險摘要 |
| ⚡ **壓測快捷鍵** | -1,000 / -2,000 / -3,000 / 近年最大一鍵套用 |
| 📉 **近年大跌排行** | TWSE 加權指數 2024 年以來單日收盤跌點 Top 10，可套用為壓測情境 |
| 💾 **設定自動保存** | localStorage 保存點位、權益、契約設定、壓測幅度與選取口數 |
| 🔄 **自動核對保證金** | 經同源 Netlify Function 讀取 TAIFEX 公告；逾時或格式異動時使用有日期的 fallback |
| 📱 **合約切換** | 大台（200元/點）／小台（50元/點）／微台（10元/點） |
| 💬 **仙門留言閣** | 以匿名仙俠道號留下改善建議或使用心得 |
| 🧾 **版本歷程** | 在站內查看版本、日期與每次更新內容 |
| ✦ **C 版天機推演** | 獨立修仙系統概念介面；靈石為 NTD 的 1:1 顯示代稱 |

---

## Tech Stack

- **Runtime**：Vanilla JS (ES2020+)
- **Styling**：CSS Custom Properties + CSS Grid/Flexbox
- **Storage**：localStorage（試算設定）+ Netlify Blobs（公開留言）
- **API**：Netlify Functions（TAIFEX 保證金同源代理、留言讀取／提交、匿名道號與頻率限制）
- **Data**：TAIFEX 契約規格與保證金公告；TWSE 每日收盤資料
- **Hosting**：Netlify
- **Visit counter**：[hits.sh](https://hits.sh)

---

## Architecture

```
index.html
├── <style>          # A／B 既有樣式與 C 版相容層
├── #app             # Full-page flex layout
│   ├── .hdr         # Header (tool name + live index)
│   ├── .mode-bar    # Contract type switcher (大台/小台/微台)
│   ├── .params      # 7-input param grid
│   ├── .hint-bar    # TAIFEX data status indicator
│   ├── .summ        # Summary cards (7 metrics + 3 risk modes)
│   ├── .decision-wrap # Selected lot decision summary
│   ├── .twrap       # Scrollable table (dynamic, capped at 1,000 rows)
│   └── footer.foot  # Legend + visit counter
└── <script>
    ├── Constants    # APP_VERSION, FALLBACK_MARGIN_DATE, HIST_DROPS
    ├── Utilities    # wan(), yi(), num(), readNumber()
    ├── State        # pinnedRows (Set), currentP, currentCv
    ├── render()     # Main render loop + validation states
    ├── localStorage # saveSettings() / loadSettings()
    ├── TAIFEX fetch # Same-origin /api/margins + dated fallback
    ├── Feedback UI # 留言抽屜、本機預覽與安全文字渲染
    └── init()       # Boot sequence
scripts/
└── risk-model.js    # Pure calculation and validation core
styles/
└── xianxia-v3.4.css # C 版天機法器設計系統、元件與動效
assets/
├── cultivation-bg-clean-v2.png # 仙山與天門主景
└── xianxia-v3.4/          # 書法、陣印、金玉框線與分隔素材
netlify/
├── functions/margins.mjs  # TAIFEX 保證金同源代理與解析
├── functions/comments.mjs # 留言 API、頻率限制與儲存
└── lib/feedback.mjs       # 匿名道號與文字清理
```

---

## Local Development

```bash
# Clone
git clone https://github.com/zelda3121/dudu-futures.git
cd dudu-futures

# Install and build
pnpm install
pnpm build

# Static preview (留言使用本機預覽資料)
python3 -m http.server 4173
```

根網址預設開啟 C 版；需要查看舊版時可使用 `?variant=a`，B 版則使用 `?variant=b`。

---

## Deployment

```bash
# Push to the Netlify-connected repository
git add .
git commit -m "vX.Y.Z: description"
git push origin main
```

---

## Changelog

| 版本 | 日期 | 主要變更 |
|------|------|----------|
| v3.4.0 | 2026-08-17 | C 版天機陣盤；完成 TX／MTX／TMF 公式 QA、TAIFEX 同源核對、Help UX、輸入驗證與人物安全分層 |
| v3.3.1 | 2026-08-14 | C 版加入水墨仙境背景、頁首靈石計價告示、金色傳音按鈕與靈晶天機點位 |
| v3.3.0 | 2026-08-14 | 新增獨立 C 版天機風險推演介面，導入深墨玉、鎏金、雲霧與靈石語彙 |
| v3.2.2 | 2026-08-14 | 依 TWSE 官方資料重算 2024 年以來單日收盤跌點 Top 10 |
| v3.2.1 | 2026-08-14 | 強化仙門留言入口，匿名道號改為出身地＋靈根＋修行身分 |
| v3.2.0 | 2026-08-14 | 新增仙門留言閣、匿名道號、留言安全限制與正式版本歷程 |
| v3.1.3 | 2026-08-12 | 更新大台／小台／微台初始與維持保證金（8/12 日盤收盤後生效） |
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
