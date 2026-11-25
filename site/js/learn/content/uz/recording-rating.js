export default {
  sentence: `Oddiy koʻrinish joy atrofidagi kuchli zilzilalar haqida global katalogda qancha maʼlumot borligini baholaydi. Toʻrt soʻzdan biri joy ostidagi katakning sifat kodi, toʻliqlik magnitudasi Mc va kataloglar tekshiruvidan toʻgʻridan-toʻgʻri olinadi. Mahalliy seysmik tarmoq haqida u hech narsa demaydi.`,
  simple: [
    `Xaritadagi har bir joy bitta statistika katagida yotadi (ilmiy koʻrinishda taxminan {area} km² li olti burchak). Bu katak uchun atlas uch narsani allaqachon biladi: uning <strong>sifat kodi</strong> (b qiymati qanchalik aniq), uning <strong>toʻliqlik magnitudasi Mc</strong> (katalog boʻshliqsiz qayd etadigan eng kichik magnituda) va ikki global katalog, ISC-GEM hamda USGS ComCat, umumiy hodisalar boʻyicha <strong>mos keladimi</strong>.`,
    `Baho shu uch narsani oddiy soʻzga aylantiradi: <strong>Juda yaxshi</strong>, <strong>Yaxshi</strong>, <strong>Cheklangan</strong> yoki <strong>Maʼlumot juda kam</strong>. Yangi hech narsa hisoblanmaydi va hech narsa yashirilmaydi: joy kartasi soʻz ostida uchala kirish qiymatini koʻrsatadi, “Bu joyning ilmiy koʻrinishi” tugmasi esa katakni toʻliq ochadi.`,
    `“Maʼlumot juda kam” eng koʻp uchraydigan javob. U global ISC-GEM katalogida 1976–2021 yillar uchun {radius} km ichida {nMin} tadan kam kuchli zilzila (taxminan {gMc} va undan katta magnituda; {yNew} yilgacha {fOld} va undan katta) borligini bildiradi, Yerning katta qismida shunday. U mahalliy tarmoqni emas, shu katalogni tavsiflaydi: Shveytsariya yoki Germaniya kabi zich milliy tarmoqqa ega tinch hududlar ham “Maʼlumot juda kam” bahosini oladi. Joyni mahalliy tarmoqlarning mintaqaviy qatlami qamrasa, karta unga havola beradi (“Mintaqaviy kataloglar”ga qarang). Baho xavfni ham tavsiflamaydi: tinch qayd kuchli zilzila boʻlmasligining isboti emas.`,
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
    `<table class="data"><thead><tr><th scope="col">Baho</th><th scope="col">Shart</th></tr></thead><tbody><tr><td>Maʼlumot juda kam</td><td>sifat kodi <code>insufficient</code> (chegaradan yuqori hodisalar {nMin} tadan kam)</td></tr><tr><td>Cheklangan</td><td>sifat kodi <code>C</code> yoki kataloglar belgisi <code>check</code></td></tr><tr><td>Juda yaxshi</td><td>sifat kodi <code>A</code>, kataloglar belgisi <code>ok</code> va Mc ≤ global sayoz Mc + 0.2 (= {mcMax})</td></tr><tr><td>Yaxshi</td><td>qolgan barcha <code>A</code> yoki <code>B</code> kataklar</td></tr></tbody></table>`,
    `Qoidalar shu tartibda tekshiriladi. Sifat kodi b ning 95 % li bootstrap oraligʻi kengligidan; kataloglar belgisi katak ichida juftlashtirilgan ISC-GEM va ComCat hodisalaridan (“Kataloglar muvofiqligi”ga qarang); Mc esa katak boʻyicha toʻliqlik bahosidan olinadi. Chegaraga barqarorlik belgisi va chuqur statistika ishlatilmaydi: ular ilmiy koʻrinishda koʻrsatiladi.`,
    `Nima sanaladi va cheklov: katak markazidan {radius} km ichidagi, 1976–2021 yillardagi sayoz (≤ 70 km), Mw bevosita oʻlchangan (noaniqlik ≤ 0.10) ISC-GEM hodisalari; har bir hodisa max(katak Mc, oʻz davrining global quyi chegarasi) dan yuqori boʻlishi kerak, quyi chegara {yNew} yilgacha {fOld}, {yNew} yildan {fNew}. Demak, baho global katalogda qancha kuchli zilzila borligini yuzlab kilometr aniqlikda oʻlchaydi, joy qanchalik yaxshi kuzatilishini emas. U koʻpincha ancha kichik hodisalarni qayd etadigan mahalliy tarmoqlar haqida hech narsa demaydi va xavf yoki tavakkal bahosi emas (Woessner & Wiemer 2005; Wiemer & Wyss 2002).`,
  ],
};
