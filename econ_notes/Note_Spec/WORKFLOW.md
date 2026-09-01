# 檔案、組裝、預覽與發布

## 1. 誰管甚麼

| 路徑 | 作用 | 誰改 |
|---|---|---|
| `econ_notes/src/chXX.body.html` 或 `src/chXX_*.md` | 內文（唯一手改來源） | 寫章時 |
| `econ_notes/src/chXX.json` | 輸出檔名、`inkKey`、標題、lab、書本 PDF | 寫章時 |
| `econ_notes/src/chapter.starter.md` | 新章 Markdown 範本 | 只複製，不拿來當內容庫 |
| `econ_notes/lib/notes.css` `notes.js` | 全章外觀與互動 | 全站行為才改 |
| `econ_notes/lib/ink-layer.js` `visual-chrome.js` | 畫筆、頂欄鎖在可視區 | 不要為單章改 |
| `econ_notes/build.mjs` | 組裝殼 | 全站殼才改 |
| `econ_notes/chXX_*.html` | 組裝結果 | **不要手改** |
| `econ_notes/img/` | 插圖 | 凍結；老師要求才加 |
| `econ_notes/tb/` | 書本練習／答案 PDF | 該章有才加 |
| `econ_notes/pdf_mark.html` 及 `lib/pdf_mark.*` | PDF 筆記器 | 全站工具，不按章分叉 |
| `econ_tools/chXX_lab.html` | 該章互動教具 | 按 TOOLS.md |
| `index.html` | 首頁卡片 | 新章加一張；中英 i18n 都要加 |

**不要提交、不要當素材庫改：** `_tmp_*`（課本掃描）、`econ_tools/deposit_creation.html`、座位表同步腳本。

課本掃描若本機有：`_tmp_chXX_chi/zh_pNN.png`、`eng/pNN.png`。**PNG 頁碼 = 印刷頁碼。** 用來對用字，不上網。

## 2. 每天改一章

1. 只改 `src/`（及必要時該章 lab、`index.html` 卡片）。
2. `node econ_notes/build.mjs`（或 `npm run notes`）。
3. `python -m http.server 8765`，瀏覽器開 `http://localhost:8765/econ_notes/chXX_….html`。不要雙擊檔案。
4. 實際點過：繁／EN、填空、點揭、畫筆、有改過的框與表、教具連結、書本練習（若有）。
5. 只有老師說 **「發布」** 才 commit + push。

改了 `src/` 卻忘記 build，網上仍是舊組裝檔。

## 3. 新開一章

1. 讀 Note_Spec 全套 + 該章中英課本。
2. 複製 `chapter.starter.md` → `src/chXX_….md`，或新開 `chXX.body.html` + `chXX.json`。HTML body 適合已有複雜表與官方框的章；Markdown 適合結構較乾淨的新章。兩種不要混用同一章。
3. 刪 `draft: true`。設 `out`、`inkKey`（新的）、中英標題、`lab`、可選 `tbExZh` 等。
4. 寫學習重點 → 按書的節序寫內文 → 官方框按中文書頁序插入。
5. 需要教具才開 `chXX_lab.html`，hash id 與 `data-tool` 一致。
6. Build。在 `index.html` 對應科目／年級下加卡片（中英 `data-i18n` 各一組字串）。
7. 走 CHECKLIST.md。
8. 等「發布」。只加筆記／該章 lab／img／tb／首頁相關檔。

JSON 常用欄（名稱保持這個樣子）：

- `out` `body` `inkKey`
- `titleZh` `titleEn` `heading` 若走 md 則在 frontmatter
- `filePrefix` `shareZh` `shareEn`（分享檔名與句子）
- `lab`
- `tbExZh` `tbAnsZh` `tbExEn` `tbAnsEn`（相對 `econ_notes/`，形如 `tb/Ch02_chi_TbEx.pdf`）

## 4. 首頁卡片

放在正確科目（ECON／BAFS）與年級底下。結構與現有 tool-card 相同：名稱、一句說明（該章課題，不要寫實作細節）、標籤（科目、Notes、Printable）、Enter 連到組裝後的 html。

說明要中英都加 i18n key，不要只寫一種語言。

## 5. 預覽與現場網址

- 本機：`http://localhost:8765/…`
- 已發布站：Vercel 上的專案網址（不是 GitHub Pages）。老師說發布 = commit 到 `main` 後由 Vercel 部署。
- 解鎖、PWA、離線副本是全站的。新章會自動進離線清單的前提是：有人把該章 url 加進離線打包名單。若你加了新章，記得檢查 `lib/offline-pack.js` 的清單是否要加新 HTML／圖／PDF；不要順便重寫離線策略。

## 6. 發布範圍

老師說「發布」才：

- `git add` 筆記相關檔（src、組裝 html、lib 若你改了共用殼、lab、img、tb、index、離線清單若有新章）
- 不要 add `_tmp_*`、`Note_Spec` 以外老師沒要的暫存、`deposit_creation.html`、座位表腳本
- commit 訊息用中文、寫為何（例如「發布第 2 章課堂筆記」）
- `git push` 到 `main`

未說發布：只留在工作區。

## 7. 禁止改動的鄰近系統

| 東西 | 原因 |
|---|---|
| `econ_tools/deposit_creation.html` | 已完成的獨立教具，筆記對話不要重開 |
| `_tmp_*` | 本地掃描與 OCR 暫存 |
| 座位表同步腳本 | 另一條工作線 |
| 全站 `sw.js` / 解鎖 / PWA 文案 | 除非任務就是改全站安裝或離線 |

## 8. Markdown 與 HTML 擇一

同一章不要又有 json+body 又有 md 輸出到同一 `out`。組裝器會讀 `src/` 下所有非 draft 的 json 與 md。
