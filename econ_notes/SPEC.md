# 課堂筆記規格

第 1 章是示範。之後每一章都跟這份規格，才會有同一套課堂演示：填空／點揭、中英切換、畫筆、列印、分享。

對齊課本：**UPEP《Economics in Action》／《活用經濟學》**。中文版與英文版**不是互譯**；中文筆記跟中文書，英文筆記跟英文書。

---

## 1. 檔案與工作流程

| 檔案 | 作用 |
|---|---|
| `econ_notes/src/chXX.body.html` 或 `src/chXX_*.md` | 內文（唯一手改來源） |
| `econ_notes/src/chXX.json` | 標題、`inkKey`、教具連結 |
| `econ_notes/lib/notes.css` / `notes.js` | 全章共用外觀與互動 |
| `econ_notes/build.mjs` | 組裝 |
| `econ_notes/chXX_*.html` | 組裝結果；**不要手改** |
| `econ_notes/img/` | 插圖（凍結） |
| `index.html` | 首頁卡片；新章要加一張 |

每天改一章：

1. 只改 `src/`（及必要時 `lib/`）。
2. `node econ_notes/build.mjs`（或 `npm run notes`）。
3. `python -m http.server 8765`，用瀏覽器開  
   `http://localhost:8765/econ_notes/chXX_….html`  
   （不要雙擊檔案。）
4. 檢查：繁／EN、填空、點揭、畫筆、列印；改過的區塊要實際點過。
5. 只有老師說 **「發布」** 才 commit + push。

**不要提交：** `_tmp_*`、課本掃描、`econ_tools/deposit_creation.html`、座位表同步腳本。

課本掃描（若本機有）：`_tmp_chXX_chi/zh_pNN.png`、`eng/pNN.png`。**PNG 頁碼 = 印刷頁碼。** 改英文用字時，先對英文書原文；書沒有才自譯。

---

## 2. 一頁筆記的骨架

順序固定：

1. **頁眉 kicker**（版權／內部使用聲明）
2. **章題** `h1`
3. **姓名／班別** `.meta`
4. **目錄** `.toc`（節號連到 `#s11` 這類 id）。畫面會把這列移到頂部工具列下一行，兩行一齊置頂。
5. **學習重點**（checkbox，對齊該章考點）
6. **各節** `<section id="s…">`：定義 → 說明 → 插圖／表 → 應試攻略 → 課堂例子 → 教具連結 → 練習／課本欄目
7. **詞彙** `#sgl`

頁眉（一字不改，英文兩行）：

```html
<p class="kicker">
  <span class="zh">HTMS 經濟科課堂筆記 | 編輯：Mr. Sam Wong | 重要聲明：本課堂筆記僅供已購買課本之學生使用，並僅限內部參考。</span>
  <span class="en" hidden>HTMS Economics Lesson Notes | Editor: Mr. Sam Wong<br>Important: These lesson notes are intended only for students who have purchased the textbook and are for internal use only.</span>
</p>
```

`.kicker` **不要** `text-transform: uppercase`。

頂欄按鈕（已在 `build.mjs`）：返回、繁／EN、完整／填空／點揭、畫筆／加紙、開啟教具、列印／分享。新章不必重做頂欄。

每章一個獨立 `inkKey`（例如 `econ-ch02-ink-v1`），避免筆跡互蓋。

---

## 3. 雙語

每個可見中文塊都要有英文 twin。兩種寫法都可以：

```html
<p class="zh">中文。</p>
<p class="en" hidden>English.</p>
```

```html
<span class="zh">中文</span><span class="en" hidden>English</span>
```

列表用 **整條 `li` 切語言**，不要把中英塞進同一顆子彈：

```html
<ul>
  <li class="zh">中文點</li>
  <li class="en" hidden>English bullet</li>
</ul>
```

填空：`<span class="ans">…</span>`；較長答案加 `wide`。練習解釋用 `.why.zh` / `.why.en`。

---

## 4. 用字：哪些照抄課本，哪些課堂改寫

| 內容 | 規則 |
|---|---|
| **小測試 Quiz、例題拆解 Guided Example、公開試題 Public Exam** | **照抄該語文課本**（題幹、選項、人名、專有名詞）。中文題用中文書；英文題用英文書（可保留 *office ladies* 這類書內用字）。 |
| **應試攻略 Exam Tips** | 標題與要點跟該語文書；可加課堂例子，但準則用字先跟書。 |
| **定義框** | 核心定義跟書；課堂解說可用自己的句子。 |
| **小練習、生活案例、課堂例子** | **不要**整段抄課本個案。用香港中四生活情境改寫。計算結構可跟書（車資／所放棄的收入／全部成本／成本較低）。 |
| **解題思路** | 課堂自製，放在例題拆解的題目之後、答案之前。中文標題「解題思路」；英文 *Thinking process*。步驟用書內術語（如 *highest-valued option forgone*、Watch Out）。 |

**中英不是互譯。** 改英文本，先打開英文書該頁；沒有對應段才自譯。書若有明顯文法（如 *depend*），優先跟書。

**量詞／用字要準：** 羽毛球場是「一個」不是「一條」；不要寫 scare／「資源不能滿足」（應寫「不足以」）。

---

## 5. 人名

課堂自製內容用這套（中英成對）：

| 中文 | English |
|---|---|
| 樂澄 | Chloe |
| 欣怡 | Yan |
| 文諾 | Marcus |
| 家明 | Ka Ming |
| 梓柔 | Tsz Yau |
| 嘉欣 | Ka Yan |
| 梓軒 | Tsz Hin |

