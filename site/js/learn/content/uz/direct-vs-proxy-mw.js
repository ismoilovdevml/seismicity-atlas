export default {
  sentence: `0.2 versiyadan beri atlasdagi har bir b qiymati faqat bevosita seysmik momentdan oʻlchangan ISC-GEM moment magnitudalaridan foydalanadi va boshqa shkalalardan konversiya qilingan “proksi” Mw qiymatlarini chiqarib tashlaydi.`,
  simple: [
    `ISC-GEM har bir zilzilani Mw bilan beradi. 1976 yildan beri hodisalarning aksariyati uchun bu Mw toʻlqin shakllaridan oʻlchangan (Global CMT loyihasi). Qolganlari uchun u mb yoki Ms dan formula yordamida <em>konversiya qilingan</em>: bu proksi.`,
    `Konversiya tarqoqlikka ega boʻlgan asosli taxmin. Koʻplab taxminiy magnitudalar tanlanmaning quyi qismida toʻplansa, ular oʻlchamlar taqsimotining shaklini oʻzgartiradi va b qiymati ham ular bilan birga siljiydi.`,
    `Shuning uchun atlas endi faqat oʻlchanganlarini saqlaydi. U foydalanadigan belgi har bir magnituda bilan berilgan noaniqlik: oʻlchangan Mw eng kichik qiymatga ega, proksilarniki esa kattaroq.`,
  ],
  analogy: `Odamlar boʻyi boʻyicha soʻrovnomani tasavvur qiling: koʻpchilikning boʻyi lenta bilan oʻlchangan, baʼzilariniki esa oyoq kiyimi oʻlchamidan taxmin qilingan. Taxminlar oʻrtacha hisobda toʻgʻri boʻlishi mumkin, lekin ular taqsimot chetlarini xiralashtiradi va baland boʻyli odamlar qanchalik tez kamayib borishi haqidagi statistika notoʻgʻri chiqadi.`,
  example: {
    title: `Konversiya qilingan magnitudalar b ga nima qiladi`,
    body: [
      `2004–2021 yillardagi {cut0} magnitudadan yuqori global sayoz hodisalar: ComCat ning mb si Mw ga konversiya qilinganda b = {bProxy} ({nProxy} ta hodisa). Manbadagi holicha ComCat {bNative}, ISC-GEM Mw esa {bIsc} beradi. Proksi baho juda yuqori, uchalasi faqat {agreeCut} magnitudadan boshlab mos keladi.`,
      `Shuning uchun atlas b ni {period} davridagi “{sample}” boʻyicha moslashtiradi. Bu tanlanma bilan global sayoz b davr boʻsagʻalaridan yuqori {gN} ta hodisadan {gB} [{gLo}, {gHi}] ga teng.`,
    ],
  },
  diagram: {
    title: `Kesimga nisbatan global sayoz b, 2004–2021`,
    caption: `Haqiqiy maʼlumotlar (global.json). Kesmalar ±1.96 standart xato. Konversiya qilingan mb egri chizigʻi past kesimlarda keskin koʻtariladi: u yerda mb toʻyinishi va konversiya qiyaligi taqsimotni buzadi.`,
    alt: `Uchta magnituda tanlovi uchun b ning magnituda kesimiga nisbatan chiziqli grafigi; ComCat konversiya qilingan mb chizigʻi ancha yuqoridan boshlanadi va yuqoriroq kesimlarda boshqalari bilan uchrashadi.`,
    comcat_proxy: `ComCat, Mw ga konversiya qilingan mb`, comcat_native: `ComCat manbadagi holicha (aralash turlar)`, iscgem: `ISC-GEM Mw`,
    xLabel: `Magnituda kesimi`, slider: `Kesim`,
    readout: `Kesim {cut}: konversiya qilingan mb b = {proxy} beradi, manbadagi holicha ComCat {native}, ISC-GEM Mw {isc}.`,
  },
  tech: [
    `Qoida: 1976–2021 yillardagi ISC-GEM hodisasi b tanlanmasiga faqat uning koʻrsatilgan Mw noaniqligi koʻpi bilan {magerr} boʻlsa, yaʼni u bevosita moment magnitudasi boʻlsa kiradi. Chastotalar, sonlar, Mc(t), hodisalar qatlamlari va Michael (2014) bilan taqqoslash barcha hodisalarni saqlaydi. Mc ning davr quyi chegaralari xuddi shu bevosita tanlanma boʻyicha qayta hisoblanadi, shuning uchun boʻsagʻalar va tanlanma bir-biriga mos keladi.`,
    `Nega noaniqlik bevosita Mw ni belgilaydi: ISC-GEM ning USGS ComCat dagi nusxasida bevosita/proksi belgisi yoʻq, lekin 1976–2021 yillarda birorta ham hodisaning noaniqligi 0.10 va 0.20 orasida emas, ComCat da Global CMT magnitudasi bilan juftlangan deyarli barcha hodisalarda esa u 0.10 ga teng (docs/method.md §2.1).`,
    `Nega chiqarib tashlash oʻrniga tuzatilmaydi: oʻlchami oʻzgarmas boʻlgan gauss magnituda xatolari b ni siljitmaydi (Tinti & Mulargia 1985). Proksilardagi ortiqcha b shovqin tushuntira oladiganidan ancha katta; u qaysi hodisalar proksi olganidan va b ni siljitadigan regressiya konversiyasidan kelib chiqadi (Castellaro et al. 2006).`,
    `Narxi va ochiq masala: 1976–2021 yillardagi taxminan har sakkizta hodisadan biri b tanlanmasidan chiqadi, 1976–2003 yillar uchun sayoz quyi chegara 0.1 ga koʻtariladi va sifat filtridan kamroq katak oʻtadi. Ikkala versiyada ham koʻrsatilgan kataklarda b biroz pasaydi, b-positive esa deyarli oʻzgarmadi; bu pasayishning bir qismi boʻsagʻadan biroz yuqoridagi GCMT oʻtkazib yuborgan hodisalar boʻlishi mumkin. Bu masala hal qilinmagan.`,
  ],
};
