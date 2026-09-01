# 課堂筆記：之後怎樣改

格式與課堂演示的完整規格見 **[SPEC.md](SPEC.md)**。第 2 章起先讀那份，再改內文。

以後**不要**直接改 `ch01_basic_concepts.html`。那份是組裝出來給網站用的。你改內文、跑一句指令、用瀏覽器預覽。

## 每天改第 1 章

1. 用 Cursor 打開 `econ_notes/src/ch01.body.html`。裡面只有筆記正文（定義、例子、練習、插圖），沒有畫筆／列印／分享的程式。
2. 中英仍然成對出現：

```html
<p class="zh">中文句子。</p>
<p class="en" hidden>English sentence.</p>
```

3. 填空答案包在 `<span class="ans">...</span>`。較長的空用 `class="ans wide"`。
4. 存檔後在專案根目錄執行：

```bash
node econ_notes/build.mjs
```

或 `npm run notes`。這會覆寫 `econ_notes/ch01_basic_concepts.html`。
5. 本機預覽（專案根目錄）：

```bash
python -m http.server 8765
```

瀏覽器打開 `http://localhost:8765/econ_notes/ch01_basic_concepts.html`。一定要過這個伺服器開，不要直接雙擊檔案（否則插圖和共用 CSS 可能載不到）。
6. 檢查：繁／EN、填空、點揭、畫筆、列印。通過後才發布。

## 檔案各管甚麼

| 你改這個 | 作用 |
|---|---|
| `src/ch01.body.html` | 第 1 章內文 |
| `src/ch01.json` | 頁面標題、筆跡儲存 key、教具連結 |
| `img/*.jpg` | 插圖（凍結，見下） |
| `lib/notes.css` | 所有筆記共用外觀 |
| `lib/notes.js` | 語言、填空、畫筆、分享 |
| `build.mjs` | 把內文裝進共用殼 |

`ch01_basic_concepts.html` 只給 GitHub Pages 用。改了 `src/` 卻忘記 build，網站還是舊的。

## 插圖規則

- 圖放 `econ_notes/img/`，說明文字寫在 HTML，不要燒進圖裡。
- 同一段例子用同一套畫風。新圖只在沒有現成圖、且你明確要求時才做。
- 女生頭髮預設及肩，不要馬尾（除非你另說）。
- 不要把課本插圖或原文整段放上網。例子用香港中四生活情境改寫。

## 新開一章（Markdown）

第 2 章起可以不再寫一大頁 HTML：

1. 複製 `src/chapter.starter.md` 成例如 `src/ch02_demand.md`。
2. 刪掉檔案頂的 `draft: true`。
3. 改 frontmatter 的標題、`out:`（輸出檔名）、`inkKey:`（每章一個，避免筆跡互蓋）。
4. 用下面語法寫正文，複雜表／插圖用 `:::html`。
5. `node econ_notes/build.mjs`，再在 `index.html` 加一張連到新頁的卡片。

```markdown
## 1.1 中文標題 | English title {#s11}

:::def
zh: 經濟學是一門[[社會科學]]。
en: Economics is a [[social science]].
:::

zh: 普通段落：中文一行。
en: Ordinary paragraph: English one line.

:::drill 1.1
:::q
mark_zh: 題 1
mark_en: Q1
q_zh: 題目
q_en: Question
a_zh: 答案
a_en: answer
why_zh: 為甚麼
why_en: Why
:::
:::
```

較長填空：`[[wide: 最高價值的被放棄選項]]`。

## 發布

只有你說「發布」才把筆記相關檔 push 到 GitHub。不要一併提交 `_tmp_*`、`econ_tools/deposit_creation.html`，或座位表同步腳本。
