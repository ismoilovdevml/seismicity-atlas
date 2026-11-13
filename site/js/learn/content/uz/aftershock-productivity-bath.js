export default {
  sentence: `Båth qonuniga koʻra eng yirik aftershok odatda asosiy zarbadan taxminan 1.2 magnituda birligi kichik boʻladi, Reasenberg-Jones modeli esa Omori-Utsu soʻnishini Gutenberg-Richter qonuni bilan birlashtirib, har bir oʻlchamdagi qancha aftershok kutish mumkinligini beradi.`,
  simple: [
    `Yirik zilzilalarning aftershoklari ham yirik boʻladi, lekin odatda ancha kichikroq. Markus Båth bu farq hayratlanarli darajada barqaror ekanini payqagan: oʻrtacha taxminan 1.2, bir ketma-ketlikdan boshqasiga keng tarqoqlik bilan.`,
    `Ketma-ketlik qancha aftershok hosil qilishi uning <strong>mahsuldorligi</strong> deyiladi. Aftershoklar qanchalik tez soʻnishini (Omori-Utsu) va ularning oʻlchamlari qanday taqsimlanishini (Gutenberg-Richter) birlashtiring, shunda moslashtirilgan ketma-ketlik uchun model vaqt oynasida berilgan oʻlchamdan yuqori qancha hodisani nazarda tutishini aytish mumkin. Bu agentliklar aftershoklar boʻyicha tavsiyalar uchun foydalanadigan Reasenberg-Jones modelidir.`,
    `Ushbu atlasda bu raqamlar faqat oʻtgan ketma-ketliklarni tavsiflaydi. Ular prognoz emas.`,
  ],
  analogy: `Katta mushakbozlikning chirsillagan dumi bor: koʻplab mayda uchqunlar, bir nechta kattaroqlari, eng katta uchqun esa odatda asosiy portlashdan ancha kichik.`,
  example: {
    title: `Atlas ketma-ketliklarining eng yirik aftershoklari`,
    body: [
      `{nSeq} ta ketma-ketlikdan {nWith} tasi uchun M ≥ 6 hodisalar qatlamida ketma-ketlik oynasi ichida keyinroq sodir boʻlgan hodisa bor. Asosiy zarba va shunday eng yirik aftershok orasidagi median farq {med}.`,
      `{place} (M {mag}): oynadagi eng yirik keyingi hodisa M {aMag}, farq {dM}. Uning moslashtirishi K = kuniga {K}, p = {p}, Mcat {mcat} dan yuqorida ketma-ketlik b-positive qiymati {bSeq} beradi.`,
    ],
  },
  diagram: {
    title: `Asosiy zarba va eng yirik aftershok orasidagi farq`,
    caption: `Haqiqiy maʼlumotlar: har bir nuqta bitta ketma-ketlik (asosiy zarba sequences.json dan, eng yirik keyingi hodisa xuddi shu radius va bir yil ichida M ≥ 6 hodisalar qatlamidan; magnituda turlari manbadagi holicha). Shtrixli chiziq Båth ning 1.2 qiymati. Pastdagi koʻrsatkich Reasenberg-Jones shaklini moslashtirilgan ketma-ketlikka qoʻllaydi: bu oʻtgan ketma-ketlikning tavsifi, prognoz emas.`,
    alt: `Atlas ketma-ketliklari uchun magnituda farqining asosiy zarba magnitudasiga nisbatan nuqtali grafigi, 1.2 dagi shtrixli chiziq atrofida.`,
    xLabel: `Asosiy zarba magnitudasi`, yLabel: `Asosiy zarba minus eng yirik aftershok`,
    bathLine: `Båth qonuni, 1.2`,
    seqSlider: `Ketma-ketlik`, mSlider: `Sanash uchun magnituda ({place})`, daysLabel: `Oyna`, days: `{d} kun`,
    pick: `{place}: M {m}, eng yirik aftershok M {a}, farq {d}.`,
    rj: `{place} uchun moslashtirilgan model 1-kundan 1 + {days}-kungacha M ≥ {m} boʻlgan taxminan {n} ta hodisani nazarda tutadi (model toʻgʻri boʻlsa, kamida bittasi sodir boʻlish ehtimoli {prob} %).`,
    colPlace: `Ketma-ketlik`, colMain: `Asosiy zarba`, colAfter: `Eng yirik aftershok (M ≥ 6 qatlami)`, colGap: `Farq`,
  },
  tech: [
    `Båth qonuni: <code class="lr-formula">ΔM = Masosiy zarba − Meng yirik aftershok ≈ 1.2</code>bir necha oʻndan bir tarqoqlik bilan oʻrtacha qiymat sifatida. Atlasdagi farq hodisalar qatlamidagi magnitudalardan foydalanadi (ISC-GEM Mw yoki manbadagi holicha ComCat, kerak boʻlganda konversiya qilingan), shuning uchun u faqat taxminiy.`,
    `Vaqt t (kun) da magnitudasi ≥ M boʻlgan aftershoklarning Reasenberg-Jones chastotasi:<code class="lr-formula">λ(t, M) = K · 10^(−b (M − Mcat)) · (t + c)^−p</code>bu yerda K, c, p Mcat dan yuqoridagi Omori-Utsu moslashtirishidan, b esa ketma-ketlikning b-positive qiymati. Oynadagi kutilgan son t boʻyicha integral, kamida bitta hodisa ehtimoli esa Puasson jarayoni uchun 1 − e^(−N) (Reasenberg & Jones 1989).`,
    `Mahsuldorlik asosiy zarba oʻlchami bilan oʻsadi; Page et al. (2016) operativ aftershok prognozlari uchun global, mintaqaga bogʻliq parametrlarni beradi. Atlasdagi moslashtirishlar retrospektiv va teleseysmik (M ≥ 4.5 toʻliqlik), shuning uchun ular kichik aftershoklar yoki davom etayotgan ketma-ketliklar haqida hech narsa aytmaydi.`,
    `Kelgusidagi Ketma-ketliklar monitori bu kattaliklardan soʻnggi ketma-ketliklar uchun qayta foydalanadi; u yerda ham xuddi shu ogohlantirish amal qiladi.`,
  ],
};
