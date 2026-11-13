export default {
  sentence: `Toʻliqlik magnitudasi, Mc, katalog muayyan joy va davrdagi deyarli barcha zilzilalarni qayd etadigan eng kichik magnituda.`,
  simple: [
    `Seysmik tarmoqlar kichik zilzilalarni oʻtkazib yuboradi: ular yetarlicha stansiya qayd etishi uchun juda kuchsiz yoki kattaroq zilzila kodasida yashirinib qoladi. Muayyan oʻlchamdan yuqorida hech narsa oʻtkazib yuborilmaydi. Oʻsha oʻlcham Mc dir.`,
    `Zilzilalarni oʻlchami boʻyicha sanaydigan har qanday statistika, jumladan b qiymati ham, faqat Mc va undan yuqori hodisalardan foydalanishi kerak. Undan pastda sonlar Yer tufayli emas, tarmoq tufayli kamayadi.`,
    `Mc vaqt va joyga qarab oʻzgaradi. Tarmoqlar oʻn yilliklar davomida yaxshilangan, shuning uchun bir xil mintaqada bugungi Mc 1980 yildagidan past. Stansiyalardan uzoqdagi okeanlarda Mc asboblar bilan yaxshi jihozlangan quruqlikdagidan yuqori.`,
  ],
  analogy: `Koʻzlari belgilangan oʻlchamdagi baliq toʻri koʻzlardan katta har bir baliqni va kichiklarining faqat bir qismini ushlaydi. Toʻrdagi kichik baliqlarni sanash dengiz haqida emas, toʻr haqida maʼlumot beradi. Mc toʻr koʻzining oʻlchami.`,
  example: {
    title: `{loc} yaqinidagi hodisalari koʻp subduksiya katagi`,
    body: [
      `Bu katakda (sayoz hodisalar, ISC-GEM Mw) eng koʻp uchraydigan magnituda boʻlagi (maksimal egrilik bahosi, MAXC) {maxc}. Atlas unga 0.2 qoʻshadi va Mc = {mc} ni oladi, bootstrap diapazoni {mcLo}–{mcHi}.`,
      `Har bir hodisa oʻz davrining global quyi chegarasidan ham oʻtishi kerak: {per0} uchun {floor0} va {per1} uchun {floor1}. Shunday qilib, bu yerda amaldagi boʻsagʻa katak Mc va davr quyi chegarasining kattasi.`,
      `Taqqoslash uchun, manbadagi holicha USGS oqimi (asosan mb) bu yerda 2010 yildan beri taxminan {mcCc} dan, 1973–1989 yillarda esa {mcCc0} dan toʻliq. Zich mintaqaviy tarmoq ancha kichik hodisalarni koʻradi: {region} katalogi ({regionMag}) odatda taxminan {regionMc} dan toʻliq.`,
    ],
  },
  diagram: {
    title: `Haqiqiy chastota-magnituda taqsimotida Mc ni tanlang`,
    caption: `Haqiqiy maʼlumotlar: misoldagi katakda har 0.1 lik boʻlakdagi sayoz ISC-GEM Mw hodisalari soni. Kulrang boʻlaklar tanlangan Mc dan past va hisobga olinmaydi. Koʻrsatilgan b barcha yillar uchun bitta boʻsagʻadan foydalanadi; atlas esa har bir hodisa uchun alohida boʻsagʻadan foydalanadi, shuning uchun uning qiymati biroz farq qiladi.`,
    alt: `Har bir magnituda boʻlagidagi hodisalar sonining ustunli grafigi; ustunlar choʻqqigacha (MAXC) koʻtariladi, keyin pasayadi. Shtrixli Mc chizigʻidan pastdagi ustunlar kulrang.`,
    maxc: `MAXC`,
    slider: `Mc`,
    useMaxc: `MAXC + 0.2 = {m}`,
    useAtlas: `Atlas Mc {m}`,
    readout: `Mc {mc}: unga teng yoki undan yuqori {n} ta hodisa; bitta boʻsagʻali b = {b} (bu katak uchun atlas b si: {atlas}).`,
  },
  tech: [
    `Baholovchi: 0.1 lik boʻlaklarga ajratilgan magnitudalar boʻyicha maksimal egrilik plyus 0.2 (MAXC + 0.2, Woessner & Wiemer 2005). MAXC eng koʻp hodisali boʻlak; u Mc ni kam baholashga moyil, shuning uchun +0.2 qoʻshiladi. Global taqqoslash uchun moslik darajasi (GFT, Wiemer & Wyss 2000) va b barqarorligi (MBS) usullari ham hisoblanadi; MAXC va GFT past, MBS esa yuqori chiqishga moyil, shuning uchun ular birgalikda Mc ni ikki tomondan chegaralaydi (Mignan & Woessner 2012).`,
    `Vaqtga bogʻliq toʻliqlik: 1976–2003 va 2004–2021 yillar uchun har bir chuqurlik sinfida global quyi chegara oʻsha davrdagi barcha bevosita Mw hodisalarining max(MAXC + 0.2, MBS) qiymati sifatida olinadi. Har bir hodisaning boʻsagʻasi <code>thrᵢ = max(Mc_cell, floor(period of event i))</code>. Katak boʻsagʻani koʻtarishi mumkin, lekin uni hech qachon quyi chegaradan pastga tushira olmaydi.`,
    `Har bir hodisa uchun alohida boʻsagʻali b: istalgan boʻsagʻadan ortiq magnituda bir xil β bilan eksponensial taqsimlangani uchun <code class="lr-formula">β̂ = n / Σ (mᵢ − (thrᵢ − ΔM/2)),   b = β̂ / ln 10</code>(har bir hodisa uchun alohida Mc li Aki-Utsu). Toʻliqligi turlicha boʻlgan davrlar boʻyicha bitta past boʻsagʻa b ni pastga siljitadi.`,
    `Saytda: Mc qatlami (ISC-GEM yoki 2010 dan maʼlumotlar chegarasigacha va 1973–1989 yillar uchun ComCat, oʻzining asosan mb boʻlgan magnitudasida), katak panelidagi Mc va uning diapazoni, katakning FMD grafigidagi shtrixli Mc chizigʻi va katak tafsilotlaridagi Mc(t) grafigi.`,
  ],
};
