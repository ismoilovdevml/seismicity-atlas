export default {
  sentence: `Seysmik moment balansi GNSS va InSAR o‘lchagan qobiq deformatsiyasi to‘playdigan momentni zilzilalar bo‘shatgan moment bilan taqqoslaydi; ularning nisbati ba’zan seysmik bog‘lanish deb ataladi.`,
  simple: [
    `Plitalar va qobiq bloklari yiliga bir necha millimetr siljiydi. Qobiq qulflangan joyda bu harakat prujina burilgandek deformatsiya sifatida to‘planadi. Zilzilalar uni bo‘shatadi. Seysmik moment (qattiqlik × yoriq maydoni × siljish) zilzila kattaligini to‘plangan deformatsiya bilan bir xil birliklarda o‘lchaydi.`,
    `1904 yildan beri barcha zilzilalarni qo‘shib, geodezik tezlikka bo‘lish nisbatni beradi. 1 dan past qiymat “taqchillik”, yuqorisi “ortiqcha”ga o‘xshaydi. Lekin Tyan-Shan kabi mintaqada eng kuchli zilzilalar bir necha asrda bir qaytadi, shuning uchun 120 yildagi bitta hodisa nisbatni hal qiladi.`,
    `Shu sababli atlas nisbatni hech qachon yolg‘iz ko‘rsatmaydi: doim 95 % oralig‘i va p_full bilan, ya’ni shu uzunlikdagi simulyatsiya qilingan to‘liq bog‘langan kataloglarning kuzatilganidan kam chiqaradigan ulushi bilan. Deformatsiyaning bir qismi zilzilasiz sirpanish va burmalanishga ham ketishi mumkin.`,
  ],
  analogy: `Uy byudjetini yillik sug‘urta to‘lovi tushgan bitta oyga qarab baholash: o‘sha oy ortiqcha sarflangandek, keyingi o‘n bir oy tejamkordek ko‘rinadi va hech biri yil muvozanatda bo‘lgan-bo‘lmaganini aytmaydi.`,
  example: {
    title: `Tyan-Shan, butun tizma`,
    body: [
      `To‘liq bog‘lanishdagi geodezik moment tezligi: yiliga {mg} [{mgLo}, {mgHi}] × 10¹⁹ N m. 1904 yildan beri kuzatilgan seysmik chiqarishning shu tezlikka nisbati: {r} [{lo}, {hi}] (95 %), p_full {p}. Katalog shovqinidan tashqari taqchillik uchun p_full 0.05 dan past bo‘lishi kerak; bu yerda katalog shovqinidan tashqari aniqlanadigan taqchillik yo‘q.`,
      `Markaziy Tyan-Shanda nisbat {cr} [{clo}, {chi}], p_full {cp}; uning eng kuchli zilzilasini (Mw {cm}, {cy}) olib tashlash markaziy qiymatni {ck} marta o‘zgartiradi. 1964 yildan beri kuzatilgan {n6} ta Mw ≥ 6 hodisa chastotasida butun tizma balansini muvozanatlaydigan burchak magnitudasi Mw {bal}.`,
    ],
  },
  diagram: {
    title: `To‘liq bog‘langan zona qisqa katalogda qanday ko‘rinadi`,
    caption: `Sintetik, belgilangan urug‘ bilan. To‘q sariq: butun Tyan-Shan tizmasining to‘liq bog‘lanishda to‘planadigan geodezik balansi. Ko‘k: o‘rtacha aynan shu balansni bo‘shatadigan simulyatsiya qilingan katalog zilzilalari (kuzatilgan Mw ≥ 6 chastotasi, tizma b qiymati, muvozanatlovchi burchak magnitudasi). Katalog uzunligini o‘zgartiring; zinapoyalar alohida kuchli zilzilalar.`,
    alt: `To‘plangan geodezik momentning to‘g‘ri chizig‘i va bo‘shatilgan seysmik momentning zinapoyasi: u o‘n yillab orqada qoladi va har bir kuchli zilzilada oldinga sakraydi.`,
    lgGeod: `Geodezik balans (to‘liq bog‘lanish)`,
    lgSeis: `Simulyatsiya qilingan zilzilalar bo‘shatgan`,
    xLabel: `Katalog yillari`,
    yLabel: `Moment, 10²¹ N m`,
    bigLabel: `eng kattasi Mw {m}`,
    readout: `{y} yildan keyin: bo‘shatilgan / to‘plangan = {ratio}, {n} ta simulyatsiya qilingan Mw ≥ 6 zilziladan. Jadval 120 yillik 200 ta tarix bo‘yicha tarqalishni beradi.`,
    slider: `Katalog uzunligi`,
    yearsFmt: `{y} yil`,
    again: `Boshqa tarixni simulyatsiya qilish`,
    colQ: `Protsentil, 120 yillik 200 ta tarix`,
    colRatio: `Bo‘shatilgan / to‘plangan`,
  },
  tech: [
    `Geodezik moment tezligi: Ṁg = 2 μ H Σ A ε̇, bunda ε̇ = max(|ε̇1|, |ε̇2|, |ε̇1 + ε̇2|) (Savage & Simpson 1997), Ou va boshq. (2026) hamda Chang va boshq. (2025) ning 0.05° deformatsiya tezligi to‘rlarida, μ 28–33 GPa va H 15–25 km tekis taqsimotdan olinadi. Bu to‘liq bog‘lanishdagi minimal moment.`,
    `Seysmik moment tezligi: ISC-GEM va ComCat Mw ≥ 5.8, chuqurlik ≤ 70 km, har bir magnituda oralig‘i o‘zining to‘liq davri bo‘yicha jamlanadi (Michael 2014), oraliqda Mw noaniqligi hisobga olinadi; hamda kesilgan Gutenberg-Rixter qonunidan uzoq muddatli tezlik (Kagan 2002).`,
    `p_full: to‘liq bog‘lanishda 1904 yildan kesimgacha 4 000 ta simulyatsiya qilingan katalog, har biri balansni muvozanatlaydigan burchak magnitudasi bilan (Bird & Kagan 2004), xuddi shu oraliqlar bo‘yicha baholovchi bilan tahlil qilinadi. p_full kuzatilganidan kam chiqaradiganlar ulushi.`,
    `Tekshiruv: Kostrov arifmetikasi Molnar & Ghose (2000) ni takrorlaydi, 6.86 ga qarshi 7 ± 2 mm/yil; 82° shq. dan g‘arbdagi deformatsiya ulushi Chang va boshq. (2025) bilan aytilgan aniqlikda mos. Molnar & Ghose momentlari bilan butun tizma nisbati ikki barobar kamayadi, shuning uchun dastlabki magnitudalar cheklov sifatida keltirilgan.`,
  ],
};
