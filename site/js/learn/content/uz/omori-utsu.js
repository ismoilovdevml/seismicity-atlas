export default {
  sentence: `Omori-Utsu qonuni asosiy zarbadan keyin aftershoklar chastotasi vaqt oʻtishi bilan, taxminan oʻtgan vaqtga teskari proporsional ravishda, qanday pasayishini uchta son bilan tavsiflaydi: K (mahsuldorlik), c (dastlabki kechikish) va p (soʻnish qanchalik tez).`,
  simple: [
    `Yirik zilziladan keyin darhol aftershoklar tez-tez keladi; bir kundan keyin ancha kamroq; bir oydan keyin kamdan-kam. Chastota avval tez, keyin sekin, oylar yoki yillar davomida pasayadi.`,
    `Fusakichi Omori 1890-yillarda chastota taxminan 1/t kabi pasayishini payqagan. Tokuji Utsu p koʻrsatkichini qoʻshgan: p 1 ga yaqin boʻlganda, oʻn baravar keyinroq kuniga taxminan oʻn baravar kam aftershok degani.`,
    `<strong>K</strong> umuman qancha aftershok boʻlishini, <strong>p</strong> ular qanchalik tez soʻnishini, <strong>c</strong> esa boshida chastota tekisroq boʻlgan qisqa vaqtni belgilaydi. Global katalogda birinchi soatlar koʻpincha yetishmaydi, shuning uchun c ni oʻlchab boʻlmasligi mumkin.`,
  ],
  analogy: `Bu katta qoʻngʻiroqning jaranglashiga oʻxshaydi: avval baland va jadal, keyin soʻnib boradi, avval tez, keyin tobora sekinroq, lekin hech qachon birdaniga toʻxtamaydi.`,
  example: {
    title: `{year} yilgi {place}, M {mag}`,
    body: [
      `Bir yil davomida {radius} ichidagi, {mcat} magnitudadan yuqorida toʻliq aftershoklar: moslashtirishda {nFit} ta hodisa. Natija: p = {p} (± {sp}), K = kuniga {K}; c = {c} kun (aniqlangan: {cRes}). Sifat {q}.`,
      `Ketma-ketliklar sahifasidagi {nSeq} ta ketma-ketlikdan {nA} tasi A sifatli, {nB} tasi B sifatli. Haqiqiy p = {pTrue} boʻlgan sintetik ketma-ketliklarda xuddi shu moslashtirish oʻrtacha p = {pMean} ni tiklaydi, ishga tushirishlar orasidagi tarqoqlik {pSd}.`,
    ],
  },
  diagram: {
    title: `Log-log oʻqlarda aftershoklar soʻnishi`,
    caption: `Nuqtalar: ketma-ketlikning haqiqiy aftershok chastotalari (Mcat dan yuqori kunlik hodisalar). Chiziq: slayderlardagi p va c hamda moslashtirilgan K bilan K(t + c)^−p. Dastlabki nuqtalar chiziqdan pastda, chunki boshida kichik aftershoklar oʻtkazib yuboriladi (moslashtirish buni modellashtiradi, chiziq esa yoʻq). Pastda: chiziqli vaqt oʻqida bir yil, aftershoklar joriy modeldan olingan.`,
    alt: `Asosiy zarbadan keyingi kunlarga nisbatan aftershok chastotasining log-log grafigi, deyarli toʻgʻri pasayuvchi chiziq bilan; pastda boshida zich, keyin siyrak boʻlgan belgilar tasmasi.`,
    lgData: `Kuzatilgan chastota (haqiqiy)`, lgModel: `Omori-Utsu modeli`,
    xLabel: `Asosiy zarbadan keyingi kunlar`, yLabel: `Kunlik aftershoklar`,
    stripStart: `0-kun`, stripEnd: `365-kun`, stripLabel: `Bir yil davomidagi simulyatsiya qilingan aftershoklar`,
    pSlider: `p`, cSlider: `c (kun)`, reset: `Moslashtirilgan qiymatlar`,
    binLabel: `Kunlar`, countLabel: `Aftershoklar`,
    readout: `p = {p}, c = {c} kun, K = {K}: 10-kundagi chastota 1-kundagidan taxminan {ratio} baravar past.`,
  },
  tech: [
    `Toʻliqlik magnitudasidan yuqori hodisalarning Omori-Utsu chastotasi:<code class="lr-formula">λ(t) = K / (t + c)^p</code>bu yerda t kunlarda. [t₁, t₂] dagi kutilgan son K ∫ (t + c)^−p dt.`,
    `Ushbu atlasda moslashtirish (scripts/sequences.py): asosiy zarbadan max(100 km, L) ichidagi ComCat hodisalari boʻyicha maksimal haqiqatga oʻxshashlik, L = 10^(−2.44 + 0.59 M) km (Wells & Coppersmith 1994), 0–365 kunlar uchun. Mcat 10–365 kunlarning MAXC + 0.2 qiymati, hech qachon 4.5 dan past emas. Moslashtirish vaqtga bogʻliq toʻliqlikni <code>Mc(t) = max(Mcat, Mm − 4.5 − 0.75 log₁₀ t)</code> modellashtirib, ketma-ketlikning boshlanishini saqlab qoladi (Helmstetter et al. 2006; Page et al. 2016); bu modelda ketma-ketlikning b-positive qiymati ishlatiladi.`,
    `Sifat: A uchun n ≥ 100, σp ≤ 0.10, 0.5 ≤ p ≤ 2 va asosiy zarbadan 0.5 birlik ichida ikkinchi hodisa yoʻqligi kerak; B uchun n ≥ 50 va σp ≤ 0.20 kerak. c 0.001 kundan kichik boʻlsa yoki standart xatosi boʻlmasa, <code>c_resolved</code> false boʻladi: teleseysmik katalogda birinchi soatlar yetishmaydi, shuning uchun c cheklanmagan, K va p esa foydalanishga yaroqli boʻlib qoladi.`,
    `Saytda: Ketma-ketliklar sahifasidagi soʻnish grafiklari va sifat belgilari. Chastota nuqtalari Mcat dan yuqori sonlarning logarifmik oraliqli boʻlaklaridan foydalanadi.`,
  ],
};
