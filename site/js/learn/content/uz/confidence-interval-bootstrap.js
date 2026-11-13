export default {
  sentence: `Har bir b qiymati bilan koʻrsatiladigan 95 % oraliq oʻlchov 100 marta takrorlansa, shundan 95 tasida haqiqiy b ni qamrab oladigan diapazon; atlas uni bootstrap bilan baholaydi: katalogni koʻp marta qayta tanlab, b ni qayta hisoblaydi.`,
  simple: [
    `Bir necha yuz zilziladan olingan b qiymati noaniq: zilzilalarning biroz boshqacha toʻplami biroz boshqacha son bergan boʻlardi.`,
    `Biz Yerni qaytadan “ishga tushira” olmaymiz, lekin tanlanmani qayta takrorlay olamiz. <strong>Bootstrap</strong> haqiqiy katalogdan tasodifiy ravishda va qaytarish bilan (baʼzi hodisalar ikki marta, baʼzilari umuman olinmaydi) xuddi shu hajmdagi yangi katalog tuzadi va b ni qayta hisoblaydi. Bunday koʻplab tanlashlardan keyin b qiymatlarining oʻrtadagi 95 % i oraliq boʻladi.`,
    `Tor oraliq maʼlumotlar b ni yaxshi aniqlashini bildiradi. Keng oraliq esa aniqlamasligini bildiradi va bunda atlas b ni koʻrsatmaydi (“Sifat kodlari” ga qarang).`,
  ],
  analogy: `Soʻrovnoma natijasi qanchalik tebranishi mumkinligini bilish uchun xuddi shu hajmdagi yangi tasodifiy guruhdan koʻp marta soʻrash mumkin edi. Bootstrap buni allaqachon soʻralgan odamlar bilan qiladi, ularni yana tasodifiy tanlab.`,
  example: {
    title: `{loc} yaqinidagi subduksiya katagining oraligʻi`,
    body: [
      `Boʻsagʻadan yuqori {nb} ta hodisa va {nboot} ta bootstrap qayta tanlanmasidan b = {b}, 95 % oraligʻi [{lo}, {hi}], kengligi {ciw}. Sifat {q}.`,
      `{lo} va {hi} orasidagi istalgan b qiymati bu maʼlumotlarga mos keladi. Oraligʻi bu oraliq bilan kesishadigan boshqa katakda b farq qilishi koʻrsatilmagan.`,
    ],
  },
  diagram: {
    title: `Bootstrap qayta tanlanmalari oraliqni hosil qiladi`,
    caption: `Har bir qayta tanlanma katakning Mc dan yuqori hodisalarini qaytarish bilan qayta tanlaydi va b ni bitta belgilangan boʻsagʻa bilan qayta baholaydi. Atlas har bir qayta tanlanmada Mc ni ham qayta baholaydi, shuning uchun uning oraligʻi (grafik ustidagi kesma) odatda biroz kengroq.`,
    alt: `Bootstrap b qiymatlarining qayta tanlanma sayin oʻsib boradigan gistogrammasi; oxirida soyali polosa markaziy 95 % ni belgilaydi.`,
    xLabel: `Bootstrap qayta tanlanmasining b si`, yLabel: `Qayta tanlanmalar`,
    band: `markaziy 95 %`, atlasBar: `atlas oraligʻi`,
    start: `Qayta tanlanmalarni chizish uchun “Boshlash” tugmasini bosing.`,
    running: `{n} tadan {k}-qayta tanlanma: b = {b}. Hozircha markaziy 95 %: [{lo}, {hi}].`,
    done: `{n} ta qayta tanlanma: markaziy 95 % [{lo}, {hi}]. Har safar Mc qayta baholanadigan atlas oraligʻi [{alo}, {ahi}].`,
    again: `Yangi tanlash`, skip: `Natijani koʻrsatish`,
  },
  tech: [
    `Har bir katak va chuqurlik sinfi uchun tartib: tanlanma doirasidagi n ta hodisadan qaytarish bilan n ta hodisa tanlanadi; katak Mc si (MAXC + 0.2) va har bir hodisa boʻsagʻalari qayta baholanadi; b Aki-Utsu baholovchisi bilan hisoblanadi; bu {nboot} marta takrorlanadi. Oraliq qayta tanlanmalarning 2.5- dan 97.5-protsentiligacha boʻlgan qism, shuning uchun u Mc noaniqligini ham oʻz ichiga oladi (Woessner & Wiemer 2005).`,
    `Nega faqat formula emas: b ning klassik standart xatosi, σ ≈ b/√n (Aki) yoki Shi–Bolt shakli, maʼlum va belgilangan Mc ni nazarda tutadi. Bu yerda boʻsagʻaning oʻzi baholanadi va tanlanma oʻrtacha hajmda, shuning uchun protsentil bootstrap halolroq xulosa beradi. Katak tafsilotlaridagi kesim grafiklari tezlik uchun Shi–Bolt ±1.96 σ dan foydalanadi.`,
    `Cheklovlar: bootstrap sistematik xatolarni (notoʻgʻri magnituda shkalasi, Mc dan yuqori oʻtkazib yuborilgan hodisalar, ikki populyatsiyaning aralashishi) emas, faqat tanlanma shovqinini takrorlaydi. Kesishadigan oraliqlar tenglikni isbotlamaydi; kesishmaydigan oraliqlar rasmiy test emas, balki farqning konservativ belgisi (Marzocchi et al. 2020).`,
    `Saytda: katak panelidagi b shkalasida oraliq kesmasi, har bir b qiymatidan keyingi qavs, sifat kodini belgilaydigan oraliq kengligi va taqqoslash koʻrinishidagi ikki qatorli oraliq grafigi.`,
  ],
};