課本欄目裡的人名（美寶、智傑、湯美、欣嵐、偉強…）**只留在 Quiz／Guided／Public**，不要改成課堂名。

---

## 6. 課本欄目：種類、順序、標籤

官方框跟**該語文書的頁次順序**，不要為了「同類放一起」而重排。課堂自製的小練習、生活案例可以插在對應概念後面。

| 種類 | class | 中文標 | 英文標 | 頁碼 |
|---|---|---|---|---|
| 小測試 | `.tb-box.tb-quiz` | 小測試 1.n | Quiz 1.n | `課本 p.n` / `Textbook p. n` |
| 例題拆解 | `.tb-box.tb-guided` | 例題拆解 1.n | Guided Example 1.n | 同上 |
| 公開試題 | `.tb-box.tb-public` | 公開試題　HKDSE 年，卷，題 | Public Exam　HKDSE year Paper Q | 同上 |
| 課堂小練習 | `.tb-box.tb-quiz` | 小練習 1.nA | Quick check 1.nA | 無頁碼 |
| 生活案例 | `.tb-box.tb-quiz` | 生活案例　… | Living case　… | 無頁碼 |

有頁碼用：

```html
<div class="tb-head">
  <p class="tb-lab"><span class="zh">小測試 1.6</span><span class="en" hidden>Quiz 1.6</span></p>
  <span class="tb-pg"><span class="zh">課本 p.31</span><span class="en" hidden>Textbook p. 31</span></span>
</div>
```

例題拆解結構：題目（照書）→ `.think` 解題思路 → `.tb-ans` 或答案表。

---

## 7. 版面元件（演示用）

| 元件 | class | 用途 |
|---|---|---|
| 定義 | `.def` | 橙左邊線；關鍵詞可放 `.ans` |
| 應試攻略 | `.exam` | 藍左邊線 |
| 警告／陷阱 | `.warn` | 紅左邊線 |
| 課堂例子 | `.eg` | 灰框；標題 `.lbl` |
| 雙欄對照 | `.two` > `.card` | 微觀／宏觀、借方／貸方 |
| 流程芯片 | `.flow` + `.chip` | 短的一條直線因果 |
| 分叉邏輯鏈 | `.chain` | 利率↑這類「一分為二再匯合」；**不要跳步** |
| 三步插圖 | `.illo` / `.illo-step` | 慾望→稀少→選擇 |
| 場景圖 | `.scene` + `.cap` | 單圖＋說明；說明寫 HTML，不燒進圖 |
| 四格圖 | `.grid4` | 物品分類這類 |
| 教具按鈕 | `a.tool-link` + `data-tool` | 連到該章 lab 的 hash |

**表：** `th` 置中、`td` 靠左（已在 `notes.css`）。較低成本格加 `td.lower`；標籤用 `.cost-low`。

**邏輯鏈（硬規則）：** 課本流程圖有的中間格（例如借款意欲、放款／儲蓄意欲）筆記也要有，不能三格走完。分叉用 `.chain`（上：起因；中兩欄：機制→意欲；下：匯合結果）。中文格跟中文書；英文格跟英文書。

---

## 8. 應試攻略怎樣寫

- 標題一行，例如「應試攻略：免費物品與不收費的物品」。
- 凡是 **(1) (2)** 分點：**各佔一個 `h4` + 正文**，禁止整段擠在同一 `<p>`。
- 「另外：……；……。」這種串句，拆成獨立小標題或條列。
- 準則要配**正確例子**（經濟物品／免費物品、付代價／生產成本分開舉例；標出易錯：不收費 ≠ 免費物品；沒有生產成本 ≠ 使用沒有成本）。
- 英文標題用該書 Exam Tips 的名稱（例如 *Free goods versus free-of-charge goods*），不要自撰口號。

---

## 9. 插圖

- 只放 `econ_notes/img/`。說明在 HTML（`.cap` / `.ttl` / `.sub`）。
- 同一章同一套畫風。預設女生頭髮**及肩，不要馬尾**。
- **不要**重繪現有圖，除非老師明確要求。
- **不要**把課本插圖或長段原文掃描上網。

---

## 10. 新開一章 checklist

1. 讀這份規格 + 該章中英課本（掃描頁碼 = 印刷頁碼）。
2. 複製 `src/chapter.starter.md` → `src/chXX_….md`，或新開 `chXX.body.html` + `chXX.json`。
3. 刪 `draft: true`；設 `out:`、`inkKey:`、章題、toc。
4. 寫學習重點（該章 DSE 要能做到的事）。
5. 按課本節序寫：def → 說明 → 圖／表 → exam → 課堂例子 → tool-link → 小練習 → 該頁的 Quiz／Guided／Public。
6. 官方框順序 = 中文書頁序；英文框用英文書用字。
7. `node econ_notes/build.mjs`。
8. 在 `index.html` 的「課堂筆記」加卡片。
9. 瀏覽器走一次：繁／EN、填空、點揭、該節邏輯鏈／表。
10. 等老師說「發布」再 push。只加筆記相關檔。

Markdown 方言見 `README.md`（`:::def`、`:::exam`、`:::drill`、`:::html`、`[[答案]]`）。複雜表、插圖、分叉鏈用 `:::html` 貼 HTML。

---

## 11. 不要做的事

- 手改組裝後的 `chXX_*.html`。
- 未說「發布」就 commit／push。
- 把中文筆記譯成英文交差（或相反）。
- 改寫 Quiz／Guided／Public 的題幹去「更口語」。
- 把 (1)(2) 或流程圖中間步塞成一段。
- 動 `econ_tools/deposit_creation.html`、`_tmp_*`、座位表腳本。
- 為了美觀重排課本欄目順序。
