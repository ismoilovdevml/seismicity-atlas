export default {
  sentence: `Induksiyalangan zilzilalar inson faoliyati natijasida yuzaga keladi yoki qo‘zg‘atiladi: gaz qazib olish, oqova suvni yer ostiga haydash yoki suv omborini to‘ldirish; Niderlandiyadagi Groningen gaz koni Yevropada eng yaxshi qayd etilgan misol.`,
  simple: [
    `G‘ovak qumtoshdan gaz olinganda undagi bosim pasayadi. Tog‘ jinsi har metrga millimetrning bir ulushiga siqiladi va konni kesib o‘tgan yoriqlarga qo‘shimcha kuchlanish tushadi. Bu kuchlanish bo‘shaganda yoriq siljiydi: kichik, odatda sayoz (taxminan 3 km) zilzila, shuning uchun hatto 3 magnituda ham uylarga zarar yetkazishi mumkin.`,
    `Bunday zilzilalar soni qazib olish tarixiga ergashadi, lekin kechikish bilan va birga-bir emas. Groningenda gaz 1963 yildan qazib olingan; birinchi qayd etilgan zilzila 1991 yilda, eng kattasi (ML 3.6) 2012 yilda bo‘lgan, qazib olish 2023 yilda to‘xtagandan keyin ham zilzilalar davom etdi.`,
    `Atlas yozuvni ko‘rsatadi: oylik qazib olish, oylik zilzilalar, b-qiymatlar va e’lon qilingan tadqiqotlar bilan taqqoslash. U fizikani modellashtirmaydi va kelgusi zilzilalarni bashorat qilmaydi.`,
  ],
  analogy: `Ramkaga yopishtirilgan gubkani siqish: qanchalik kuchli va uzoq siqsangiz, yelim choklari shunchalik ko‘p yoriladi, ba’zilari esa qo‘yib yuborganingizdan keyin ham bir muddat yorilishda davom etadi.`,
  example: {
    title: `Groningen: qazib olish va ML ≥ {mc} zilzilalar`,
    body: [
      `Yiliga ML {mc} va undan katta zilzilalar: 2003–2013 yillarda, qazib olish {peakYear} yildagi {peak} milliard m³ cho‘qqisiga ko‘tarilganda {rise}, cheklovlarning dastlabki besh yilida (2014–2018) {restr} va qazib olish to‘xtagandan keyin {after} (95 % oraliqlar).`,
      `{years} davomida yillik qazib olish va zilzilalar soni o‘rtasidagi rang korrelyatsiyasi o‘sha yil uchun {rho}, bir yil oldingi qazib olish bilan {rho1}. Korrelyatsiya yozuvni tasvirlaydi; u qazib olishni bir vaqtdagi boshqa o‘zgarishlardan ajratmaydi.`,
    ],
  },
  diagram: {
    title: `Bir yil qazib olish, zilzilalar keyinroq`,
    caption: `Groningen konining haqiqiy yillik jami ko‘rsatkichlari (NLOG.NL qazib olishi, tadqiqot hududidagi KNMI katalogi). Har bir nuqta bir yillik qazib olish va o‘sha yoki keyingi yil zilzilalari; kechikishni tanlang. Rang korrelyatsiyasi ko‘rsatilgan yillar uchun qayta hisoblanadi. Ijro yillarni birma-bir qo‘shadi.`,
    alt: `Groningen 2003–2024: yillik gaz qazib olish va yillik ML 1.5 va undan katta zilzilalar sonining nuqtali grafigi. Ko‘proq qazib olish ko‘proq zilzilalar bilan birga keladi, ayniqsa bir yillik kechikish bilan.`,
    xLabel: `Qazib olish, yiliga 10⁹ m³`,
    yLabel: `ML ≥ 1.5 zilzilalar`,
    readout: `Kechikish {lag} yil: {n} yil bo‘yicha rang korrelyatsiyasi ρ = {rho}.`,
    lagLabel: `Sanalgan zilzilalar`,
    lagOpt: `+{k} yil`,
    colYear: `Yil`,
    colEvents: `Zilzilalar, o‘sha yil`,
  },
  tech: [
    `Ma’lumotlar: KNMI katalogi (FDSN hodisa xizmati, mahalliy magnituda ML, hodisa turi "induced or triggered event"), Groningen konining NLOG oylik qazib olishi (10⁹ m³, 2003 yildan), tadqiqot hududi NLOG kon chegarasi 2 km bufer bilan, bu Dost va boshq. (2017) sonlarini 2 % ichida takrorlaydi.`,
    `Chastotalar butun davr uchun ML ≥ 1.5 dan foydalanadi, bu dastlabki tarmoqning ehtiyotkor to‘liqlik chegarasi (Dost va boshq. 2017; Kraaijpoel va boshq. 2022). Bosqich chastotalari aniq Puasson 95 % oraliqlariga ega. b-qiymatlar uchta baholovchidan: bootstrap bilan atlas MAXC + 0.2, belgilangan ML 1.5 da Aki-Utsu va b-positive (van der Elst 2021).`,
    `Korrelyatsiya 22 ta yillik qiymat (2003–2024) bo‘yicha Spirmen rang korrelyatsiyasi. Yillik qiymatlar avtokorrelyatsiyalangan, shuning uchun p-qiymatlar faqat taxminiy. Fizik bog‘lanish (bosim pasayishi, siqilish va yoriqlardagi kuchlanish) Bourne va boshq. (2014) va keyingi ishlarda modellashtirilgan; atlas uni modellashtirmaydi.`,
    `E’lon qilingan qiymatlar bilan tekshiruv (Dost va boshq. 2017; Kraaijpoel va boshq. 2022; Gulia & Wiemer 2026): klassik butun kon raqamlari takrorlanadi; bitta xarita taqqoslashi farq qiladi, chunki faqat KNMI katalogi konning eng zich qisminigina xaritaga tushiradi. Jadval Tadqiqot misollari sahifasida.`,
  ],
};
