export default {
  sentence: `Oddiy koʻrinish “bu yerda zilzilalar qanchalik yaxshi qayd etiladi?” degan savolga toʻrt soʻzdan biri bilan javob beradi. Bu soʻz joy ostidagi katakning sifat kodi, toʻliqlik magnitudasi Mc va kataloglar tekshiruvidan toʻgʻridan-toʻgʻri olinadi.`,
  simple: [
    `Xaritadagi har bir joy bitta statistika katagida yotadi (ilmiy koʻrinishda taxminan {area} km² li olti burchak). Bu katak uchun atlas uch narsani allaqachon biladi: uning <strong>sifat kodi</strong> (b qiymati qanchalik aniq), uning <strong>toʻliqlik magnitudasi Mc</strong> (katalog boʻshliqsiz qayd etadigan eng kichik magnituda) va ikki global katalog, ISC-GEM hamda USGS ComCat, umumiy hodisalar boʻyicha <strong>mos keladimi</strong>.`,
    `Baho shu uch narsani oddiy soʻzga aylantiradi: <strong>Juda yaxshi</strong>, <strong>Yaxshi</strong>, <strong>Cheklangan</strong> yoki <strong>Maʼlumot juda kam</strong>. Yangi hech narsa hisoblanmaydi va hech narsa yashirilmaydi: joy kartasi soʻz ostida uchala kirish qiymatini koʻrsatadi, “Bu joyning ilmiy koʻrinishi” tugmasi esa katakni toʻliq ochadi.`,
    `“Maʼlumot juda kam” eng koʻp uchraydigan javob, chunki Yerning katta qismida kuchli zilzilalar kam. Bu xavfni emas, qaydni tavsiflaydi: tinch qayd kuchli zilzila boʻlmasligining isboti emas.`,
  ],
  analogy: `Tabeldagi “yaxshi” bahosi faqat uning ortidagi ballar koʻrinsa foydali. Baho bu soʻz; uning ostidagi sifat kodi, Mc va kataloglar tekshiruvi esa ballar.`,
  example: {
    title: `{nAll} ta katak qanday baholangan`,
    body: [
      `Har bir katakning sayoz (0–70 km) statistikasi boʻyicha: {nV} tasi “Juda yaxshi”, {nG} tasi “Yaxshi”, {nL} tasi “Cheklangan”, {nF} tasida esa maʼlumot juda kam.`,
      `“Juda yaxshi” misoli: {vLoc} yaqinidagi katakning sifati {vQ}, Mc {vMc} va kataloglar mos keladi. “Cheklangan” misoli: {lLoc} yaqinidagi katakning sifati {lQ}, shuning uchun uning b qiymati koʻrsatilmaydi.`,
      `“Juda yaxshi” uchun Mc {mcMax} dan oshmasligi kerak: bu ushbu nashrning global sayoz Mc qiymati ({gMc}) qoʻshuv 0.2.`,
    ],
  },
  diagram: {
    title: `Uch kirish qiymatidan soʻzgacha`,
    caption: `Bahoni koʻrish uchun sifat kodi, kataloglar tekshiruvi va Mc ni tanlang. Ustunlar ushbu nashrdagi har bir bahoga ega haqiqiy kataklarni sanaydi.`,
    alt: `“Juda yaxshi”, “Yaxshi”, “Cheklangan” va “Maʼlumot juda kam” deb baholangan kataklar sonining gorizontal ustunli diagrammasi; boshqaruv elementlarida tanlangan baho ajratib koʻrsatilgan.`,
    q: `Sifat kodi`, flag: `Kataloglar tekshiruvi`, mc: `Mc`,
    flagOk: `mos`, flagCheck: `mos emas`, flagFew: `umumiylari kam`, insufficient: `yetarli emas`,
    xLabel: `Kataklar soni`,
    readout: `Sifat {q}, kataloglar: {flag}, Mc {mc}: {rating}.`,
    colRating: `Baho`, colCells: `Kataklar`,
  },
  tech: [
    `Qoida joyni oʻz ichiga olgan katakning sayoz (≤ 70 km) statistikasiga qoʻllanadi (nuqta olti burchak ichida; bunday katak boʻlmasa, eng yaqin katak markazi):`,
    `<table class="data"><thead><tr><th scope="col">Baho</th><th scope="col">Shart</th></tr></thead><tbody><tr><td>Maʼlumot juda kam</td><td>sifat kodi <code>insufficient</code> (Mc dan yuqori hodisalar {nMin} tadan kam)</td></tr><tr><td>Cheklangan</td><td>sifat kodi <code>C</code> yoki kataloglar belgisi <code>check</code></td></tr><tr><td>Juda yaxshi</td><td>sifat kodi <code>A</code>, kataloglar belgisi <code>ok</code> va Mc ≤ global sayoz Mc + 0.2 (= {mcMax})</td></tr><tr><td>Yaxshi</td><td>qolgan barcha <code>A</code> yoki <code>B</code> kataklar</td></tr></tbody></table>`,
    `Qoidalar shu tartibda tekshiriladi. Sifat kodi b ning 95 % li bootstrap oraligʻi kengligidan; kataloglar belgisi katak ichida juftlashtirilgan ISC-GEM va ComCat hodisalaridan (“Kataloglar muvofiqligi”ga qarang); Mc esa katak boʻyicha toʻliqlik bahosidan olinadi. Chegaraga barqarorlik belgisi va chuqur statistika ishlatilmaydi: ular ilmiy koʻrinishda koʻrsatiladi.`,
    `Cheklov: baho oʻrtacha va kuchli zilzilalar (M ≥ 4.5–6) katalogini yuzlab kilometr aniqlikda tavsiflaydi. U koʻpincha ancha kichik hodisalarni qayd etadigan mahalliy tarmoqlar haqida hech narsa demaydi va xavf yoki tavakkal bahosi emas (Woessner & Wiemer 2005; Wiemer & Wyss 2002).`,
  ],
};
