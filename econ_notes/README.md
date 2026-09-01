# 課堂筆記：之後怎樣改

完整規格（設計意念、用字、排版、教具、工序）在 **[Note_Spec/README.md](Note_Spec/README.md)**。新開一章或改格式，先讀那份。

**不要**手改組裝出來的 `econ_notes/chXX_*.html`。改 `src/`，跑組裝，用瀏覽器預覽。

## 每天改現有章

1. 打開該章 `econ_notes/src/chXX.body.html` 或 `src/chXX_*.md`。
2. 中英成對：`<p class="zh">` / `<p class="en" hidden>`。填空用 `<span class="ans">`，長空加 `wide`。
3. 專案根目錄：`node econ_notes/build.mjs`（或 `npm run notes`）。
4. `python -m http.server 8765`，打開 `http://localhost:8765/econ_notes/該檔.html`。不要雙擊檔案。
5. 檢查繁／EN、填空、點揭、畫筆、列印。只有老師說「發布」才 push。

## 新開一章（Markdown）

1. 複製 `src/chapter.starter.md`。
2. 刪 `draft: true`。設 `out`、`inkKey`（每章一個）、標題與 toc。
3. 方言見 Note_Spec 的 LAYOUT.md。複雜表／官方框／分叉鏈用 `:::html`。
4. Build 後在 `index.html` 加卡片。

## 不要提交

`_tmp_*`、課本掃描、`econ_tools/deposit_creation.html`、座位表同步腳本。
