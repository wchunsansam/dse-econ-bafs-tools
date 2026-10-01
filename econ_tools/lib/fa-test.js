/* Financial analysis formula self-test.
   Formulas follow Handout 2 (2014-06-24): Financial Analysis.
   Choice id "a" is always correct; the page shuffles the order shown. */
(function () {
  "use strict";

  function Q(id, topic, stem, kind, zh, en, choices, whyZh, whyEn) {
    if (!id || !zh || !en || !whyZh || !whyEn) throw new Error("blank " + id);
    if (!choices || choices.length !== 4) throw new Error("choices " + id);
    return {
      id: id,
      topic: topic,
      stem: stem,
      kind: kind,
      zh: zh,
      en: en,
      choices: choices.map(function (c, i) {
        return { id: "abcd"[i], zh: c[0], en: c[1] };
      }),
      answer: "a",
      whyZh: whyZh,
      whyEn: whyEn
    };
  }

  const BANK = [
    Q("wc-f", "liquidity", "wc", "formula",
      "公式表上的營運資金（working capital）點計？",
      "On the formula sheet, how is working capital calculated?",
      [
        ["流動資產 − 流動負債", "Current assets − current liabilities"],
        ["流動資產 ÷ 流動負債 : 1", "Current assets ÷ current liabilities : 1"],
        ["（流動資產 − 存貨）÷ 流動負債 : 1", "(Current assets − inventories) ÷ current liabilities : 1"],
        ["流動資產 + 流動負債", "Current assets + current liabilities"]
      ],
      "營運資金是金額，不是比率。流動資產減流動負債，表示來自流動資產的潛在現金，扣掉即將因流動負債用掉的現金之後，還多出多少。",
      "Working capital is a dollar amount, not a ratio. It is current assets minus current liabilities: potential excess cash from current assets over upcoming uses of cash."),
    Q("wc-m", "liquidity", "wc", "meaning",
      "營運資金量度甚麼？",
      "What does working capital measure?",
      [
        ["流動資產這個潛在現金來源，相對即將動用的現金（流動負債），多出來的部分", "Potential excess sources of cash from current assets over upcoming uses of cash from current liabilities"],
        ["流動資產是流動負債的幾倍", "How many times current assets cover current liabilities"],
        ["扣除存貨後的即時償債能力", "Immediate debt-paying ability after removing inventory"],
        ["股東資本佔非流動負債的百分比", "Shareholders’ fund as a percentage of non-current liabilities"]
      ],
      "公式表把營運資金寫成流動資產減流動負債，用來量度潛在現金來源相對即將使用的現金多出多少。倍數形式是流動比率，不是營運資金。",
      "The sheet defines working capital as current assets minus current liabilities. The ‘times’ form is the current ratio, not working capital."),
    Q("wc-c", "liquidity", "wc", "calc",
      "流動資產 $180,000，流動負債 $80,000。公式表上的營運資金是多少？",
      "Current assets are $180,000 and current liabilities are $80,000. What is working capital on the formula sheet?",
      [
        ["$100,000", "$100,000"],
        ["2.25 : 1", "2.25 : 1"],
        ["$260,000", "$260,000"],
        ["0.44 : 1", "0.44 : 1"]
      ],
      "營運資金 = 180,000 − 80,000 = $100,000。2.25 : 1 是流動比率，不是營運資金。",
      "Working capital = 180,000 − 80,000 = $100,000. 2.25 : 1 is the current ratio, not working capital."),
    Q("cr-f", "liquidity", "cr", "formula",
      "流動比率（current ratio）的公式是？",
      "What is the formula for the current ratio?",
      [
        ["流動資產 ÷ 流動負債 : 1", "Current assets ÷ current liabilities : 1"],
        ["（流動資產 − 存貨）÷ 流動負債 : 1", "(Current assets − inventories) ÷ current liabilities : 1"],
        ["流動資產 − 流動負債", "Current assets − current liabilities"],
        ["流動負債 ÷ 流動資產 : 1", "Current liabilities ÷ current assets : 1"]
      ],
      "流動比率 = 流動資產 ÷ 流動負債，以 : 1 表示。減存貨的是速動比率；直接相減的是營運資金。",
      "Current ratio = current assets ÷ current liabilities, expressed as : 1. Subtracting inventory gives the acid-test ratio. A straight subtraction is working capital."),
    Q("cr-m", "liquidity", "cr", "meaning",
      "流動比率量度甚麼？",
      "What does the current ratio measure?",
      [
        ["短期償債能力", "Short-term debt-paying ability"],
        ["長期還本能力", "Ability to repay long-term principal"],
        ["控制銷貨成本的能力", "Ability to control cost of goods sold"],
        ["普通股的市價相對盈利", "The market price of an ordinary share relative to earnings"]
      ],
      "流動比率量度短期償債能力，着重流動資產與流動負債的關係。長期還本是償債能力。",
      "The current ratio measures short-term debt-paying ability. It focuses on current assets and current liabilities. Repaying long-term principal is solvency."),
    Q("cr-i", "liquidity", "cr", "interpret",
      "流動比率愈高，公式表點講？",
      "On the formula sheet, what does a higher current ratio mean?",
      [
        ["公司看起來流動性愈高", "The company appears to be more liquid"],
        ["槓桿比率一定愈低", "The gearing ratio must be lower"],
        ["毛利率一定愈高", "The gross profit margin must be higher"],
        ["供應商一定會延長信貸期", "Suppliers must extend the credit period"]
      ],
      "公式表說比率愈高，公司看起來愈有流動性。這只是「看起來」，還要再看是不是存貨轉得慢。",
      "The sheet says the higher the ratio, the more liquid the company appears to be. That is only how it appears; slow inventory turnover can still be the reason."),
    Q("cr-trap", "liquidity", "cr", "interpret",
      "流動比率高，就一定代表短期償債能力強嗎？",
      "Does a high current ratio always mean strong short-term debt-paying ability?",
      [
        ["不一定。可能只是存貨周轉慢", "Not necessarily. It may just be slow inventory turnover"],
        ["一定。比率愈高就愈安全", "Yes. A higher ratio is always safer"],
        ["一定。速動比率會同步上升", "Yes. The acid-test ratio must rise with it"],
        ["一定。槓桿比率會因而下降", "Yes. The gearing ratio falls because of it"]
      ],
      "公式表的可能誤讀：流動比率高，可能只是存貨周轉慢，流動性未必真的好。",
      "The sheet’s warning: a high current ratio may just be due to slow inventory turnover."),
    Q("cr-c", "liquidity", "cr", "calc",
      "流動資產 $200,000，流動負債 $80,000。流動比率是多少？",
      "Current assets are $200,000 and current liabilities are $80,000. What is the current ratio?",
      [
        ["2.5 : 1", "2.5 : 1"],
        ["0.4 : 1", "0.4 : 1"],
        ["2.5%", "2.5%"],
        ["$120,000", "$120,000"]
      ],
      "流動比率 = 200,000 ÷ 80,000 = 2.5 : 1。$120,000 是營運資金。這個比率不用乘 100%。",
      "Current ratio = 200,000 ÷ 80,000 = 2.5 : 1. $120,000 is working capital. This ratio is not multiplied by 100%."),
    Q("at-f", "liquidity", "at", "formula",
      "速動比率／酸性測驗比率（acid-test ratio）的公式是？",
      "What is the formula for the acid-test ratio?",
      [
        ["（流動資產 − 存貨）÷ 流動負債 : 1", "(Current assets − inventories) ÷ current liabilities : 1"],
        ["流動資產 ÷ 流動負債 : 1", "Current assets ÷ current liabilities : 1"],
        ["（流動資產 − 存貨 − 應收貨款）÷ 流動負債 : 1", "(Current assets − inventories − trade receivables) ÷ current liabilities : 1"],
        ["存貨 ÷ 流動負債 : 1", "Inventories ÷ current liabilities : 1"]
      ],
      "速動比率只從流動資產減去存貨，再除以流動負債。應收貨款仍然留在分子。",
      "The acid-test ratio removes inventories from current assets, then divides by current liabilities. Trade receivables stay in the numerator."),
    Q("at-m", "liquidity", "at", "meaning",
      "速動比率點解要減存貨？",
      "Why does the acid-test ratio exclude inventories?",
      [
        ["存貨流動性較低，未必隨時賣得出；比率只留最易變現的流動資產", "Inventory is less liquid and may not be readily saleable. The ratio keeps only the most liquid current assets"],
        ["存貨已經是現金", "Inventory is already cash"],
        ["存貨屬於非流動負債", "Inventory is a non-current liability"],
        ["減存貨是為了計算毛利", "Inventory is removed in order to calculate gross profit"]
      ],
      "公式表說速動比率更嚴格，只包括最易變現的流動資產，剔除較難變現的存貨。",
      "The sheet says the acid-test is more demanding. It includes only the most liquid current assets and excludes less liquid inventory."),
    Q("at-i", "liquidity", "at", "interpret",
      "相對流動比率，速動比率的特點是？",
      "Compared with the current ratio, what is special about the acid-test ratio?",
      [
        ["更嚴格，量度即時的短期償債能力", "It is more demanding and measures immediate short-term debt-paying ability"],
        ["更寬鬆，因為加回了存貨", "It is looser because inventory is added back"],
        ["用來量度長期償債", "It measures long-term solvency"],
        ["用來量度每股盈利", "It measures earnings per share"]
      ],
      "公式表說酸性測驗量度即時的短期償債能力，而且要求更高。",
      "The sheet says the acid-test measures immediate short-term debt-paying ability, and that it is more demanding."),
    Q("at-c", "liquidity", "at", "calc",
      "流動資產 $180,000，其中存貨 $60,000，流動負債 $80,000。速動比率是多少？",
      "Current assets are $180,000, including inventories of $60,000. Current liabilities are $80,000. What is the acid-test ratio?",
      [
        ["1.5 : 1", "1.5 : 1"],
        ["2.25 : 1", "2.25 : 1"],
        ["0.67 : 1", "0.67 : 1"],
        ["$40,000", "$40,000"]
      ],
      "速動比率 =（180,000 − 60,000）÷ 80,000 = 1.5 : 1。2.25 : 1 是沒有減存貨的流動比率。",
      "Acid-test ratio = (180,000 − 60,000) ÷ 80,000 = 1.5 : 1. 2.25 : 1 is the current ratio with inventory left in."),
    Q("liq-party", "liquidity", "liq-party", "meaning",
      "變現能力比率最直接關乎哪一方？",
      "Who is most directly interested in liquidity ratios?",
      [
        ["短期債權人（銀行和供應商）", "Short-term creditors (bankers and suppliers)"],
        ["長期債權人和股東", "Long-term creditors and stockholders"],
        ["只關心下星期股價的人", "Someone who only watches next week’s share price"],
        ["只負責收稅的部門", "The tax authority alone"]
      ],
      "公式表說變現能力看公司能否在短期債務出現時應付，關心的是短期債權人，例如銀行和供應商。",
      "The sheet says liquidity is about meeting short-term obligations as they arise. The interested parties are short-term creditors: bankers and suppliers."),
    Q("liq-focus", "liquidity", "liq-focus", "meaning",
      "變現能力着重哪組關係？",
      "What relationship do liquidity ratios focus on?",
      [
        ["流動資產與流動負債", "Current assets and current liabilities"],
        ["非流動負債與股東資本", "Non-current liabilities and shareholders’ fund"],
        ["毛利與銷貨", "Gross profit and sales"],
        ["股價與每股盈利", "Share price and earnings per share"]
      ],
      "公式表說變現能力着重（1）流動資產與（2）流動負債。非流動負債與股東資本是槓桿比率。",
      "The sheet says liquidity focuses on (1) current assets and (2) current liabilities. Non-current liabilities and shareholders’ fund belong to the gearing ratio."),

    Q("eff-focus", "efficiency", "eff-focus", "meaning",
      "管理效率比率量度甚麼？",
      "What do management efficiency ratios measure?",
      [
        ["公司運用營運資產和管理資源的效率", "How efficiently the company uses its operating assets and manages its resources"],
        ["只量度長期債務佔資本的比重", "Only the share of long-term debt in capital"],
        ["只量度稅前淨利佔銷貨的百分比", "Only net profit before tax as a percentage of sales"],
        ["只量度股價相對每股盈利", "Only the share price relative to earnings per share"]
      ],
      "公式表說管理效率量度公司運用營運資產和管理資源的效率。",
      "The sheet says management efficiency measures how efficiently a company utilises its operating assets and manages its resources."),
    Q("rto-f", "efficiency", "rto", "formula",
      "應收貨款周轉率（trade receivables turnover）的公式是？",
      "What is the formula for trade receivables turnover?",
      [
        ["賒銷 ÷ 平均應收貨款", "Credit sales ÷ average trade receivables"],
        ["銷貨 ÷ 平均應收貨款", "Sales ÷ average trade receivables"],
        ["平均應收貨款 ÷ 賒銷", "Average trade receivables ÷ credit sales"],
        ["365 ÷ 平均應收貨款", "365 ÷ average trade receivables"]
      ],
      "分子是賒銷，不是全部銷貨。分母是平均應收貨款。單位是次。",
      "The numerator is credit sales, not total sales. The denominator is average trade receivables. The unit is times."),
    Q("rto-m", "efficiency", "rto", "meaning",
      "應收貨款周轉率量度甚麼？",
      "What does trade receivables turnover measure?",
      [
        ["應收帳幾快變成現金，亦即平均應收帳一年收幾多次", "How quickly receivables are converted into cash: how many times average receivables are collected"],
        ["存貨一年賣出幾多次", "How many times inventory is sold in a year"],
        ["應付帳幾快付清", "How quickly payables are settled"],
        ["每一元資產帶來幾多銷貨", "How much sales each dollar of assets produces"]
      ],
      "公式表說它量度應收帳幾快變成現金，並表示公司收取平均應收帳的次數。周轉率愈高，應收帳的流動性愈高。",
      "The sheet says it measures how quickly receivables are converted into cash, and how many times the company collects average receivables. A higher turnover means the receivables are more liquid."),
    Q("rto-i", "efficiency", "rto", "interpret",
      "應收貨款周轉率低，公式表指出的風險是？",
      "What risk does the sheet link to a low trade receivables turnover?",
      [
        ["產生壞帳開支", "Incurrence of bad debt expenses"],
        ["存貨過時", "Inventory obsolescence"],
        ["供應商要求立刻付款", "Suppliers demanding immediate payment"],
        ["市盈率上升", "A rise in the price-earnings ratio"]
      ],
      "周轉率愈高，應收帳愈有流動性。周轉率低的風險是壞帳開支。存貨過時是存貨周轉率低的風險。",
      "A higher turnover means more liquid receivables. The risk of a low turnover is bad debt expenses. Obsolescence is the risk named for a low inventory turnover."),
    Q("rto-c", "efficiency", "rto", "calc",
      "銷貨 $300,000，其中賒銷 $240,000，平均應收貨款 $40,000。應收貨款周轉率是多少？",
      "Sales are $300,000, of which credit sales are $240,000. Average trade receivables are $40,000. What is the trade receivables turnover?",
      [
        ["6 次", "6 times"],
        ["7.5 次", "7.5 times"],
        ["6 日", "6 days"],
        ["0.17 次", "0.17 times"]
      ],
      "要用賒銷：240,000 ÷ 40,000 = 6 次。7.5 次是誤用了全部銷貨 300,000。",
      "Use credit sales: 240,000 ÷ 40,000 = 6 times. 7.5 times uses total sales of 300,000."),
    Q("rdays-f", "efficiency", "rdays", "formula",
      "應收貨款平均收帳期的公式是？",
      "What is the formula for the average trade receivables collection period?",
      [
        ["365 ÷ 應收貨款周轉率（次）", "365 ÷ trade receivables turnover (times)"],
        ["360 ÷ 應收貨款周轉率（次）", "360 ÷ trade receivables turnover (times)"],
        ["應收貨款周轉率 ÷ 365", "Trade receivables turnover ÷ 365"],
        ["平均應收貨款 ÷ 賒銷", "Average trade receivables ÷ credit sales"]
      ],
      "公式表用 365 除以應收貨款周轉率（次），得出平均日數。不是 360。",
      "The sheet divides 365 by the trade receivables turnover in times. It does not use 360."),
    Q("rdays-m", "efficiency", "rdays", "meaning",
      "平均收帳期用來做甚麼？",
      "What is the average collection period used for?",
      [
        ["看應收帳平均幾多日才收回，並與給予客戶的信貸期比較", "To see the average days a receivable stays outstanding, and to compare that with the credit term granted"],
        ["看存貨平均幾多日才賣出", "To see the average days inventory takes to sell"],
        ["看普通股股息被盈利覆蓋幾多次", "To see how many times profit covers the ordinary dividend"],
        ["看非流動負債佔資本幾多", "To see non-current liabilities as a share of capital"]
      ],
      "公式表說它表示應收帳在收回前平均掛帳幾多日，用來評估信貸和收帳政策是否有效，並與給予的信貸期比較。",
      "The sheet says it is the average number of days a receivable remains outstanding, used to assess credit and collection policies against the credit term granted."),
    Q("rdays-class", "efficiency", "rdays", "classify",
      "公式表把平均收帳期歸在哪一類？",
      "On the formula sheet, which group does the average collection period belong to?",
      [
        ["管理效率", "Management efficiency"],
        ["變現能力", "Liquidity"],
        ["償債能力", "Solvency"],
        ["盈利及投資回報", "Profitability and return"]
      ],
      "平均收帳期看應收帳收得快不快。公式表把它放在管理效率，不是變現能力那一頁。",
      "The collection period shows how quickly receivables are collected. The sheet places it under management efficiency, not on the liquidity page."),
    Q("rdays-c", "efficiency", "rdays", "calc",
      "應收貨款周轉率是 5 次。平均收帳期是多少？",
      "Trade receivables turnover is 5 times. What is the average collection period?",
      [
        ["73 日", "73 days"],
        ["72 日", "72 days"],
        ["5 日", "5 days"],
        ["1,825 日", "1,825 days"]
      ],
      "平均收帳期 = 365 ÷ 5 = 73 日。72 日是誤用 360。1,825 日是 365 乘 5。",
      "Average collection period = 365 ÷ 5 = 73 days. 72 days uses 360. 1,825 days is 365 × 5."),
    Q("inv-f", "efficiency", "inv", "formula",
      "存貨周轉率（inventory turnover）的公式是？",
      "What is the formula for inventory turnover?",
      [
        ["銷貨成本 ÷ 平均存貨", "Cost of goods sold ÷ average inventory"],
        ["銷貨 ÷ 平均存貨", "Sales ÷ average inventory"],
        ["銷貨成本 ÷ 期末存貨", "Cost of goods sold ÷ closing inventory"],
        ["平均存貨 ÷ 銷貨成本", "Average inventory ÷ cost of goods sold"]
      ],
      "分子是銷貨成本，不是銷貨。分母是平均存貨，不是只取期末存貨。",
      "The numerator is cost of goods sold, not sales. The denominator is average inventory, not closing inventory alone."),
    Q("inv-m", "efficiency", "inv", "meaning",
      "存貨周轉率量度甚麼？",
      "What does inventory turnover measure?",
      [
        ["存貨的流動性：公司能夠賣出相等於平均存貨的數量幾多次", "The liquidity of inventory: how many times the company sells a quantity equal to its average inventory"],
        ["流動資產是流動負債的幾倍", "How many times current assets cover current liabilities"],
        ["毛利佔銷貨的百分比", "Gross profit as a percentage of sales"],
        ["優先股佔股東資本的百分比", "Preference capital as a percentage of shareholders’ fund"]
      ],
      "公式表說它量度存貨的流動性，表示公司能夠賣出相等於平均存貨的貨品幾多次。周轉率愈高，存貨賣得愈快。",
      "The sheet says it measures the liquidity of inventory: how many times the company sells a quantity equal to average inventory. A higher turnover means inventory is sold more quickly."),
    Q("inv-i", "efficiency", "inv", "interpret",
      "存貨周轉率低，公式表指出的風險是？",
      "What risk does the sheet link to a low inventory turnover?",
      [
        ["存貨過時的機會較高（存貨估值要用成本與市價孰低）", "A higher chance of inventory obsolescence (lower of cost and market value in the inventory valuation)"],
        ["壞帳一定增加", "Bad debts must increase"],
        ["槓桿比率一定上升", "The gearing ratio must rise"],
        ["股息覆蓋倍數一定下降", "Dividend cover must fall"]
      ],
      "周轉率低，存貨較易過時。公式表提到這時存貨估值會用到成本與市價孰低。",
      "A low turnover raises the chance of obsolescence. The sheet links that to applying the lower of cost and market value to inventory."),
    Q("inv-class", "efficiency", "inv", "classify",
      "公式表把存貨周轉率歸在哪一類？",
      "On the formula sheet, which group does inventory turnover belong to?",
      [
        ["管理效率", "Management efficiency"],
        ["變現能力", "Liquidity"],
        ["償債能力", "Solvency"],
        ["盈利及投資回報", "Profitability and return"]
      ],
      "它量度存貨賣得快不快，但公式表放在管理效率。變現能力頁只有營運資金、流動比率和速動比率。",
      "It measures how quickly inventory sells, but the sheet places it under management efficiency. The liquidity page has only working capital, the current ratio and the acid-test ratio."),
    Q("inv-c", "efficiency", "inv", "calc",
      "銷貨成本 $300,000，平均存貨 $50,000。存貨周轉率是多少？",
      "Cost of goods sold is $300,000 and average inventory is $50,000. What is the inventory turnover?",
      [
        ["6 次", "6 times"],
        ["0.17 次", "0.17 times"],
        ["6 日", "6 days"],
        ["16.67%", "16.67%"]
      ],
      "存貨周轉率 = 300,000 ÷ 50,000 = 6 次。16.67% 是把平均存貨除以銷貨成本。",
      "Inventory turnover = 300,000 ÷ 50,000 = 6 times. 16.67% divides average inventory by cost of goods sold."),
    Q("pto-f", "efficiency", "pto", "formula",
      "應付貨款周轉率（trade payables turnover）的公式是？",
      "What is the formula for trade payables turnover?",
      [
        ["賒購 ÷ 平均應付貨款", "Credit purchases ÷ average trade payables"],
        ["銷貨成本 ÷ 平均應付貨款", "Cost of goods sold ÷ average trade payables"],
        ["賒銷 ÷ 平均應付貨款", "Credit sales ÷ average trade payables"],
        ["平均應付貨款 ÷ 賒購", "Average trade payables ÷ credit purchases"]
      ],
      "分子是賒購，不是銷貨成本，也不是賒銷。分母是平均應付貨款。",
      "The numerator is credit purchases, not cost of goods sold and not credit sales. The denominator is average trade payables."),
    Q("pto-i", "efficiency", "pto", "interpret",
      "應付貨款周轉率愈低，公式表的意思是？",
      "On the formula sheet, what does a lower trade payables turnover mean?",
      [
        ["公司付供應商愈慢", "The company is paying its suppliers more slowly"],
        ["公司付供應商愈快", "The company is paying its suppliers more quickly"],
        ["存貨愈快賣出", "Inventory is sold more quickly"],
        ["毛利率愈高", "The gross profit margin is higher"]
      ],
      "周轉率愈低，付款愈慢。公式表說慢付可能反映財務表現轉差，供應商不滿，甚至要求更快付款。",
      "The lower the turnover, the more slowly the company pays. The sheet says slow payment may signal worsening performance, and suppliers may be dissatisfied and demand quicker payment."),
    Q("pto-c", "efficiency", "pto", "calc",
      "購貨 $200,000，其中賒購 $180,000，平均應付貨款 $45,000。應付貨款周轉率是多少？",
      "Purchases are $200,000, of which credit purchases are $180,000. Average trade payables are $45,000. What is the trade payables turnover?",
      [
        ["4 次", "4 times"],
        ["4.44 次", "4.44 times"],
        ["4 日", "4 days"],
        ["0.25 次", "0.25 times"]
      ],
      "要用賒購：180,000 ÷ 45,000 = 4 次。4.44 次是誤用了購貨總額 200,000。",
      "Use credit purchases: 180,000 ÷ 45,000 = 4 times. 4.44 times uses total purchases of 200,000."),
    Q("pdays-f", "efficiency", "pdays", "formula",
      "應付貨款平均還款期的公式是？",
      "What is the formula for the average trade payables repayment period?",
      [
        ["365 ÷ 應付貨款周轉率（次）", "365 ÷ trade payables turnover (times)"],
        ["365 ÷ 應收貨款周轉率（次）", "365 ÷ trade receivables turnover (times)"],
        ["應付貨款周轉率 ÷ 365", "Trade payables turnover ÷ 365"],
        ["360 × 應付貨款周轉率", "360 × trade payables turnover"]
      ],
      "平均還款期 = 365 ÷ 應付貨款周轉率（次），表示平均還款時間。不要用成收帳期的周轉率。",
      "Average repayment period = 365 ÷ trade payables turnover (times). It is the average repayment time. Do not use the receivables turnover."),
    Q("pdays-c", "efficiency", "pdays", "calc",
      "應付貨款周轉率是 10 次。平均還款期是多少？",
      "Trade payables turnover is 10 times. What is the average repayment period?",
      [
        ["36.5 日", "36.5 days"],
        ["36 日", "36 days"],
        ["10 日", "10 days"],
        ["3,650 日", "3,650 days"]
      ],
      "平均還款期 = 365 ÷ 10 = 36.5 日。36 日是誤用 360。3,650 日是 365 乘 10。",
      "Average repayment period = 365 ÷ 10 = 36.5 days. 36 days uses 360. 3,650 days is 365 × 10."),

    Q("gear-f", "solvency", "gear", "formula",
      "槓桿比率（gearing ratio）的公式是？",
      "What is the formula for the gearing ratio?",
      [
        ["（非流動負債 + 優先股本）÷（非流動負債 + 股東資本）× 100%", "(Non-current liabilities + preference share capital) ÷ (non-current liabilities + shareholders’ fund) × 100%"],
        ["非流動負債 ÷ 股東資本 × 100%", "Non-current liabilities ÷ shareholders’ fund × 100%"],
        ["（非流動負債 + 普通股本）÷（非流動負債 + 股東資本）× 100%", "(Non-current liabilities + ordinary share capital) ÷ (non-current liabilities + shareholders’ fund) × 100%"],
        ["（非流動負債 + 優先股本）÷ 股東資本 × 100%", "(Non-current liabilities + preference share capital) ÷ shareholders’ fund × 100%"]
      ],
      "分子是非流動負債加優先股本。分母是非流動負債加股東資本。優先股本已在股東資本之內，分母仍要加上非流動負債。",
      "The numerator is non-current liabilities plus preference share capital. The denominator is non-current liabilities plus shareholders’ fund. Preference capital is already inside shareholders’ fund, and the denominator still adds non-current liabilities."),
    Q("gear-fund", "solvency", "gear", "formula",
      "公式表所講的股東資本（shareholders’ fund）包括甚麼？",
      "On the formula sheet, what is included in shareholders’ fund?",
      [
        ["普通股本（包括股份溢價）、優先股本及保留溢利", "Ordinary share capital (including share premium), preference share capital and retained earnings"],
        ["只有普通股本", "Ordinary share capital only"],
        ["普通股本和非流動負債", "Ordinary share capital and non-current liabilities"],
        ["流動資產減流動負債", "Current assets minus current liabilities"]
      ],
      "股東資本包括普通股本（連股份溢價）、優先股本及保留溢利。非流動負債在槓桿比率裡另外加上，不是股東資本的一部分。",
      "Shareholders’ fund includes ordinary share capital (including share premium), preference share capital and retained earnings. Non-current liabilities are added separately in the gearing ratio."),
    Q("gear-pref", "solvency", "gear", "formula",
      "優先股本在槓桿比率的哪個位置？",
      "Where do preference shares sit in the gearing ratio?",
      [
        ["分子有一份，而且已經包含在分母的股東資本裡", "Once in the numerator, and already inside shareholders’ fund in the denominator"],
        ["只放分子，股東資本不再計算優先股本", "Only in the numerator, and left out of shareholders’ fund"],
        ["只放分母，分子只計非流動負債", "Only in the denominator, while the numerator is non-current liabilities only"],
        ["當作流動負債，不計入槓桿比率", "Treated as a current liability and left out of gearing"]
      ],
      "公式表把優先股本視作固定利息資本，放進分子；股東資本的定義又包括優先股本，所以分母裡也有。",
      "The sheet treats preference capital as fixed-interest capital, so it is in the numerator. Shareholders’ fund is also defined to include preference capital, so it is in the denominator too."),
    Q("gear-m", "solvency", "gear", "meaning",
      "槓桿比率顯示甚麼？",
      "What does the gearing ratio show?",
      [
        ["槓桿程度：權益資本與固定利息借貸資本（包括優先股）的關係", "The degree of leverage: the relationship between equity capital and fixed-interest loan capital, including preference shares"],
        ["流動資產相對流動負債的倍數", "How many times current assets cover current liabilities"],
        ["每一元銷貨帶來的毛利", "Gross profit earned from each dollar of sales"],
        ["應收帳平均幾多日才收回", "The average days receivables remain outstanding"]
      ],
      "公式表說槓桿比率顯示槓桿程度，描述權益資本與固定利息借貸資本（包括優先股）的關係。",
      "The sheet says the gearing ratio indicates the degree of leverage and the relationship between equity capital and fixed-interest loan capital, including preference shares."),
    Q("gear-i", "solvency", "gear", "interpret",
      "槓桿比率愈低，公式表的意思是？",
      "On the formula sheet, what does a lower gearing ratio mean?",
      [
        ["無力償還債務的風險愈小，因為股東向債權人提供的保障較大", "The risk of being unable to pay debts is smaller, because shareholders provide a larger margin of protection to creditors"],
        ["短期現金一定更緊絀", "Short-term cash must be tighter"],
        ["毛利率一定更低", "The gross profit margin must be lower"],
        ["存貨一定賣得更快", "Inventory must sell faster"]
      ],
      "比率愈低，企業無力還債的風險愈小。股東提供的保障額較高。",
      "The lower the ratio, the smaller the risk that the business becomes unable to pay its debts. The margin of protection contributed by shareholders is higher."),
    Q("gear-class", "solvency", "gear", "classify",
      "槓桿比率屬於哪一類？",
      "Which group does the gearing ratio belong to?",
      [
        ["償債能力", "Solvency"],
        ["變現能力", "Liquidity"],
        ["管理效率", "Management efficiency"],
        ["盈利及投資回報", "Profitability and return"]
      ],
      "償債能力看企業能否長期生存。流動比率才是變現能力，不要把流動比率叫成槓桿。",
      "Solvency is the ability to survive over a long period. The current ratio is liquidity. Do not call the current ratio gearing."),
    Q("gear-c", "solvency", "gear", "calc",
      "非流動負債 $120,000，優先股本 $30,000，普通股本 $200,000，股份溢價 $20,000，保留溢利 $30,000。槓桿比率是多少？",
      "Non-current liabilities $120,000, preference share capital $30,000, ordinary share capital $200,000, share premium $20,000, retained earnings $30,000. What is the gearing ratio?",
      [
        ["37.5%", "37.5%"],
        ["53.57%", "53.57%"],
        ["30%", "30%"],
        ["40.54%", "40.54%"]
      ],
      "股東資本 = 200,000 + 20,000 + 30,000 + 30,000 = $280,000（已包括優先股）。分子 = 120,000 + 30,000 = $150,000。分母 = 120,000 + 280,000 = $400,000。150,000 ÷ 400,000 × 100% = 37.5%。53.57% 是漏了把非流動負債加進分母。",
      "Shareholders’ fund = 200,000 + 20,000 + 30,000 + 30,000 = $280,000, including preference capital. Numerator = 120,000 + 30,000 = $150,000. Denominator = 120,000 + 280,000 = $400,000. 150,000 ÷ 400,000 × 100% = 37.5%. 53.57% leaves non-current liabilities out of the denominator."),
    Q("solv-party", "solvency", "solv-party", "meaning",
      "償債能力比率最直接關乎哪一方？",
      "Who is most directly interested in solvency ratios?",
      [
        ["長期債權人和股東", "Long-term creditors and stockholders"],
        ["短期債權人（銀行和供應商）", "Short-term creditors (bankers and suppliers)"],
        ["只來買貨的顧客", "Customers who only buy goods"],
        ["只負責收稅的部門", "The tax authority alone"]
      ],
      "公式表說償債能力看公司能否長期生存，關心的是長期債權人和股東。短期銀行和供應商主要看變現能力。",
      "The sheet says solvency is about surviving over a long period. The interested parties are long-term creditors and stockholders. Bankers and suppliers as short-term creditors look at liquidity."),
    Q("solv-focus", "solvency", "solv-focus", "meaning",
      "償債能力着重哪兩項？",
      "What two abilities does solvency focus on?",
      [
        ["能否支付利息，以及債務到期時能否還本", "Meeting interest requirements, and repaying the principal when the debt falls due"],
        ["存貨能否在一星期內賣出", "Whether inventory can be sold within a week"],
        ["毛利率是否高於同行", "Whether the gross profit margin beats the industry"],
        ["收帳期是否短過信貸期", "Whether the collection period is shorter than the credit term"]
      ],
      "公式表說償債能力着重（1）能否應付利息，以及（2）債務到期時能否償還本金。",
      "The sheet says solvency focuses on (1) the ability to meet interest requirements and (2) the ability to repay principal when the debt falls due."),

    Q("gp-f", "profit", "gp", "formula",
      "毛利率（gross profit margin）的公式是？",
      "What is the formula for the gross profit margin?",
      [
        ["毛利 ÷ 銷貨 × 100%", "Gross profit ÷ sales × 100%"],
        ["毛利 ÷ 銷貨成本 × 100%", "Gross profit ÷ cost of goods sold × 100%"],
        ["稅前淨利 ÷ 銷貨 × 100%", "Net profit before tax ÷ sales × 100%"],
        ["毛利 − 銷貨成本", "Gross profit − cost of goods sold"]
      ],
      "毛利率 = 毛利 ÷ 銷貨 × 100%。毛利 ÷ 銷貨成本不是這張表的毛利率。",
      "Gross profit margin = gross profit ÷ sales × 100%. Gross profit ÷ cost of goods sold is not the gross profit margin on this sheet."),
    Q("gp-m", "profit", "gp", "meaning",
      "毛利率量度甚麼？",
      "What does the gross profit margin measure?",
      [
        ["銷貨中有百分之幾成為毛利，反映控制銷貨成本和保留毛利的能力", "The percentage of sales that becomes gross profit, and management’s ability to control cost of goods sold and keep a reasonable portion of sales as gross profit"],
        ["扣除費用後的稅前淨利佔銷貨的百分比", "Net profit before tax, after expenses, as a percentage of sales"],
        ["全部長期資金賺到的回報", "The return earned on all long-term funds"],
        ["每一元資產帶來的銷貨", "Sales produced by each dollar of assets"]
      ],
      "公式表說毛利率量度銷貨中有百分之幾成為毛利，反映管理層控制銷貨成本，並把合理部分的銷貨留成毛利的能力。",
      "The sheet says it measures the percentage of sales contributing to gross profit, and management’s ability to control cost of goods sold and retain a reasonable portion of sales as gross profit."),
    Q("gp-c", "profit", "gp", "calc",
      "毛利 $120,000，銷貨成本 $300,000，銷貨 $400,000。毛利率是多少？",
      "Gross profit is $120,000, cost of goods sold is $300,000 and sales are $400,000. What is the gross profit margin?",
      [
        ["30%", "30%"],
        ["40%", "40%"],
        ["75%", "75%"],
        ["$120,000", "$120,000"]
      ],
      "毛利率 = 120,000 ÷ 400,000 × 100% = 30%。40% 是毛利 ÷ 銷貨成本，不是這張表的毛利率。",
      "Gross profit margin = 120,000 ÷ 400,000 × 100% = 30%. 40% is gross profit ÷ cost of goods sold, which is not the margin on this sheet."),
    Q("np-f", "profit", "np", "formula",
      "淨利率（net profit margin）的公式是？",
      "What is the formula for the net profit margin?",
      [
        ["稅前淨利 ÷ 銷貨 × 100%", "Net profit before tax ÷ sales × 100%"],
        ["稅後淨利 ÷ 銷貨 × 100%", "Net profit after tax ÷ sales × 100%"],
        ["息稅前利潤 ÷ 銷貨 × 100%", "Profit before interest and tax ÷ sales × 100%"],
        ["稅前淨利 ÷ 銷貨成本 × 100%", "Net profit before tax ÷ cost of goods sold × 100%"]
      ],
      "公式表的淨利率用稅前淨利，不是稅後淨利，也不是息稅前利潤。分母是銷貨。",
      "On this sheet the net profit margin uses net profit before tax, not profit after tax and not profit before interest and tax. The denominator is sales."),
    Q("np-m", "profit", "np", "meaning",
      "淨利率量度甚麼？",
      "What does the net profit margin measure?",
      [
        ["銷貨中有百分之幾成為稅前淨利，反映控制費用的能力", "The percentage of sales that becomes net profit before tax, and management’s ability to control expenses"],
        ["只反映銷貨成本，未計費用", "Only cost of goods sold, before expenses"],
        ["股價是每股盈利的幾倍", "How many times the share price covers earnings per share"],
        ["非流動負債佔資本的百分比", "Non-current liabilities as a percentage of capital"]
      ],
      "公式表說淨利率量度銷貨中有百分之幾成為稅前淨利，反映管理層控制費用，並把合理部分的銷貨留成利潤的能力。",
      "The sheet says it measures the percentage of sales contributing to net profit before tax, and management’s ability to control expenses and retain a reasonable portion of sales as profit."),
    Q("np-c", "profit", "np", "calc",
      "稅前淨利 $48,000，稅 $8,000，銷貨 $400,000。淨利率是多少？",
      "Net profit before tax is $48,000, tax is $8,000 and sales are $400,000. What is the net profit margin?",
      [
        ["12%", "12%"],
        ["10%", "10%"],
        ["2%", "2%"],
        ["$48,000", "$48,000"]
      ],
      "淨利率 = 48,000 ÷ 400,000 × 100% = 12%。10% 是誤用稅後淨利 40,000。",
      "Net profit margin = 48,000 ÷ 400,000 × 100% = 12%. 10% uses profit after tax of 40,000."),
    Q("roce-f", "profit", "roce", "formula",
      "運用資金報酬率（ROCE）的公式是？",
      "What is the formula for return on capital employed?",
      [
        ["息稅前利潤 ÷ 平均運用資金 × 100%", "Profit before interest and tax ÷ average capital employed × 100%"],
        ["稅前淨利 ÷ 平均運用資金 × 100%", "Net profit before tax ÷ average capital employed × 100%"],
        ["息稅前利潤 ÷ 銷貨 × 100%", "Profit before interest and tax ÷ sales × 100%"],
        ["稅後淨利 ÷ 資產總額 × 100%", "Net profit after tax ÷ total assets × 100%"]
      ],
      "分子是利息及稅前利潤。分母是平均運用資金。稅前淨利還沒加回利息。",
      "The numerator is profit before interest and tax. The denominator is average capital employed. Net profit before tax has not yet added interest back."),
    Q("roce-m", "profit", "roce", "meaning",
      "運用資金報酬率量度甚麼？",
      "What does return on capital employed measure?",
      [
        ["全部長期資金（長期債權人和股東）賺到的回報，以及運用這些資金的整體盈利和效率", "The return on funds from all sources, long-term creditors and shareholders, and the overall profitability and efficiency with which capital is employed"],
        ["只量度短期償債", "Short-term debt-paying ability only"],
        ["只量度存貨賣得快不快", "Only how quickly inventory sells"],
        ["只量度股息佔股價的百分比", "Only the dividend as a percentage of the share price"]
      ],
      "公式表說 ROCE 量度從所有資金來源（長期債權人和股東）賺取回報的能力，以及運用資本的整體盈利和效率。",
      "The sheet says ROCE measures the return on funds supplied from all sources, long-term creditors and shareholders, and the overall profitability and efficiency with which capital is employed."),
    Q("roce-c", "profit", "roce", "calc",
      "稅前淨利 $60,000（已扣除利息 $20,000），平均運用資金 $400,000。運用資金報酬率是多少？",
      "Net profit before tax is $60,000 after deducting interest of $20,000. Average capital employed is $400,000. What is the return on capital employed?",
      [
        ["20%", "20%"],
        ["15%", "15%"],
        ["5%", "5%"],
        ["$80,000", "$80,000"]
      ],
      "息稅前利潤 = 60,000 + 20,000 = $80,000。80,000 ÷ 400,000 × 100% = 20%。15% 是只用了稅前淨利。",
      "Profit before interest and tax = 60,000 + 20,000 = $80,000. 80,000 ÷ 400,000 × 100% = 20%. 15% uses net profit before tax only."),
    Q("tat-f", "profit", "tat", "formula",
      "總資產周轉率（total asset turnover）的公式是？",
      "What is the formula for total asset turnover?",
      [
        ["銷貨 ÷ 資產總額", "Sales ÷ total assets"],
        ["銷貨成本 ÷ 資產總額", "Cost of goods sold ÷ total assets"],
        ["資產總額 ÷ 銷貨", "Total assets ÷ sales"],
        ["銷貨 ÷ 平均運用資金", "Sales ÷ average capital employed"]
      ],
      "總資產周轉率 = 銷貨 ÷ 資產總額，單位是次。分子不是銷貨成本。",
      "Total asset turnover = sales ÷ total assets, in times. The numerator is not cost of goods sold."),
    Q("tat-m", "profit", "tat", "meaning",
      "總資產周轉率量度甚麼？",
      "What does total asset turnover measure?",
      [
        ["公司用資產產生銷貨的效率：每一元資產帶來多少銷貨", "How efficiently assets are used to generate sales: how much sales each dollar of assets produces"],
        ["每一元銷貨帶來多少毛利", "How much gross profit each dollar of sales produces"],
        ["流動資產是流動負債的幾倍", "How many times current assets cover current liabilities"],
        ["普通股股息被盈利覆蓋幾多次", "How many times profit covers the ordinary dividend"]
      ],
      "公式表說它量度公司用資產產生銷貨的效率，表示每一元資產投資會帶來多少銷貨。",
      "The sheet says it measures how efficiently assets are used to generate sales: for each dollar of assets invested, how much sales will be produced."),
    Q("tat-class", "profit", "tat", "classify",
      "公式表把總資產周轉率歸在哪一類？",
      "On the formula sheet, which group does total asset turnover belong to?",
      [
        ["盈利及投資回報", "Profitability and return"],
        ["管理效率", "Management efficiency"],
        ["變現能力", "Liquidity"],
        ["償債能力", "Solvency"]
      ],
      "公式表把總資產周轉率放在盈利及投資回報，和毛利率、淨利率、ROCE、每股盈利同一頁。",
      "The sheet places total asset turnover with profitability and return on investment, on the same page as the margins, ROCE and earnings per share."),
    Q("tat-c", "profit", "tat", "calc",
      "銷貨 $480,000，銷貨成本 $320,000，資產總額 $160,000。總資產周轉率是多少？",
      "Sales are $480,000, cost of goods sold is $320,000 and total assets are $160,000. What is the total asset turnover?",
      [
        ["3 次", "3 times"],
        ["2 次", "2 times"],
        ["0.33 次", "0.33 times"],
        ["3%", "3%"]
      ],
      "總資產周轉率 = 480,000 ÷ 160,000 = 3 次。2 次是誤用了銷貨成本。",
      "Total asset turnover = 480,000 ÷ 160,000 = 3 times. 2 times uses cost of goods sold."),
    Q("eps-f", "profit", "eps", "formula",
      "每股盈利（EPS）的公式是？",
      "What is the formula for earnings per share?",
      [
        ["（稅後淨利 − 優先股股息）÷ 已發行普通股股數", "(Net profit after tax − preference dividend) ÷ number of ordinary shares issued"],
        ["稅後淨利 ÷ 已發行普通股股數", "Net profit after tax ÷ number of ordinary shares issued"],
        ["（稅後淨利 − 優先股股息）÷ 已派普通股股息", "(Net profit after tax − preference dividend) ÷ ordinary dividend paid"],
        ["已派普通股股息 ÷ 已發行普通股股數", "Ordinary dividend paid ÷ number of ordinary shares issued"]
      ],
      "每股盈利先從稅後淨利減去優先股股息，再除以已發行普通股股數。除以已派股息的是股息覆蓋倍數。",
      "Earnings per share subtracts the preference dividend from profit after tax, then divides by the number of ordinary shares issued. Dividing by the dividend paid is dividend cover."),
    Q("eps-m", "profit", "eps", "meaning",
      "每股盈利用來做甚麼？",
      "What is earnings per share used for?",
      [
        ["量度每一股普通股攤到多少淨利，方便把投入的資金同每股盈利、每股全年股息比較", "It measures net income for each ordinary share, so the amount invested can be compared with EPS and the annual dividend per share"],
        ["量度股價是盈利的幾倍", "It measures how many times the share price covers earnings"],
        ["量度收帳需要幾多日", "It measures how many days collection takes"],
        ["量度營運資金是多少元", "It measures working capital in dollars"]
      ],
      "公式表說每股盈利用於投資決定：把投入的金額與（i）每股盈利及（ii）每股全年股息比較，看價錢是否合理。",
      "The sheet says EPS is useful for an investment decision: compare the amount invested with (i) EPS and (ii) the annual dividend per share."),
    Q("eps-c", "profit", "eps", "calc",
      "稅後淨利 $180,000，優先股股息 $20,000，已發行普通股 40,000 股。每股盈利是多少？",
      "Net profit after tax is $180,000, the preference dividend is $20,000 and 40,000 ordinary shares are issued. What is the earnings per share?",
      [
        ["$4", "$4"],
        ["$4.50", "$4.50"],
        ["$0.50", "$0.50"],
        ["4 次", "4 times"]
      ],
      "每股盈利 =（180,000 − 20,000）÷ 40,000 = $4。$4.50 是沒有減優先股股息。",
      "EPS = (180,000 − 20,000) ÷ 40,000 = $4. $4.50 forgets to deduct the preference dividend."),
    Q("dc-f", "profit", "dc", "formula",
      "普通股股息覆蓋倍數（dividend cover）的公式是？",
      "What is the formula for dividend cover for ordinary shares?",
      [
        ["（稅後淨利 − 優先股股息）÷ 已派普通股股息", "(Net profit after tax − preference dividend) ÷ ordinary dividend paid"],
        ["稅後淨利 ÷ 已派普通股股息", "Net profit after tax ÷ ordinary dividend paid"],
        ["已派普通股股息 ÷（稅後淨利 − 優先股股息）", "Ordinary dividend paid ÷ (net profit after tax − preference dividend)"],
        ["目前每股普通股市價 ÷ 每股盈利", "Current price per ordinary share ÷ earnings per share"]
      ],
      "分子與每股盈利相同：稅後淨利減優先股股息。分母是已派普通股股息。單位是次。",
      "The numerator matches EPS: profit after tax minus the preference dividend. The denominator is the ordinary dividend paid. The unit is times."),
    Q("dc-i", "profit", "dc", "interpret",
      "股息覆蓋倍數愈高，公式表的意思是？",
      "On the formula sheet, what does a higher dividend cover mean?",
      [
        ["日後較有機會維持這項普通股股息", "It is more likely that the ordinary dividend can be maintained in the future"],
        ["今年一定會加派股息", "The dividend must be increased this year"],
        ["股價一定更高", "The share price must be higher"],
        ["槓桿比率一定更低", "The gearing ratio must be lower"]
      ],
      "覆蓋倍數愈高，盈利相對已派普通股股息愈充裕，日後維持股息的機會愈大。這不等於今年一定加派。",
      "The higher the cover, the more likely the ordinary dividend can be maintained. That is not the same as a promise to raise the dividend this year."),
    Q("dc-growth", "profit", "dc", "interpret",
      "公式表對高增長公司有甚麼註明？",
      "What note does the formula sheet add about high-growth companies?",
      [
        ["它們把大部分淨利再投入業務", "They reinvest most of the net income into the business"],
        ["它們把全部淨利派作股息", "They pay out all net income as dividends"],
        ["它們沒有普通股", "They have no ordinary shares"],
        ["它們的槓桿比率一定是零", "Their gearing ratio must be zero"]
      ],
      "公式表註明高增長公司把大部分淨利再投資。覆蓋倍數高，可以是因為派息少、利潤再投入，而不一定是派了很多息。",
      "The sheet notes that high-growth companies reinvest most net income. A high cover can come from a small payout, not from a large dividend."),
    Q("dc-c", "profit", "dc", "calc",
      "稅後淨利 $220,000，優先股股息 $20,000，已派普通股股息 $50,000。股息覆蓋倍數是多少？",
      "Net profit after tax is $220,000, the preference dividend is $20,000 and the ordinary dividend paid is $50,000. What is the dividend cover?",
      [
        ["4 次", "4 times"],
        ["4.4 次", "4.4 times"],
        ["0.25 次", "0.25 times"],
        ["4%", "4%"]
      ],
      "股息覆蓋 =（220,000 − 20,000）÷ 50,000 = 4 次。4.4 次是沒有減優先股股息。",
      "Dividend cover = (220,000 − 20,000) ÷ 50,000 = 4 times. 4.4 times forgets the preference dividend."),
    Q("pe-f", "profit", "pe", "formula",
      "市盈率（price-earnings ratio）的公式是？",
      "What is the formula for the price-earnings ratio?",
      [
        ["目前每股普通股市價 ÷ 每股盈利", "Current price per ordinary share ÷ earnings per share"],
        ["每股盈利 ÷ 目前每股普通股市價", "Earnings per share ÷ current price per ordinary share"],
        ["目前每股普通股市價 ÷ 每股普通股股息", "Current price per ordinary share ÷ ordinary dividend per share"],
        ["每股盈利 × 已發行普通股股數", "Earnings per share × number of ordinary shares issued"]
      ],
      "市盈率 = 目前每股普通股市價 ÷ 每股盈利。它不是股息率。",
      "Price-earnings ratio = current price per ordinary share ÷ earnings per share. It is not a dividend yield."),
    Q("pe-m", "profit", "pe", "meaning",
      "市盈率反映甚麼？",
      "What does the price-earnings ratio indicate?",
      [
        ["普通股市價與每股盈利的關係，反映未來盈利前景（增長）", "The relationship between the ordinary share’s market price and EPS, and the outlook for future earnings (growth)"],
        ["公司一年內收齊應收貨款的次數", "How many times receivables are collected in a year"],
        ["負債佔資本的比重", "Debt as a share of capital"],
        ["毛利佔銷貨的百分比", "Gross profit as a percentage of sales"]
      ],
      "公式表說市盈率量度普通股市價與每股盈利的關係，反映未來盈利（增長）的前景。",
      "The sheet says the price-earnings ratio measures the relationship between the market price of the ordinary share and EPS, and indicates the outlook for future earnings, that is growth."),
    Q("pe-c", "profit", "pe", "calc",
      "目前每股普通股市價 $24，每股盈利 $4。市盈率是多少？",
      "The current price per ordinary share is $24 and earnings per share are $4. What is the price-earnings ratio?",
      [
        ["6 次", "6 times"],
        ["0.17 次", "0.17 times"],
        ["6%", "6%"],
        ["$96", "$96"]
      ],
      "市盈率 = 24 ÷ 4 = 6 次。0.17 次是把每股盈利除以股價。",
      "Price-earnings ratio = 24 ÷ 4 = 6 times. 0.17 times divides earnings per share by the price."),
    Q("profit-party", "profit", "profit-party", "meaning",
      "盈利能力同投資回報的比率，公式表說誰會關心？",
      "On the formula sheet, who is interested in profitability and return ratios?",
      [
        ["各方，包括債權人和投資者", "All parties, including creditors and investors"],
        ["只有短期供應商", "Short-term suppliers only"],
        ["只有核數師", "The auditor only"],
        ["只有員工", "Employees only"]
      ],
      "公式表說這類比率量度收入和經營成果，各方都會關心，包括債權人和投資者。",
      "The sheet says these ratios measure income and operating success. All parties are interested, including creditors and investors."),
    Q("profit-focus", "profit", "profit-focus", "meaning",
      "盈利及投資回報主要看損益表哪兩項？",
      "Which two income-statement items do profitability and return mainly focus on?",
      [
        ["利潤與銷貨", "Profit and sales"],
        ["流動資產與流動負債", "Current assets and current liabilities"],
        ["只看股價", "The share price alone"],
        ["只看存貨數量", "The quantity of inventory alone"]
      ],
      "公式表說這類比率主要看損益表的（1）利潤和（2）銷貨。",
      "The sheet says these ratios focus mainly on income-statement items: (1) profit and (2) sales."),

    Q("cmp-ind", "limits", "cmp-ind", "meaning",
      "想知道公司在行業內的相對表現，公式表用哪種比較？",
      "Which comparison does the sheet use to see a company’s relative performance within its industry?",
      [
        ["與行業平均比較", "Comparison with industry averages"],
        ["只與自己去年比較", "Comparison with the same company last year only"],
        ["只與一間競爭對手比較", "Comparison with one competitor only"],
        ["只看非貨幣項目", "Looking only at non-monetary items"]
      ],
      "與行業平均比較，是把項目對照行業平均，從而知道公司在行業內的相對表現。與競爭對手比較是另一種用途，用來判斷競爭位置。",
      "Industry-average comparison benchmarks an item against the industry and shows relative performance within the industry. Comparison with competitors is a separate use: competitive position."),
    Q("cmp-co", "limits", "cmp-co", "meaning",
      "與一間或多間競爭對手比較，公式表說主要判斷甚麼？",
      "What does the sheet say intercompany comparison is mainly for?",
      [
        ["公司的競爭位置", "The company’s competitive position"],
        ["公司在行業平均中的位置", "The company’s place against the industry average"],
        ["同一公司年內的轉變", "Movement within the same company during the year"],
        ["兩間公司的會計政策是否相同", "Whether two companies use the same accounting policies"]
      ],
      "公司之間的比較，是與一間或多間競爭公司對照，用來判斷競爭位置。",
      "Intercompany comparison benchmarks the company against one or more competitors and is used to determine its competitive position."),
    Q("cmp-trend", "limits", "cmp-trend", "meaning",
      "同一間公司今年同去年的比率比較，屬於？",
      "Comparing this year’s ratios with last year’s for the same company is which kind of analysis?",
      [
        ["趨勢分析，用來看出年內的轉變", "Trend analysis, to identify movement during the year"],
        ["行業平均比較", "Industry-average comparison"],
        ["公司之間比較", "Intercompany comparison"],
        ["貨幣計量的限制", "The money-measurement limitation"]
      ],
      "趨勢分析比較同一公司先前年度和本年度的比率，用來識別年內的變動。",
      "Trend analysis compares the same company’s prior-year and current-year ratios to identify movement during the year."),
    Q("cmp-use", "limits", "cmp-use", "classify",
      "以下哪項是公式表所講的比較用途，而不是比率限制？",
      "Which item is a use of comparison on the sheet, not a limitation of ratios?",
      [
        ["以今年與去年的比率看年內轉變", "Using this year and last year to see movement during the year"],
        ["比率建基於過去資料，過去不一定代表將來", "Ratios use past data, and the past does not necessarily show the future"],
        ["不同公司用不同會計政策，難以比較", "Different companies use different accounting policies, so comparison is difficult"],
        ["貨品質素等非貨幣項目看不到", "Non-monetary items such as the quality of goods are not shown"]
      ],
      "今年與去年比較是趨勢分析，屬於比率的用途。其餘三項是公式表列出的限制。",
      "This year against last year is trend analysis, which is a use of ratios. The other three are limitations listed on the sheet."),
    Q("lim-base", "limits", "lim-base", "meaning",
      "公式表說，比率分析有沒有效，取決於甚麼？",
      "On the formula sheet, what does the effectiveness of ratios depend on?",
      [
        ["底下財務資料的質素", "The quality of the underlying financial information"],
        ["背熟了幾多條公式", "How many formulas have been memorised"],
        ["下星期的股價", "Next week’s share price"],
        ["股東人數", "The number of shareholders"]
      ],
      "公式表開宗明義：比率有沒有效，取決於底下財務資料的質素。",
      "The sheet starts the limitations with this: the effectiveness of ratios depends on the quality of the underlying financial information."),
    Q("lim-quality", "limits", "lim-quality", "meaning",
      "底下資料差，比率會誤導。公式表舉的例子是？",
      "Poor underlying information can mislead the ratios. Which example does the sheet give?",
      [
        ["折舊和呆帳準備估計差", "Poor estimates of depreciation and of the allowance for doubtful debts"],
        ["公司名稱太長", "The company name is too long"],
        ["存貨用公斤而不是件數來點算", "Inventory is counted in kilograms rather than in units"],
        ["股息在星期五派發", "The dividend is paid on a Friday"]
      ],
      "公式表說，如果底下資料差，例如折舊和呆帳準備估計差，比率結果可以誤導。",
      "The sheet says results mislead if the underlying information is poor, for example a poor estimate of depreciation or of the allowance for doubtful debts."),
    Q("lim-past", "limits", "lim-past", "interpret",
      "公式表怎樣看「過去」？",
      "What does the sheet say about the past?",
      [
        ["比率用過去的財務資料，過去表現不一定代表將來", "Ratios use past financial information, and past performance does not necessarily indicate future performance"],
        ["過去表現一定可以推斷明年", "Past performance always shows next year"],
        ["比率用的是下一年的預算，所以能夠預測", "Ratios use next year’s budget, so they can forecast"],
        ["只有負比率才關乎過去", "Only a negative ratio has anything to do with the past"]
      ],
      "公式表指出比率建基於過去的資料，但公司過去的表現不一定表示將來的表現。",
      "The sheet says a ratio is based on past information, and past performance does not necessarily indicate future performance."),
    Q("lim-policy", "limits", "lim-policy", "interpret",
      "不同公司對同一項交易用不同的可接受會計政策。公式表的結論是？",
      "Different companies use different accepted accounting policies for the same transaction. What conclusion does the sheet draw?",
      [
        ["難以比較，也難以對表現下結論", "It is difficult to compare them and to draw a conclusion about their performance"],
        ["政策不同不影響任何比率", "Different policies do not affect any ratio"],
        ["只要計算比率就自動可以比較", "Calculating ratios automatically makes the comparison valid"],
        ["只有毛利率會受影響，其他比率不會", "Only the gross profit margin is affected"]
      ],
      "同一項交易可以採用不同的可接受會計政策，因此難以比較，也難以對表現下結論。",
      "Because different accepted policies may be used for the same transaction, it is difficult to compare the companies and draw a conclusion on performance."),
    Q("lim-symptom", "limits", "lim-symptom", "interpret",
      "公式表怎樣形容比率的解釋能力？",
      "How does the sheet describe what ratios can explain?",
      [
        ["只能指出徵狀，不能指出原因；不同人可以有不同解釋", "They identify symptoms, not causes, and different people can draw different interpretations"],
        ["一條比率就足以證明原因", "One ratio is enough to prove the cause"],
        ["所有人看到同一比率都只有一個解釋", "Everyone reading the same ratio has only one interpretation"],
        ["比率直接說明管理層當天做了甚麼決定", "A ratio states the decision management made that day"]
      ],
      "公式表說比率只能指出徵狀，不能指出原因，而且不同的人可以作出不同解釋。",
      "The sheet says ratios can only identify symptoms, not causes, and that different people can draw different interpretations."),
    Q("lim-money", "limits", "lim-money", "meaning",
      "公式表說，遵守貨幣計量會漏掉甚麼？",
      "What does the sheet say is missed because ratios follow the money-measurement concept?",
      [
        ["貨品質素、管理層、產品種類等非貨幣但重要的項目", "Non-monetary but significant items, such as the quality of goods, management and the diversity of products"],
        ["銷貨和利潤", "Sales and profit"],
        ["流動資產和流動負債", "Current assets and current liabilities"],
        ["已派股息", "Dividends already paid"]
      ],
      "比率遵守貨幣計量。貨品質素、管理層、產品種類等非貨幣但重要的項目，比率看不到。",
      "Ratios adhere to money measurement. Non-monetary but significant items, such as quality of goods, management and product diversity, are not reviewed.")
  ];

  const TOPICS = [
    { id: "mix", zh: "混合", en: "Mixed" },
    { id: "liquidity", zh: "變現能力", en: "Liquidity" },
    { id: "efficiency", zh: "管理效率", en: "Management efficiency" },
    { id: "solvency", zh: "償債能力", en: "Solvency" },
    { id: "profit", zh: "盈利及投資回報", en: "Profitability and return" },
    { id: "limits", zh: "比較與限制", en: "Comparisons and limits" }
  ];

  const TOPIC_IDS = { liquidity: 1, efficiency: 1, solvency: 1, profit: 1, limits: 1 };
  const KIND_IDS = { formula: 1, meaning: 1, interpret: 1, classify: 1, calc: 1 };

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function sample(pool, n, uniqueStem) {
    const shuffled = shuffle(pool);
    const picked = [];
    const stems = new Set();
    const kinds = new Set();
    function take(pred) {
      for (let i = 0; i < shuffled.length; i++) {
        if (picked.length >= n) return;
        const q = shuffled[i];
        if (picked.indexOf(q) !== -1) continue;
        if (!pred(q)) continue;
        picked.push(q);
        stems.add(q.stem);
        kinds.add(q.kind);
      }
    }
    if (uniqueStem) {
      take(function (q) { return !stems.has(q.stem) && !kinds.has(q.kind); });
      take(function (q) { return !stems.has(q.stem); });
    } else {
      take(function (q) { return !stems.has(q.stem) && !kinds.has(q.kind); });
      take(function (q) { return !kinds.has(q.kind); });
      take(function (q) { return !stems.has(q.stem); });
    }
    take(function () { return true; });
    return shuffle(picked);
  }

  function poolFor(topic) {
    if (topic === "mix") return BANK.slice();
    const out = [];
    for (let i = 0; i < BANK.length; i++) if (BANK[i].topic === topic) out.push(BANK[i]);
    return out;
  }

  function draw(pool, uniqueStem) {
    if (pool.length <= 10) return shuffle(pool);
    return sample(pool, 10, uniqueStem);
  }

  function paperFrom(list, keepOrder) {
    const src = keepOrder ? list.slice() : shuffle(list);
    return src.map(function (q) {
      return {
        id: q.id,
        topic: q.topic,
        stem: q.stem,
        kind: q.kind,
        zh: q.zh,
        en: q.en,
        whyZh: q.whyZh,
        whyEn: q.whyEn,
        answer: q.answer,
        choices: shuffle(q.choices.map(function (c) { return { id: c.id, zh: c.zh, en: c.en }; }))
      };
    });
  }

  function grade(paper, picks) {
    let score = 0;
    const wrong = [];
    for (let i = 0; i < paper.length; i++) {
      if (picks[i] === paper[i].answer) score++;
      else wrong.push(i);
    }
    return { score: score, total: paper.length, wrong: wrong };
  }

  function checkBank() {
    const ids = new Set();
    const topics = {};
    const kinds = {};
    BANK.forEach(function (q) {
      if (ids.has(q.id)) throw new Error("dup id " + q.id);
      ids.add(q.id);
      if (q.answer !== "a") throw new Error("answer " + q.id);
      if (!q.choices.length || q.choices[0].id !== "a") throw new Error("choice a " + q.id);
      const zh = new Set();
      const en = new Set();
      q.choices.forEach(function (c) {
        if (!c.zh || !c.en) throw new Error("empty choice " + q.id);
        if (zh.has(c.zh)) throw new Error("dup zh " + q.id);
        if (en.has(c.en)) throw new Error("dup en " + q.id);
        zh.add(c.zh);
        en.add(c.en);
      });
      if (!TOPIC_IDS[q.topic]) throw new Error("topic " + q.id);
      if (!KIND_IDS[q.kind]) throw new Error("kind " + q.id);
      if (!q.stem) throw new Error("stem " + q.id);
      topics[q.topic] = (topics[q.topic] || 0) + 1;
      kinds[q.kind] = (kinds[q.kind] || 0) + 1;
    });
    const stems = new Set(BANK.map(function (q) { return q.stem; }));
    if (stems.size < 10) throw new Error("stems " + stems.size);
    Object.keys(TOPIC_IDS).forEach(function (id) {
      if ((topics[id] || 0) < 4) throw new Error("thin " + id);
    });
    return { n: BANK.length, topics: topics, kinds: kinds, stems: stems.size };
  }

  const api = {
    BANK: BANK,
    TOPICS: TOPICS,
    sample: sample,
    poolFor: poolFor,
    draw: draw,
    paperFrom: paperFrom,
    grade: grade,
    checkBank: checkBank
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  const KINDS = {
    formula: { zh: "認公式", en: "Formula" },
    meaning: { zh: "文字意思", en: "Meaning" },
    interpret: { zh: "高低解釋", en: "High or low" },
    classify: { zh: "歸類", en: "Classify" },
    calc: { zh: "短計算", en: "Short sum" }
  };

  const state = {
    lang: "zh",
    phase: "pick",
    topic: "mix",
    paper: [],
    picks: [],
    revealed: [],
    index: 0,
    hint: ""
  };

  function $(id) { return document.getElementById(id); }
  function tt(zh, en) { return state.lang === "en" ? en : zh; }
  function topicMeta(id) {
    for (let i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return TOPICS[0];
  }
  function choiceText(q, id) {
    for (let i = 0; i < q.choices.length; i++) {
      if (q.choices[i].id === id) return state.lang === "en" ? q.choices[i].en : q.choices[i].zh;
    }
    return tt("（未作答）", "(no answer)");
  }

  function h(tag, props, kids) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "class") node.className = props[k];
        else if (k === "text") node.textContent = props[k];
        else if (k === "hidden") node.hidden = !!props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  function applyChrome() {
    const en = state.lang === "en";
    document.documentElement.lang = en ? "en" : "zh-HK";
    document.querySelectorAll(".zh").forEach(function (el) { el.hidden = en; });
    document.querySelectorAll(".en").forEach(function (el) { el.hidden = !en; });
    $("btn-en").classList.toggle("active", en);
    $("btn-zh").classList.toggle("active", !en);
    $("link-home").href = "../index.html?lang=" + (en ? "en" : "zh-hk");
    $("link-notes").href = "../econ_notes/bafs_501_financial_analysis.html?lang=" + (en ? "en" : "zh-hk");
    $("link-lab").href = "bafs_501_lab.html?lang=" + (en ? "en" : "zh-hk");
    document.title = tt("DSE BAFS｜財務分析公式自測", "DSE BAFS | Financial analysis formula test");
    const lead = document.querySelector(".lead");
    if (lead) lead.hidden = state.phase !== "pick";
  }

  function setLang(en) {
    state.lang = en ? "en" : "zh";
    const params = new URLSearchParams(location.search);
    params.set("lang", en ? "en" : "zh-hk");
    history.replaceState(null, "", "?" + params.toString() + location.hash);
    applyChrome();
    render();
  }

  function topicLabel(meta) {
    const pool = poolFor(meta.id);
    if (meta.id === "mix") return tt("混合 10 題", "Mixed, 10 questions");
    if (pool.length <= 10) return tt(meta.zh + " · " + pool.length + " 題全出", meta.en + " · all " + pool.length);
    return tt(meta.zh + " · 抽 10 題", meta.en + " · 10 from " + pool.length);
  }

  function startTopic(id) {
    const pool = poolFor(id);
    if (!pool.length) return;
    state.topic = id;
    state.paper = paperFrom(draw(pool, id === "mix"), true);
    state.picks = state.paper.map(function () { return ""; });
    state.revealed = state.paper.map(function () { return false; });
    state.index = 0;
    state.hint = "";
    state.phase = "quiz";
    history.replaceState(null, "", "?" + new URLSearchParams(location.search).toString() + "#" + id);
    applyChrome();
    render();
    window.scrollTo(0, 0);
  }

  function retryMissed() {
    const list = [];
    state.paper.forEach(function (q, i) {
      if (state.picks[i] !== q.answer) {
        for (let k = 0; k < BANK.length; k++) if (BANK[k].id === q.id) list.push(BANK[k]);
      }
    });
    if (!list.length) return;
    state.paper = paperFrom(list, true);
    state.picks = state.paper.map(function () { return ""; });
    state.revealed = state.paper.map(function () { return false; });
    state.index = 0;
    state.hint = "";
    state.phase = "quiz";
    applyChrome();
    render();
    window.scrollTo(0, 0);
  }

  function renderPick() {
    const stage = $("stage");
    stage.innerHTML = "";
    const grid = h("div", { class: "topic-grid" });
    TOPICS.forEach(function (meta) {
      const wide = meta.id === "mix" ? " wide" : "";
      const pressed = state.topic === meta.id ? "true" : "false";
      grid.appendChild(h("button", {
        type: "button",
        class: "topic-btn" + wide + (meta.id === "mix" ? " primary" : ""),
        "data-topic": meta.id,
        "aria-pressed": pressed,
        text: topicLabel(meta)
      }));
    });
    stage.appendChild(h("p", { class: "hint", text: tt("選一個範圍就開始。交一題才對答案。", "Pick a set to start. The answer appears after you submit.") }));
    stage.appendChild(grid);
    stage.onclick = function (e) {
      const btn = e.target.closest("[data-topic]");
      if (btn) startTopic(btn.getAttribute("data-topic"));
    };
  }

  function renderQuiz() {
    const stage = $("stage");
    const q = state.paper[state.index];
    const revealed = state.revealed[state.index];
    const pick = state.picks[state.index];
    const total = state.paper.length;
    const meta = topicMeta(state.topic);
    const kind = KINDS[q.kind];
    stage.innerHTML = "";
    const done = state.index + (revealed ? 1 : 0);
    const bar = h("div", { class: "bar" }, [h("span")]);
    bar.firstChild.style.width = Math.round(done / total * 100) + "%";
    stage.appendChild(h("p", { class: "progress", text: tt("第 " + (state.index + 1) + "／" + total + " 題", "Question " + (state.index + 1) + " / " + total) }));
    stage.appendChild(bar);
    stage.appendChild(h("p", { class: "meta" }, [
      h("span", { class: "pill", text: tt(meta.zh, meta.en) }),
      h("span", { class: "pill kind", text: tt(kind.zh, kind.en) })
    ]));
    stage.appendChild(h("h2", { class: "q", text: tt(q.zh, q.en) }));
    const list = h("div", { class: "opts" });
    q.choices.forEach(function (c) {
      let cls = "opt";
      if (revealed && c.id === q.answer) cls += " good";
      else if (revealed && c.id === pick) cls += " bad";
      else if (!revealed && c.id === pick) cls += " picked";
      const btn = h("button", {
        type: "button",
        class: cls,
        "data-choice": c.id,
        text: state.lang === "en" ? c.en : c.zh
      });
      if (revealed) btn.disabled = true;
      list.appendChild(btn);
    });
    stage.appendChild(list);
    if (state.hint) stage.appendChild(h("p", { class: "hint warn", text: state.hint }));
    if (!revealed) {
      stage.appendChild(h("button", { type: "button", class: "btn primary", "data-act": "submit", text: tt("提交答案", "Submit") }));
    } else {
      const ok = pick === q.answer;
      stage.appendChild(h("div", { class: "why " + (ok ? "ok" : "bad") }, [
        h("p", { class: "mark", text: ok ? tt("正確", "Correct") : tt("不對", "Incorrect") }),
        h("p", { text: tt(q.whyZh, q.whyEn) })
      ]));
      const last = state.index + 1 >= total;
      stage.appendChild(h("button", {
        type: "button",
        class: "btn primary",
        "data-act": "next",
        text: last ? tt("看分數", "See score") : tt("下一題", "Next")
      }));
    }
    stage.onclick = onQuizClick;
  }

  function onQuizClick(e) {
    const q = state.paper[state.index];
    if (!q) return;
    if (state.revealed[state.index]) {
      const next = e.target.closest("[data-act='next']");
      if (!next) return;
      if (state.index + 1 >= state.paper.length) state.phase = "result";
      else state.index++;
      state.hint = "";
      applyChrome();
      render();
      window.scrollTo(0, 0);
      return;
    }
    const opt = e.target.closest("[data-choice]");
    if (opt) {
      state.picks[state.index] = opt.getAttribute("data-choice");
      state.hint = "";
      render();
      return;
    }
    const submit = e.target.closest("[data-act='submit']");
    if (!submit) return;
    if (!state.picks[state.index]) {
      state.hint = tt("請先選一個答案。", "Choose an answer first.");
      render();
      return;
    }
    state.revealed[state.index] = true;
    state.hint = "";
    render();
  }

  function renderResult() {
    const stage = $("stage");
    const g = grade(state.paper, state.picks);
    const meta = topicMeta(state.topic);
    stage.innerHTML = "";
    stage.appendChild(h("p", { class: "meta" }, [h("span", { class: "pill", text: tt(meta.zh, meta.en) })]));
    stage.appendChild(h("p", { class: "score", text: g.score + tt("／", " / ") + g.total }));
    stage.appendChild(h("p", { class: "hint", text: g.wrong.length ? tt("以下是今次不對的題。", "These are the ones missed this round.") : tt("今次沒有錯題。", "None missed this round.") }));
    if (g.wrong.length) {
      const box = h("div", { class: "review" });
      g.wrong.forEach(function (i) {
        const q = state.paper[i];
        box.appendChild(h("div", { class: "miss" }, [
          h("p", { class: "q", text: tt(q.zh, q.en) }),
          h("p", { text: tt("你的答案：", "Your answer: ") + choiceText(q, state.picks[i]) }),
          h("p", { text: tt("正確答案：", "Correct answer: ") + choiceText(q, q.answer) }),
          h("p", { class: "why-line", text: tt(q.whyZh, q.whyEn) })
        ]));
      });
      stage.appendChild(box);
    }
    const actions = h("div", { class: "actions" });
    if (g.wrong.length) {
      actions.appendChild(h("button", {
        type: "button",
        class: "btn primary",
        "data-act": "retry",
        text: g.wrong.length === 1
        ? tt("重做這 1 題", "Retry this question")
        : tt("重做這 " + g.wrong.length + " 題", "Retry these " + g.wrong.length)
      }));
    }
    actions.appendChild(h("button", { type: "button", class: "btn", "data-act": "again", text: tt("再做這一範圍", "Try this set again") }));
    actions.appendChild(h("button", { type: "button", class: "btn ghost", "data-act": "back", text: tt("返回選範圍", "Back to the sets") }));
    stage.appendChild(actions);
    stage.onclick = function (ev) {
      const btn = ev.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      if (act === "retry") retryMissed();
      else if (act === "again") startTopic(state.topic);
      else if (act === "back") {
        state.phase = "pick";
        applyChrome();
        render();
        window.scrollTo(0, 0);
      }
    };
  }

  function render() {
    if (state.phase === "quiz") renderQuiz();
    else if (state.phase === "result") renderResult();
    else renderPick();
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    state.lang = params.get("lang") === "en" ? "en" : "zh";
    const hash = (location.hash || "").replace("#", "");
    if (TOPICS.some(function (t) { return t.id === hash; })) state.topic = hash;
    $("btn-zh").onclick = function () { setLang(false); };
    $("btn-en").onclick = function () { setLang(true); };
    applyChrome();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
