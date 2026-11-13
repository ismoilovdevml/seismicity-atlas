export default {
  sentence: `Klasterlardan tozalash fazo va vaqt oynalari yordamida yirikroq hodisaning aftershoklari yoki forshoklariga oʻxshagan hodisalarni olib tashlaydi; bu global katalogda u b ni pasaytiradi va oyna tanloviga kuchli bogʻliq, shuning uchun xarita toʻliq katalogni koʻrsatadi.`,
  simple: [
    `Zilzilalar toʻp-toʻp boʻlib sodir boʻladi: yirik zilziladan keyin yaqin atrofda koʻplab kichikroq zilzilalar boʻladi. Baʼzi tadqiqotlarga faqat “mustaqil” asosiy zarbalar kerak, masalan, hodisalar vaqt boʻyicha tasodifiy sodir boʻladimi-yoʻqmi tekshirish uchun.`,
    `Gardner va Knopoff (1974) ning klassik usuli har bir hodisa atrofida “quti” chizadi: uning magnitudasi bilan oʻsadigan masofa va davomiylik. Yirikroq hodisa qutisi ichidagi kichikroq hodisalar bogʻliq deb belgilanadi va olib tashlanadi.`,
    `Magnitudasi 5 va undan yuqori boʻlgan global katalog uchun eng yirik hodisalar qutilari yillar davom etadi va yuzlab kilometrga yetadi, shuning uchun ular aftershoklardan ancha koʻp narsani olib tashlaydi. Olib tashlangan hodisalar asosan kichik boʻlgani uchun qolganlarining b qiymati pasayadi.`,
  ],
  analogy: `Doʻkonga kelgan odamlarni sanash, lekin tanish odamidan keyin bir soat ichida kelganlarni hisobga olmaslikni tasavvur qiling. Qisqa qoida bilan siz doʻstlar guruhlarini olib tashlaysiz; “bir yil ichida” qoidasi bilan esa doimiy xaridorlarning aksariyatini ham olib tashlaysiz va qolgan son doʻkondan koʻra koʻproq sizning qoidangiz haqida gapiradi.`,
  example: {
    title: `{loc} yaqinidagi subduksiya katagida klasterlardan tozalangan b`,
    body: [
      `Toʻliq katalog: b = {b} [{lo}, {hi}]. Gardner-Knopoff boʻyicha klasterlardan tozalangandan keyin: b = {bdecl} [{bdeclLo}, {bdeclHi}].`,
      `Ikkala qiymati ham bor {nShown} ta koʻrsatilgan sayoz katakda tozalangan minus toʻliq farqning medianasi {med}, tozalangan b esa {lower} ta katakda pastroq.`,
    ],
  },
  diagram: {
    title: `Fazo-vaqt oynalari klasterlangan hodisalarni olib tashlaydi`,
    caption: `Sintetik katalog: tasodifiy fon hodisalari va uchta ketma-ketlik. Oynalar eng yirik hodisadan boshlab pastga qarab ochiladi; oyna ichidagi hodisalar olib tashlanadi. Natija bu tanlovga qanchalik bogʻliqligini koʻrish uchun oyna masshtabini oʻzgartiring.`,
    alt: `Hodisalarning vaqt va masofa boʻyicha nuqtali grafigi; yirik hodisalar atrofida toʻrtburchaklar paydo boʻladi va ular ichidagi hodisalar kulrangga aylanadi; qolgan hodisalarning b qiymati pastda koʻrsatilgan.`,
    lgKept: `Qoldirilgan`, lgRemoved: `Bogʻliq sifatida olib tashlangan`, lgWindow: `Oyna`,
    xLabel: `Vaqt (yil)`, yLabel: `Zona boʻylab masofa (km)`,
    slider: `Oyna masshtabi`, all: `Barcha oynalarni koʻrsatish`,
    readout: `Oyna masshtabi {k}: {nw} ta oynadan {w} tasi ochildi, {n} ta hodisadan {kept} tasi qoldirildi. Barcha hodisalar b si {bAll}, qoldirilgan hodisalarniki {bKept}.`,
  },
  tech: [
    `ZMAP va OpenQuake dagi kabi Gardner-Knopoff oynalari (scripts/seislib.py, gk_windows), L masofa km da, T davomiylik kunlarda:<code class="lr-formula">L(M) = 10^(0.1238 M + 0.983),   T(M) = 10^(0.032 M + 2.7389) M ≥ 6.5 uchun, aks holda 10^(0.5409 M − 0.547)</code>Hodisalar eng yirigidan boshlab pastga qarab koʻrib chiqiladi; yirikroq hodisa oynasi ichidagi hodisa bogʻliq hisoblanadi.`,
    `Nega atlas asosiy b ni klasterlardan tozalamaydi: M ≥ 6.5 uchun vaqt oynasi bir yildan oshadi, shuning uchun global M ≥ 5 katalogda oynalar barcha hodisalarning, jumladan mustaqillarining ham katta qismini olib tashlaydi. Natijadagi tozalangan b asosan oyna tanlovini aks ettiradi. Kagan (2010) boshqa usul bilan tozalaydi va atlasning Gardner-Knopoff qiymati uning tozalangan global b sini takrorlamaydi; bu docs/validation.md da nomuvofiqlik sifatida koʻrsatilgan.`,
    `Baribir eʼlon qilinadi: tozalangan b va uning bootstrap oraligʻi maʼlumotlarda (<code>sh_bdecl</code>, <code>dp_bdecl</code>) va katak panelining barqarorlik blokida bor, shuning uchun taʼsir har bir katakda koʻrinadi.`,
    `Xuddi shu oynalar ketma-ketliklarda yana uchraydi: Ketma-ketliklar sahifasi mustaqil asosiy zarbalarni oʻxshash oyna bilan tanlaydi (radius Wells & Coppersmith 1994 dan, bir yil).`,
  ],
};
