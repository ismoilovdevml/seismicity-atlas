export default {
  sentence: `Kataloglar mosligi atlas foydalanadigan ikki global katalogdagi, USGS ComCat va ISC-GEM dagi bir xil zilzilalarni katakma-katak taqqoslaydi: ularning magnitudalari va joylashuvlari qanchalik farq qiladi va qaysi hodisalar faqat bittasida uchraydi.`,
  simple: [
    `Ikki agentlik bitta zilzilani turlicha tavsiflashi mumkin. ComCat (USGS) oʻrtacha hodisalar uchun koʻpincha hajmiy toʻlqin magnitudasi mb ni beradi; ISC-GEM esa hammasini moment magnitudasi sifatida qayta hisoblagan. Joylashuvlar ham bir necha kilometrdan oʻnlab kilometrgacha farq qiladi, chuqurliklar esa undan ham koʻproq.`,
    `Atlas ikki katalog orasida hodisalarni juftlaydi (vaqt va fazoda yaqin boʻlganlarini) va har bir katak uchun median magnituda va joylashuv farqlarini hamda faqat bitta katalogda topilgan hodisalarni umumlashtiradi.`,
    `Ular mos kelgan joyda katalog raqamlari aytilgan narsani anglatishiga ishonish mumkin. Ular farq qilgan joyda ikkalasidan olingan har qanday statistikaga ehtiyotkorlik bilan qarang.`,
  ],
  analogy: `Turli geodezistlar tuzgan bitta shaharning ikki xaritasiga oʻxshaydi: koʻchalarning aksariyati mos tushadi, baʼzilari biroz siljigan, bir nechtasi esa faqat bitta xaritada bor. Taqqoslash qayerni qayta tekshirish kerakligini koʻrsatadi.`,
  example: {
    title: `{loc} yaqinidagi juftlangan hodisalari koʻp katak`,
    body: [
      `{cn} ta hodisa juftlangan. ComCat Mw turi minus ISC-GEM Mw medianasi: {dmw}. ComCat mb minus ISC-GEM Mw medianasi: {dmb}. Median episentr farqi {dloc}, median chuqurlik farqi {ddep} km. Faqat ISC-GEM dagi hodisalar: {gonly}; faqat ComCat dagi Mw ≥ 6 hodisalar: {conly}.`,
      `Barcha kataklar boʻyicha: {ok} tasi “mos”, {check} tasi “tekshiring” deb belgilangan, {few} tasida esa xulosa uchun juftliklar juda kam. Kamida 10 ta juftlikka ega {nValid} ta katakda ComCat mb minus ISC-GEM Mw medianasi {medDmb}, ComCat Mw turi minus ISC-GEM Mw medianasi esa {medDmw}.`,
    ],
  },
  diagram: {
    title: `Kataloglar orasidagi magnituda farqlari, katak boʻyicha`,
    caption: `Haqiqiy maʼlumotlar: kamida 10 ta juftlangan hodisali har bir katak uchun bitta qiymat. Bu oʻlchamlarda mb Mw dan muntazam ravishda past, qisman toʻyinish tufayli; moment turidagi magnitudalar bir-biriga yaqin mos keladi (soyali: ±0.10 ichida).`,
    alt: `Kataklar boʻyicha median magnituda farqlari gistogrammasi; mb farqi noldan ancha pastda, Mw turi farqi esa nol atrofida markazlashgan.`,
    which: `Taqqoslash`, dmb: `ComCat mb − ISC-GEM Mw`, dmw: `ComCat Mw turi − ISC-GEM Mw`,
    xLabel: `Katakdagi median magnituda farqi`, yLabel: `Kataklar`, mine: `misoldagi katak`,
    read_dmb: `ComCat mb minus ISC-GEM Mw: {n} ta katak boʻyicha median {med}; {out} ta katakda farq 0.10 dan katta.`,
    read_dmw: `ComCat Mw turi minus ISC-GEM Mw: {n} ta katak boʻyicha median {med}; {out} ta katakda farq 0.10 dan katta.`,
  },
  tech: [
    `Juftlash: ISC-GEM va ComCat hodisalari 30 s va 100 km ichida boʻlsa, juftlik hosil qiladi; juftliklar ISC-GEM episentri joylashgan katakka biriktiriladi (docs/method.md §7).`,
    `<ul><li><code>c_dmw</code>: ComCat Mw turi minus ISC-GEM Mw medianasi.</li><li><code>c_dmb</code>: ComCat mb minus ISC-GEM Mw medianasi.</li><li><code>c_dloc</code>, <code>c_ddep</code>: median episentr (km) va chuqurlik farqlari.</li><li><code>c_gonly</code>: ComCat da jufti yoʻq ISC-GEM hodisalari; <code>c_conly</code>: ISC-GEM da jufti yoʻq ComCat Mw proksi ≥ 6.0 hodisalari.</li></ul>`,
    `Belgi: juftliklar 10 tadan kam boʻlsa <code>few</code>; |c_dmw| > 0.10, c_dloc > 30 km yoki (c_gonly + c_conly) / c_n > 0.10 boʻlsa <code>check</code>; aks holda <code>ok</code> (docs/data-schema.md).`,
    `Saytda: uchta varianti (belgi, ΔMw, episentr masofasi) bor “Moslik” qatlami va katak panelidagi kataloglar mosligi roʻyxati.`,
  ],
};
