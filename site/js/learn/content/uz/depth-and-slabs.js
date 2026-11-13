export default {
  sentence: `Aksariyat zilzilalar yuqori bir necha oʻn kilometrda sodir boʻladi, lekin subduksiya zonalarida ular choʻkayotgan plita (slab) ichida ham taxminan 700 km gacha uchraydi; atlas sayoz (≤ 70 km) va chuqurroq (> 70 km) hodisalarni xaritada alohida koʻrsatadi, chunki bu ikki populyatsiya turlicha xususiyatga ega.`,
  simple: [
    `Zilzila Yer ichidagi nuqtadan, <strong>gipotsentr</strong>dan boshlanadi; uning ustidagi yer yuzasidagi nuqta episentr deyiladi. Chuqurlik muhim: bir xil magnituda 400 km chuqurlikda boʻlsa, yer yuzasini ancha kuchsizroq silkitadi.`,
    `Bir plita boshqasining ostiga shoʻngʻigan joyda u choʻkish davomida sinishda davom etadi. Bunday zonani kesib oʻtadigan chiziq boʻylab zilzilalarni chuqurlik boʻyicha chizsangiz, slabni mantiyaga qadar kuzatib boradigan qiya polosa, Wadati-Benioff zonasi koʻrinadi.`,
    `Chuqur va sayoz zilzilalarning b qiymatlari turlicha, shuning uchun ularni aralashtirish ikkalasini ham xiralashtiradi. Xaritadagi chuqurlik almashtirgichi b, Mc va sifat qatlamlari qaysi populyatsiyani koʻrsatishini tanlaydi.`,
  ],
  analogy: `Kitob ostiga qiya holda itarilgan qogʻoz varagʻiga oʻxshaydi: burmalar varaq boʻylab pastga tushadi. Zilzilalar shu burmalar, ularning chuqurliklari esa varaqni chizib beradi.`,
  example: {
    title: `Tonga slabi orqali kesim`,
    body: [
      `M ≥ 6 hodisalar qatlamida {y0}–{y1} yillarda Tonga botigʻi yaqinida 16° va 24° jan. orasida {n} ta hodisa bor. Ulardan {nDeep} tasi 70 km dan chuqurroq; eng chuquri {deepest} da (M {deepestM}).`,
      `Butun dunyoda (1976–2021, bevosita Mw) sayoz hodisalar b = {gB}, chuqurroq hodisalar esa b = {dB} [{dLo}, {dHi}] beradi: chuqurroq populyatsiyada nisbatan koʻproq yirik hodisalar bor.`,
    ],
  },
  diagram: {
    title: `Tonga ostidagi gipotsentrlar, gʻarbdan sharqqa`,
    caption: `Haqiqiy maʼlumotlar: hodisalar qatlamidagi M ≥ 6 hodisalar, 16–24° jan., gʻarb-sharq chizigʻiga proyeksiyalangan (174° gʻar. dan masofa). Global kataloglarda hodisa chuqurliklari episentrlarga qaraganda kamroq aniq, koʻplab sayoz hodisalar esa belgilangan standart chuqurliklarda turadi. Yillarni tartib bilan qoʻshish uchun “Boshlash” tugmasini bosing.`,
    alt: `Chuqurlik pastga qarab ortadigan kesim: sayoz hodisalar botigʻ yaqinida toʻplangan, chuqurroq hodisalar polosasi esa gʻarbga qarab taxminan 700 km gacha qiyalanib tushadi.`,
    lgShallow: `Chuqurlik ≤ 70 km`, lgDeep: `Chuqurlik > 70 km`,
    xLabel: `174° gʻar. dan sharqqa masofa (km)`, yLabel: `Chuqurlik (km)`,
    split: `70 km: atlasning chuqurlik chegarasi`, east: `sharq (botigʻ tomoni)`, west: `gʻarb`,
    slider: `Shu yilgacha boʻlgan hodisalar`,
    readout: `{y} gacha: {n} ta hodisa, ulardan {deep} tasi 70 km dan chuqurroq.`,
  },
  tech: [
    `Chuqurlik sinflari: ≤ 70 km (<code>sh_*</code> maydonlari) va > 70 km (<code>dp_*</code>), har birining oʻz Mc, b, oraliq va sifati bor. Michael (2014) bilan taqqoslash uchun validatsiya uning 60 km lik chegarasidan foydalanadi. Michael 1964–2009 / 1918–2009 yillar uchun chuqur hodisalarda b ≈ 0.99, sayozlarida esa 1.05 ni topgan.`,
    `Slab yoshi va b: Nishikawa & Ide (2014) subduksiya zonalarida b subduksiyalanuvchi plita yoshi bilan ortishini topgan; atlas bu farqning ishorasini takrorlaydi (Validatsiya sahifasi, slab yoshi guruhlari).`,
    `Slab geometriyasi: Slab2 (Hayes et al. 2018) har bir yirik slabning 3D sirtini modellashtiradi. Atlas hozircha Slab2 dan foydalanmaydi; kelgusidagi 3D chuqurlik koʻrinishi gipotsentrlarni uch oʻlchamda koʻrsatadi.`,
    `Ehtiyot boʻling: teleseysmik chuqurliklar oʻnlab kilometrga xato boʻlishi mumkin, koʻplab sayoz hodisalar esa standart chuqurliklarda (masalan, 10, 15 yoki 33 km) belgilab qoʻyilgan. 70 km lik chegara ataylab qoʻpol.`,
  ],
};
