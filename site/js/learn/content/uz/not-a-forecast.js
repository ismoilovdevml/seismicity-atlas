export default {
  sentence: `Atlas zilzila kataloglari oʻtmishda nimani qayd etganini tavsiflaydi; u keyingi zilzila qachon, qayerda yoki qanchalik kuchli boʻlishini bashorat qilmaydi va rasmiy seysmik xavf xaritasi emas.`,
  simple: [
    `b qiymati, toʻliqlik darajasi yoki chastota koʻplab oʻtgan zilzilalarni umumlashtiradi. Bu uzoq muddatli oʻrtachaga oʻxshaydi. Zilzilalar oʻrtachaga rioya qilmaydi: ular vaqt boʻyicha toʻplanadi, uzoq tinch davrlar esa odatiy hol.`,
    `Bugungi kunda hech bir usul muayyan zilzilaning vaqti, joyi va oʻlchamini bashorat qila olmaydi. Ehtimoliy prognozlar va xavf xaritalari mavjud, lekin ularni rasmiy agentliklar ancha koʻp tarkibiy qismlardan tuzadi: yoriq modellari, grunt harakati modellari, mahalliy grunt taʼsirlari va puxta sinovlar.`,
    `Xavfsizlik qarorlari, qurilish normalari yoki sugʻurta uchun bu atlasdan emas, milliy seysmologiya agentligingiz va rasmiy xavf modellaridan foydalaning.`,
  ],
  analogy: `Iqlim jadvali iyul odatda quruq boʻlishini aytadi; kelasi seshanba yomgʻir yogʻish-yogʻmasligini esa ayta olmaydi. Buning uchun aynan shu ish bilan shugʻullanadigan mutaxassislar tuzgan prognoz kerak.`,
  example: {
    title: `{loc} yaqinidagi bitta faol katakning yillik sonlari`,
    body: [
      `ComCat {y0}–{y1} yillarda bu katakning tanlanma doirasida yiliga oʻrtacha {mean} ta magnitudasi 4.5 va undan yuqori zilzilani qayd etgan, lekin yillik son {min} ({yMin}) dan {max} ({yMax}) gacha oʻzgargan.`,
      `Katakning oʻzidagi uzoq muddatli Mw ≥ 6 chastotasi yiliga taxminan {perYear} ta shunday hodisaga mos keladi. Bu oʻrtacha qaysi yilda shunday hodisa boʻlishi haqida hech narsa aytmaydi.`,
    ],
  },
  diagram: {
    title: `Haqiqiy yillar va oʻrtachasi bir xil tasodifiy yillar`,
    caption: `Koʻk: haqiqiy yillik sonlar (manbadagi holicha ComCat M ≥ 4.5, katak tafsilot fayli; joriy toʻliq boʻlmagan yil hisobga olinmagan). Toʻq sariq: oʻrtachasi bir xil va vaqti butunlay tasodifiy boʻlgan simulyatsiya qilingan tarix. Haqiqiy sonlar keskinroq oʻzgaradi, chunki zilzilalar toʻplanadi; hech bir qator keyingi yilgi sonni aytmaydi.`,
    alt: `Har yil uchun juft ustunlar: haqiqiy sonlar vaqti-vaqti bilan keskin choʻqqilar bilan kuchli oʻzgaradi; simulyatsiya qilingan tasodifiy sonlar shtrixli oʻrtacha chiziq atrofida kamroq oʻzgaradi.`,
    lgReal: `Haqiqiy yillik son`, lgSim: `Tasodifiy, oʻrtachasi bir xil`,
    xLabel: `Yil`, yLabel: `Yiliga hodisalar`,
    again: `Boshqa tarixni simulyatsiya qilish`,
    readout: `Oʻrtacha yiliga {mean}. Haqiqiy yillar {rmin}–{rmax} oraligʻida; bu simulyatsiya qilingan tarix {smin}–{smax} oraligʻida.`,
  },
  tech: [
    `Atlas nima: noaniqligi bilan berilgan tavsifiy katalog statistikasi (Mc, oraliqli b, chastotalar, moslik, retrospektiv Omori moslashtirishlari). U prognoz modeli emas va shunday model sifatida sinovdan oʻtkazilmagan.`,
    `Nega statistika bashorat emas: chastotasi maʼlum boʻlgan Puasson yoki klasterli (ETAS turidagi) jarayon ham alohida hodisalar vaqtini tasodifiy qoldiradi. Kichik tanlanmalardagi fazoviy b qiymati kontrastlari artefakt boʻlishi mumkin (Marzocchi et al. 2020), eng yirik hodisalar esa uzoq kataloglarni ham hayratda qoldirishi mumkin (Kagan & Jackson 2013, Tohoku haqida).`,
    `Rasmiy maʼlumotni qayerdan topish mumkin: milliy seysmologiya yoki geologiya xizmatingiz; global maʼlumot uchun GEM Global Seismic Hazard Map (quyida havola; CC BY-NC-SA, biz faqat unga havola beramiz); USGS AQSH dagi va baʼzi global muhim hodisalar uchun aftershok prognozlarini oʻz hodisa sahifalarida eʼlon qiladi.`,
    `Har bir sahifadagi va maʼlumot fayllaridagi ogohlantirish ham xuddi shuni aytadi: tadqiqot va taʼlim uchun katalog statistikasi; zilzila prognozi emas va rasmiy seysmik xavf xaritasi emas.`,
  ],
};
