export default {
  sentence: `Xarita H3 oltiburchaklarida chiziladi, lekin har bir katak statistikasi katak markazi atrofidagi belgilangan doira ichidagi barcha zilzilalardan foydalanadi, shuning uchun har bir joy bir xil maydon boʻyicha oʻlchanadi.`,
  simple: [
    `H3 Uber tomonidan yaratilgan va xaritalarda keng qoʻllaniladigan global oltiburchaklar toʻri. Oltiburchaklar sferani deyarli teng maydonlar bilan qoplaydi va har bir katak barqaror identifikatorga ega, bu havolalar va maʼlumotlarni birlashtirishni oddiy qiladi.`,
    `Global toʻrning oltiburchagi statistika uchun kichik: unda kamdan-kam hollarda yetarlicha yirik zilzila boʻladi. Shuning uchun atlas har bir katak markazi atrofida oltiburchakdan kattaroq <strong>doira</strong> oladi va Mc hamda b ni uning ichidagi barcha hodisalardan hisoblaydi.`,
    `Qoʻshni doiralar ustma-ust tushadi, shuning uchun qoʻshni kataklarning zilzilalari qisman umumiy. Shu sababli xaritadagi silliq koʻrinadigan manzara qisman Yerga emas, doiralarga bogʻliq.`,
  ],
  analogy: `Shahar toʻridagi koʻcha chorrahalarida havo sifatini oʻlchashni tasavvur qiling, lekin har bir sensor belgilangan piyoda masofasi ichidagi havoni oʻrtachalaydi. Yaqin chorrahalar qisman bir xil havodan “nafas olgani” uchun oʻxshash koʻrsatkichlar beradi.`,
  example: {
    title: `{loc} yaqinidagi katak`,
    body: [
      `Bu oltiburchak {area} km² ni qamraydi ({res}). Radiusi {radius} km boʻlgan tanlanma doirasi {circle} km² ni, yaʼni oltiburchakdan taxminan {ratio} baravar katta maydonni qamraydi. Global qatlamda kamida bitta hodisali {nCells} ta oltiburchak bor.`,
      `Mintaqaviy kataloglar ularning ancha kichik zilzilalariga moslangan, kichikroq doirali maydaroq toʻrlardan foydalanadi: H3 aniqlik darajasi va radius {regList}.`,
    ],
  },
  diagram: {
    title: `Katak va uning tanlanma doirasi, masshtabda`,
    caption: `Oltiburchak maydoni maʼlumotlardan olingan (misoldagi katak yoki mintaqaviy katalogning median katagi) va xuddi shu maydonli muntazam oltiburchak sifatida chizilgan. Shtrixli doiralar ikki qoʻshniga tegishli va ustma-ust tushishni koʻrsatadi.`,
    alt: `Oltita qoʻshni bilan oʻralgan oltiburchak, markaziy oltiburchak atrofida katta doira va unga ustma-ust tushadigan ikkita shtrixli qoʻshni doira.`,
    resLabel: `Toʻr`, globalOpt: `Global, {r}`, regionalOpt: `Mintaqaviy, aniqlik {res}, {r}`,
    slider: `Doira radiusi`,
    overlapYes: `Qoʻshni doiralar ustma-ust tushadi, shuning uchun qoʻshnilarning hodisalari qisman umumiy.`,
    overlapNo: `Qoʻshni doiralar ustma-ust tushmaydi.`,
    readout: `Aniqlik {res}: oltiburchak {area} km², doira radiusi {r} = {circle} km², oltiburchakdan {ratio} baravar katta. {overlap}`,
  },
  tech: [
    `Toʻr: global qatlam uchun H3 aniqlik darajasi {globalRes}. Har bir katak statistikasi: episentri katak markazidan {radius} km ichida (katta doira boʻyicha masofa) boʻlgan barcha hodisalar, ZMAP ning oʻzgarmas radius yondashuvidagi kabi (Wiemer & Wyss 2002). Chastotalar doiraning emas, katakning oʻz maydonidan foydalanadi.`,
    `Nega eng yaqin N ta hodisa emas, belgilangan radius: fazoviy qamrov hamma joyda bir xil, shuning uchun ikki joy bir xil maydon boʻyicha taqqoslanadi, siyrak joylar esa uzoqdan hodisa “qarzga olish” oʻrniga halol ravishda boʻsh qoladi (b koʻrsatilmaydi). Buning narxi shundaki, tanlanma hajmi va shu bilan birga noaniqlik ham oʻzgaradi; bu koʻrsatib beriladi.`,
    `H3 kataklari aniq teng maydonli emas (bitta aniqlik darajasida taxminan ikki baravar farq), shuning uchun chastotalar har bir katakning oʻz <code>area_km2</code> qiymatiga boʻlinadi.`,
    `Radiusga sezgirlik (docs/method.md §1): 300 km oʻrniga 200 yoki 400 km olinganda, b koʻrsatilgan joylarda u 0.04 dan kamroq (median) oʻzgaradi; radius asosan nechta katak kerakli tanlanma hajmiga yetishini belgilaydi.`,
  ],
};
