export default {
  sentence: `Atlasdagi har bir zilzila PB2002 modelidagi eng yaqin plita chegarasi turi (subduksiya, tizma, transform, rift va boshqalar) bilan belgilanadi, bu esa b ni tektonik sharoitlar orasida taqqoslash imkonini beradi.`,
  simple: [
    `Yerning tashqi qobigʻi plitalarga boʻlingan. Ular uchrashgan joyda turlicha harakatlanadi: biri ikkinchisining ostiga shoʻngʻiydi (subduksiya), ular bir-biridan uzoqlashadi (spreding tizmalari va riftlar) yoki bir-birining yonidan sirpanib oʻtadi (transform yoriqlar).`,
    `Peter Bird ning PB2002 modeli bu chegaralarni xaritaga tushiradi va har bir segmentni sinf bilan belgilaydi. Atlas har bir hodisaga 200 km ichidagi eng yaqin chegaraning sinfini beradi.`,
    `Sinflarning b qiymatlari oʻlchanadigan darajada farq qiladi. Spreding tizmalarida b eng yuqori (nisbatan koʻp kichik hodisalar); konvergent chegaralarda eng past, bu esa kuchlanish ortgan sari b pasayadi degan gʻoyaga mos keladi.`,
  ],
  analogy: `Muzlagan koʻldagi yoriqlar kabi: muz qatlamlari bir-biriga itarilgan joyda katta qirralar va baland qarsillashlar paydo boʻladi; ular ajralgan joyda koʻplab mayda yoriqlar. Chegara turi oʻlchamlar aralashmasini belgilaydi.`,
  example: {
    title: `Chegara sinfi boʻyicha b, butun dunyo`,
    body: [
      `1976–2021 yillardagi barcha bevosita Mw hodisalarni sinf boʻyicha birlashtirganda, eng yuqori b {hiName} ({hiCode}) da: {hiB}. Eng pasti {loName} ({loCode}) da: {loB}. Subduksiya zonalari {subB} beradi.`,
      `{nClasses} ta sinf orasida “none”, yaʼni chegaradan 200 km dan uzoqdagi hodisalar ham bor. Validatsiya sahifasi qiymatlarni va ularning tartibini eʼlon qilingan tadqiqotlar bilan taqqoslaydi.`,
    ],
  },
  diagram: {
    title: `PB2002 sinfi boʻyicha b va uning 95 % oraligʻi`,
    caption: `Haqiqiy maʼlumotlar (global.json). Vertikal chiziq b = 1. Sinfni slayder bilan yoki uning qatorini bosib tanlang.`,
    alt: `Plita chegarasi sinflari boʻyicha b ning nuqta va oraliq grafigi, eng yuqoridan eng pastgacha saralangan.`,
    slider: `Sinf`, colClass: `Sinf`, colN: `Hodisalar`,
    readout: `{code}, {name}: {n} ta hodisadan b = {b}. {what}`,
    classes: {
      SUB: `Bir plita boshqasining ostiga choʻkadi; Yerdagi eng yirik zilzilalar.`,
      CCB: `Ikki qitʼa toʻqnashadi, masalan, Himolayda.`,
      OCB: `Aniq choʻkuvchi plitasiz (slabsiz) okeanik litosfera ichidagi yaqinlashish.`,
      CTF: `Kontinental plitalar bir-birining yonidan sirpanadi, masalan, San-Andreas yorigʻida.`,
      OTF: `Okean oʻrta tizmalarini siljitadigan qisqa yoriqlar.`,
      CRB: `Qitʼa choʻzilib ajralmoqda, masalan, Sharqiy Afrikada.`,
      OSR: `Yangi okean tubi hosil boʻladi; kichik zilzilalar koʻp, yiriklari kam.`,
      none: `Har qanday PB2002 chegarasidan 200 km dan uzoqda: plitalarning ichki qismlari va keng deformatsiya zonalari.`,
    },
  },
  tech: [
    `Sinflar (Bird 2003): SUB subduksiya, CCB kontinental konvergent chegara, OCB okeanik konvergent chegara, CTF kontinental transform, OTF okeanik transform, CRB kontinental rift, OSR okeanik spreding tizmasi; 200 km ichida birorta ham chegara qadami (step) boʻlmasa, “none”.`,
    `Belgilash: har bir hodisa 200 km ichidagi eng yaqin PB2002 qadamining sinfini oladi. Bird & Kagan (2004) ehtiyotkorroq belgilashdan foydalangan; subduksiya zonalaridagi slab ichidagi hodisalar notoʻgʻri belgilanishi mumkin. Sinf b qiymatlari sinfning barcha hodisalarini birlashtiradi (bevosita Mw, har bir hodisa uchun alohida boʻsagʻalar) va kataklar bilan bir xil bootstrapdan foydalanadi.`,
    `Talqin: b ≈ 1.5 β, bu yerda β seysmik moment koʻrsatkichi; Bird & Kagan β ni aksariyat sinflar uchun deyarli universal, tizmalarda esa yuqoriroq deb topgan. Schorlemmer et al. (2005) b tashlama yoriqlanishda eng yuqori, yon siljimada oʻrtacha va surilmada eng past ekanini koʻrsatgan.`,
    `Saytda: xaritadagi plita chegaralari qoʻshimcha qatlami va har bir katak panelidagi sinf; sinflar boʻyicha b qiymatlari Validatsiya sahifasida.`,
  ],
};
