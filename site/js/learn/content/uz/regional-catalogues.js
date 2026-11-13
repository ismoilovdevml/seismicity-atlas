export default {
  sentence: `Mintaqaviy kataloglar global kataloglarga qaraganda ancha kichik zilzilalarni qayd etadigan zich milliy tarmoqlardan olinadi, har biri oʻzining mahalliy magnituda shkalasida, shuning uchun atlas ularni alohida qatlamlar sifatida chizadi va hech qachon global kataklar bilan birlashtirmaydi.`,
  simple: [
    `Stansiyalari har bir necha oʻn kilometrda joylashgan milliy tarmoq sezilmaydigan darajada kichik zilzilalarni ham ushlaydi. Bu global katalogda oʻnlab hodisa boʻlgan joyda minglab hodisalarni va ancha mayda masshtabdagi b qiymatlarini beradi.`,
    `Lekin har bir tarmoq oʻlchamni oʻz usulida, odatda oʻz mintaqasi uchun kalibrlangan mahalliy magnituda ML yoki davomiylik magnitudasi Md bilan oʻlchaydi. Italiyadagi ML 3 va Yangi Zelandiyadagi ML 3 aynan bir xil narsa emas va ularning hech biri global Mw bilan bevosita taqqoslanmaydi.`,
    `Shuning uchun mintaqaviy qatlamlar global xarita ustida xuddi shu ranglar va sifat qoidalari bilan, lekin oʻz shkalasida, maydaroq kataklar va kichikroq doiralar bilan joylashadi. Ularning litsenziyalari ham farq qiladi va shartli belgilar har birini nomlaydi.`,
  ],
  analogy: `Shaharning oʻz yomgʻir oʻlchagichlari yogʻingarchilikni koʻchama-koʻcha beradi; sunʼiy yoʻldosh esa butun mamlakat uchun beradi. Ikkalasi ham foydali, lekin oʻlchagich koʻrsatkichini sunʼiy yoʻldosh pikseli bilan oʻrtachalamaysiz.`,
  example: {
    title: `{name}`,
    body: [
      `Atlasda {nReg} ta mintaqaviy katalog bor: {names}. {name} qatlami {catalogue} ({licence}), {period}, {nEv} ta hodisa, magnituda turi {magtype} dan foydalanadi. U odatda {mc} dan toʻliq, H3 aniqlik darajasi {res} boʻlgan kataklarda {radius} doira bilan.`,
      `{floorPer} uchun global sayoz quyi chegara {floor}. Mintaqaviy Mc dagi zilzilalar nurlangan energiya boʻyicha global quyi chegaradagilardan taxminan {ratio} baravar kichik.`,
    ],
  },
  diagram: {
    title: `Mintaqaviy kataloglar toʻliqligi va global quyi chegara`,
    caption: `Haqiqiy maʼlumotlar (regional/index.json, manifest.json). Magnitudadagi har bir 1 lik qadam energiyada taxminan 32 baravar va b ≈ 1 boʻlganda hodisalar sonida taxminan 10 baravar farqqa teng. Mintaqaviy magnitudalar mahalliy shkalalar, shuning uchun joylashuvlar taxminiy.`,
    alt: `Har bir mintaqaviy katalog uchun taxminan 1 va 3 orasida bittadan nuqta boʻlgan magnituda oʻqi va 5 dan yuqorida global quyi chegara uchun shtrixli chiziq.`,
    xLabel: `Odatiy toʻliqlik magnitudasi`, globalLabel: `global quyi chegara {m}`, pick: `Mintaqa`,
    readout: `{name}: {catalogue}, {magtype}, {licence}, {period}. Odatiy Mc {mc}, H3 aniqlik darajasi {res}, doira {radius}. Bu global quyi chegaradan {dm} birlik past: har bir hodisada taxminan {energy} baravar kam energiya va vaqt birligida taxminan {count} baravar koʻp hodisa.`,
  },
  tech: [
    `Har bir mintaqa uchun bitta magnituda turi: har bir mintaqaviy qatlam tarmoqning FDSN hodisalar xizmati beradigan bitta magnituda turidan foydalanadi; boshqa turdagi hodisalar chiqarib tashlanadi va bu mintaqa ogohlantirishida koʻrsatiladi (docs/regional.md).`,
    `Kataklar va boʻsagʻalar: maydaroq H3 aniqlik darajasi va kichikroq tanlanma doirasi, har bir davr uchun vaqtga bogʻliq Mc, global qatlamdagi kabi har bir hodisa uchun alohida boʻsagʻali xuddi shu Aki-Utsu baholovchisi, bootstrap oraliqlari va A/B/C/yetarli emas qoidalari.`,
    `Hech qachon birlashtirilmaydi: mintaqaviy b qiymatlarini global Mw b qiymatlari bilan birma-bir taqqoslab boʻlmaydi (mahalliy shkalalar, turli magnituda diapazonlari), shuning uchun ular oʻrtachalanmaydi, balki global kataklar ustidan chiziladi va belgilanadi.`,
    `Litsenziyalar va mualliflik: har bir tarmoq oʻz shartlari asosida eʼlon qiladi (yuqoridagi diagramma maʼlumotlardan har birini koʻrsatadi). Har bir mintaqaning shartli belgilar bloki katalog, litsenziya, davr va odatiy Mc ni nomlaydi, Haqida sahifasi esa toʻliq mualliflik maʼlumotini beradi.`,
  ],
};
