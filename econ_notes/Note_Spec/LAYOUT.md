# 排版、元件與課堂互動

新章用現有 class。只有現有元件表達不了、且下一章也用得上時，才改共用 CSS。

## 1. 一頁的骨架（順序固定）

1. 頁眉 `.kicker`（版權／內部使用）
2. 章題 `h1`
3. 姓名／班別 `.meta`（兩欄輸入，列印用）
4. 目錄 `nav.toc`（節號連到 `#s…`）。執行期會被移到頂欄下一行，與工具列一起置頂。
5. **學習重點**（獨立 `section`，checkbox）
6. **各節** `<section id="s…">`
7. 可選：本章綜合小練習
8. **詞彙** `#sgl`
9. `.footer-note`

組裝器另外注入（不要寫進 body）：頂欄、點揭／畫筆提示、紙面框、SVG 畫層、加紙容器、分享面板。

## 2. 頂欄做甚麼（不要重做）

由左到右，語意固定：

| 控件 | 作用 |
|---|---|
| 返回首頁 | 帶當前 `lang` |
| 繁 / EN | 切換整頁 `.zh` / `.en` |
| 完整 / 填空 / 點揭 | 見下節 |
| 畫筆 / 加紙 | 書寫層；畫筆開才顯示色盤、擦膠、復原、清除 |
| 開啟教具 | 該章 lab（metadata `lab`） |
| 書本練習 / 書本答案 | 打開 PDF 筆記器；無檔則隱藏整組 |
| 列印 / 分享 | 瀏覽器列印；截圖後系統分享或下載 |

每章一個獨立 `inkKey`（例如 `econ-ch02-ink-v1`），避免筆跡互蓋。換章不要沿用舊 key。

Query：`?lang=`、`?mode=blank|click`。完整模式不要帶 `mode`。

## 3. 三種閱讀模式

| 模式 | body class | 行為 |
|---|---|---|
| 完整 | （無） | 所有 `.ans` 可見 |
| 填空 | `mode-blank` | `.ans` 文字透明、留下底線；不可點開 |
| 點揭 | `mode-click` | 預設同填空；點該格加 `.open` 顯示，再點藏起 |

畫筆開啟時不要處理點揭（避免搶點擊）。

填空／點揭時，官方框裡的答案要整段佔位（CSS 已處理），避免揭開前後把版面頂上來頂下去。

## 4. 畫筆、加紙、分享、列印

原則（實作已在共用 JS，新章不要改）：

- 墨水畫在筆記紙面座標的 SVG 上，跟文字同一層縮放。不要用蓋住視窗的 `position: fixed` canvas。
- 畫筆開：`touch-action: none`，不能 pinch-zoom、不能捲動當書寫。老師要放大請先關畫筆。
- 加紙：底部空白頁，有「空白頁 n」標籤；清除筆跡時空白頁保留。
- 分享：先選「目前畫面」或「整份筆記」，再系統分享（iPad 郵件）或下載。網站不代寄信。
- 列印：A4、隱藏頂欄／教具鈕／加紙區／分享；保留章節框線與填空底線；盡量不把 `.def` `.exam` `.tb-box` 表、圖、鏈從中間切斷。

PDF 課本練習是**另一頁**（`pdf_mark.html`），不是把 PDF 嵌進筆記。筆記頂欄只放連結。

## 5. 元件目錄：何時用哪一個

選元件時先問教學功能，再寫 HTML。

### 5.1 語意框

| class | 左邊線／色 | 何時用 | 不要用來 |
|---|---|---|---|
| `.def` | 橙 | 教科書定義、必須背的核心句 | 長解說、例子 |
| `.exam` | 藍 | 應試攻略、判準、易混對照 | 普通說明 |
| `.warn` | 紅 | 用詞陷阱、禁止寫法 | 一般注意事項（那用 `.exam`） |
| `.eg` | 灰框 | 課堂例子。標題用 `<strong class="lbl">` | 官方欄目（用 `.tb-box`） |
| `.think` | 橙邊白底 | 例題拆解的解題思路 | 應試攻略本身 |
| `.tb-box.tb-quiz` | 藍底標 | 小測試或課堂小練習／生活案例 | 定義 |
| `.tb-box.tb-guided` | 橙底標 | 例題拆解 | 短選擇題 |
| `.tb-box.tb-public` | 紫底標 | 公開試題 | 校本練習 |

### 5.2 對照與流程

| class | 何時用 |
|---|---|
| `.two` > `.card` | 兩個對立或平行概念（可加 `.micro` / `.macro` 頂色，或只當雙欄） |
| `.flow` + `.chip` + `.arrow` | **一條直線**、步驟少、不分流 |
| `.chain` | **一分為二再匯合**。結構：上起因 chip → 中 `.chain-row` 兩欄 → 下匯合 chip。中間可用 `.chip-start` `.chip-cost` `.chip-will` `.chip-out` 區分角色，但角色是視覺提示，不能省略課本中間格 |
| `table` | 多列比較、數字、選項價值。`th` 置中、`td` 靠左（CSS 已設） |
| `.illo` / `.illo-step` | 三步（或少數幾步）插圖敘事，中間 `.illo-arr` |
| `.scene` + `.cap` | 單圖 + 說明。對照兩句可用 `.scene-pair` |
| `.grid4` | 2×2 分類（窄屏變單欄） |

