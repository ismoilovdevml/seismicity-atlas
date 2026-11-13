export default {
  sentence: `Har bir katak hodisalar soni va 95 % oraligʻi kengligiga qarab A, B, C yoki “yetarli emas” sifat kodini oladi, b qiymati esa faqat A va B uchun koʻrsatiladi.`,
  simple: [
    `Atlasda bitta qatʼiy qoida bor: <strong>oraligʻi va sifat kodisiz b qiymati yoʻq</strong>.`,
    `Agar toʻliqlik boʻsagʻasidan yuqori zilzilalar juda kam boʻlsa, katak <strong>yetarli emas</strong> deb belgilanadi. Agar ular yetarli, lekin oraliq hali ham juda keng boʻlsa, katak <strong>C</strong> boʻladi va b yashiriladi: keng diapazondagi istalgan qiymat boʻlishi mumkin boʻlgan son chalgʻitadi. Tor oraliqlar <strong>A</strong>, oʻrtacha tor oraliqlar <strong>B</strong> beradi.`,
    `Shunday qilib, xaritadagi kulrang va shtrixlangan joylar bajarilmagan ish emas. Ular oʻrtacha va yirik zilzilalarning global katalogi uchun halol javob.`,
  ],
  analogy: `Oʻtgan yili faqat ikki kun maʼlumot bergan meteostansiya ishonchli yillik oʻrtachani bera olmaydi. Atlas taxminni chop etgandan koʻra, joyni boʻsh qoldirib, sababini aytishni afzal koʻradi.`,
  example: {
    title: `Toʻrt katak, toʻrt kod`,
    body: [
      `Hodisali {nAll} ta sayoz katakdan: {nA} tasi A, {nB} tasi B, {nC} tasi C va {nI} tasi yetarli emas.`,
      `A: {aLoc} yaqinidagi katakda boʻsagʻadan yuqori {aNb} ta hodisa bor, oraliq kengligi {aCiw} (b = {aB}). B: {bLoc} yaqinidagi katak, {bNb} ta hodisa, kenglik {bCiw} (b = {bB}). C: {cLoc} yaqinidagi katakda {cNb} ta hodisa bor, lekin oraliq kengligi {cCiw}, shuning uchun b koʻrsatilmaydi. Yetarli emas: {iLoc} yaqinidagi katakda boʻsagʻadan yuqori atigi {iNb} ta hodisa bor.`,
      `Chegaralar maʼlumotlar relizidan olinadi: A uchun kenglik {wA} gacha, B uchun {wB} gacha va kamida {nMin} ta hodisa.`,
    ],
  },
  diagram: {
    title: `Tanlanma hajmi, oraliq kengligi va kod`,
    caption: `Slayder darsliklardagi kenglik ≈ 2 × 1.96 × b/√n taqribiy formulasidan foydalanadi; haqiqiy kataklar (nuqtalar) bootstrap kengligiga qarab joylashtirilgan. Hodisalar minimal sondan kam boʻlsa, kenglikdan qatʼi nazar “yetarli emas” beriladi.`,
    alt: `Yashil A, koʻk B va qizil C zonalari boʻlgan oraliq kengligining gorizontal oʻqi; hodisalar soni oʻzgarganda belgi siljiydi; toʻrtta haqiqiy katak nuqtalar sifatida koʻrsatilgan.`,
    xLabel: `95 % oraliq kengligi`,
    zone: `{q}`, cellLabel: `haqiqiy {q} katak, {nb} ta hodisa`, insufficient: `yetarli emas`,
    slider: `Boʻsagʻadan yuqori hodisalar`,
    readout: `{n} ta hodisa: b = {b} atrofida taxminan [{lo}, {hi}] oraliq, kenglik {w}, kod {q}.`,
  },
  tech: [
    `Qoida (manifest.json, method.quality): har bir hodisa boʻsagʻasidan yuqori kamida {nMin} ta hodisa, aks holda <code>insufficient</code>; keyin bootstrap 95 % oraligʻi kengligi koʻpi bilan {wA} boʻlsa A, koʻpi bilan {wB} boʻlsa B, aks holda C (b yashiriladi, faqat kenglik eʼlon qilinadi).`,
    `Nega faqat n emas, kenglik ham: Mc yomon aniqlanganda yoki tanlanma davrlarni aralashtirganda bir xil n turli kenglik berishi mumkin; bootstrap kengligi Mc noaniqligini ham oʻz ichiga oladi. Boʻsagʻa + 0.2 va + 0.4 dagi b ning ikkalasi ham oraliqdan bir tomonga chiqsa, kesim barqarorligi belgisi (<code>unstable</code>) qoʻshiladi.`,
    `Xarita qoidalari: A toʻliq rangda, B xuddi shu rangda, lekin xiraroq, C shtrixlangan, “yetarli emas” och kulrang fonda. Shartli belgilar sifat filtridan nechta katak oʻtishini sanaydi.`,
    `Cheklov: filtr toʻgʻrilikni (accuracy) emas, aniqlikni (precision) nazorat qiladi. Katak A boʻlishi va baribir siljigan boʻlishi mumkin (masalan, notoʻgʻri boʻsagʻa tufayli), qoʻshni A kataklarning hodisalari esa qisman umumiy (Wiemer & Wyss 2002; Marzocchi et al. 2020).`,
  ],
};