窄於筆記容器約 720px 時：`.two` `.illo` `.grid4` `.glossary` `.meta` 收成單欄。不要為某一章寫死寬度。

### 5.3 表與選擇語意（比較「選了哪項」時）

| class | 意思 |
|---|---|
| `.chosen` / `.tag.chosen` | 當下選了的方案 |
| `.forgone` / `.tag.forgone` | 被放棄且構成成本的那項 |
| `.other-opt` / `.tag.other` | 其他未構成成本的選項 |
| `td.lower` + `.cost-low` | 較低成本／較佳那格 |
| `.val-shift` | 數字或價值改變，需要學生看見「動了」 |
| `.keep-note` | 表下短註，提醒「這一格不要算進去」之類 |

沒有「選了／放棄了」語意的普通表，不要硬套這些 class。

### 5.4 其他

| class | 何時用 |
|---|---|
| `.tool-link` + `data-tool` | 跳到該章 lab 的某個 hash。正文裡放在剛教完的概念後 |
| `.check` | 學習重點 checkbox |
| `.glossary` | 章末詞彙兩欄 |
| `.q` / `.mark` / `.why` / `.tb-ans` | 練習題結構 |
| `.rank-opts` | 需要學生排序的選項清單 |
| `.case-q` | 案例裡要學生先停下來回答的問句 |
| `.paper-sheet` | 只由「加紙」腳本產生，不要手寫進 body |

## 6. HTML 骨架範例（內容是假的）

定義：

```html
<div class="def">
  <p class="zh" style="margin:0">……<span class="ans">關鍵詞</span>……</p>
  <p class="en" hidden style="margin:0">…<span class="ans">keyword</span>…</p>
</div>
```

課堂例子：

```html
<div class="eg">
  <strong class="lbl"><span class="zh">短題</span><span class="en" hidden>Short title</span></strong>
  <p class="zh">香港中四情境。……</p>
  <p class="en" hidden>HK Form 4 setting. …</p>
</div>
```

直線流程：

```html
<div class="flow">
  <span class="chip">A</span><span class="arrow">→</span>
  <span class="chip">B</span><span class="arrow">→</span>
  <span class="chip">C</span>
</div>
```

分叉鏈（格子文字跟該語文書，這裡只示結構）：

```html
<div class="chain">
  <span class="chip chip-start">起因</span>
  <div class="chain-arrs chain-row"><span>↓</span><span>↓</span></div>
  <div class="chain-row">
    <span class="chip chip-cost">左：機制</span>
    <span class="chip chip-cost">右：機制</span>
  </div>
  <div class="chain-arrs chain-row"><span>↓</span><span>↓</span></div>
  <div class="chain-row">
    <span class="chip chip-will">左：中間意欲／狀態</span>
    <span class="chip chip-will">右：中間意欲／狀態</span>
  </div>
  <div class="chain-arr">↓</div>
  <span class="chip chip-out">匯合結果</span>
</div>
```

教具鈕：

```html
<a class="tool-link" data-tool="widget-id" href="#">
  <span class="zh">教具：短名</span><span class="en" hidden>Lab: short name</span>
</a>
```

`href` 會被筆記腳本改成 `lab?lang=…#widget-id`。`data-tool` 必須等於 lab 裡的工具 id。

單圖：

```html
<div class="scene">
  <img src="img/chXX-topic.jpg" alt="" width="640" height="360">
  <p class="cap"><span class="zh">說明</span><span class="en" hidden>Caption</span></p>
</div>
```

`alt` 可空（說明已在 `.cap`）。寬高只作版面提示；實際高度受 `--illo-max-h` 限制，避免一張圖吃掉半屏。

## 7. Markdown 方言（新章若用 `.md`）

組裝器認得：

- 標題：`## 2.1 中文 | English {#s21}`（`h2` 開新 `section`）
- 段：`zh:` / `en:` 成對
- `:::def` `:::exam` `:::warn` `:::eg` 內用 `zh:` / `en:`
- `:::drill 2.1` 內多個 `:::q`，欄位：`mark_zh` `mark_en` `q_zh` `q_en` `a_zh` `a_en` `why_zh` `why_en`
- `[[答案]]`、`[[wide: 長答案]]`、`**粗體**`
- `:::html`：複雜表、插圖、`.chain`、官方 `.tb-box` 用這個貼 HTML

官方欄目、分叉鏈、多列表 **用 `:::html`**，不要硬用 drill 方言去模擬。

`draft: true` 的 md 不會輸出。複製 starter 後要刪掉。

## 8. 視覺常數（不要章內覆寫）

共用色：主色藍、定義橙、警告紅、成功綠、公開試題紫。背景淺灰、卡片白、字深 slate。圓角約 12px。正文字級跟系統 UI 字型、行高約 1.7。

頂欄橫向可捲，不要改成多行大漢堡選單，除非老師要求改全站。
