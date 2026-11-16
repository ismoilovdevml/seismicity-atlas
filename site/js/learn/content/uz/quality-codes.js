export default {
  sentence: `Har bir katak hodisalar soni va 95 % oraligʻining b ga nisbatan kengligiga qarab A, B, C yoki “yetarli emas” sifat kodini oladi, b qiymati esa faqat A va B uchun koʻrsatiladi.`,
  simple: [
    `Atlasda bitta qatʼiy qoida bor: <strong>oraligʻi va sifat kodisiz b qiymati yoʻq</strong>.`,
    `Agar toʻliqlik boʻsagʻasidan yuqori zilzilalar juda kam boʻlsa, katak <strong>yetarli emas</strong> deb belgilanadi. Agar ular yetarli, lekin oraliq b ning oʻziga nisbatan hali ham juda keng boʻlsa, katak <strong>C</strong> boʻladi va b yashiriladi: keng diapazondagi istalgan qiymat boʻlishi mumkin boʻlgan son chalgʻitadi. Tor oraliqlar <strong>A</strong>, oʻrtacha tor oraliqlar <strong>B</strong> beradi.`,
    `Shunday qilib, xaritadagi kulrang va shtrixlangan joylar bajarilmagan ish emas. Ular oʻrtacha va yirik zilzilalarning global katalogi uchun halol javob.`,
  ],
  analogy: `Oʻtgan yili faqat ikki kun maʼlumot bergan meteostansiya ishonchli yillik oʻrtachani bera olmaydi. Atlas taxminni chop etgandan koʻra, joyni boʻsh qoldirib, sababini aytishni afzal koʻradi.`,
  example: {
    title: `Toʻrt katak, toʻrt kod`,
    body: [
      `Hodisali {nAll} ta sayoz katakdan: {nA} tasi A, {nB} tasi B, {nC} tasi C va {nI} tasi yetarli emas.`,
      `A: {aLoc} yaqinidagi katakda boʻsagʻadan yuqori {aNb} ta hodisa bor, oraliq kengligi {aCiw}, yaʼni {aCiwr} × b (b = {aB}). B: {bLoc} yaqinidagi katak, {bNb} ta hodisa, kenglik {bCiw}, yaʼni {bCiwr} × b (b = {bB}). C: {cLoc} yaqinidagi katakda {cNb} ta hodisa bor, lekin oraliq kengligi {cCiwr} × b, shuning uchun b koʻrsatilmaydi. Yetarli emas: {iLoc} yaqinidagi katakda boʻsagʻadan yuqori atigi {iNb} ta hodisa bor.`,
      `Chegaralar maʼlumotlar relizidan olinadi: A uchun kenglik {wA} × b gacha, B uchun {wB} × b gacha va kamida {nMin} ta hodisa.`,
    ],
  },
  diagram: {
    title: `Tanlanma hajmi, oraliqning nisbiy kengligi va kod`,
    caption: `Slayder darsliklardagi kenglik / b ≈ 2 × 1.96 / √n taqribiy formulasidan foydalanadi, u b ga bogʻliq emas; haqiqiy kataklar (nuqtalar) bootstrap kengligining oʻz b siga nisbatiga qarab joylashtirilgan. Hodisalar minimal sondan kam boʻlsa, kenglikdan qatʼi nazar “yetarli emas” beriladi.`,
    alt: `Yashil A, koʻk B va qizil C zonalari boʻlgan, b ga boʻlingan oraliq kengligining gorizontal oʻqi; hodisalar soni oʻzgarganda belgi siljiydi; toʻrtta haqiqiy katak nuqtalar sifatida koʻrsatilgan.`,
    xLabel: `95 % oraliq kengligi, b ga boʻlingan`,
    zone: `{q}`, cellLabel: `haqiqiy {q} katak, {nb} ta hodisa`, insufficient: `yetarli emas`,
    slider: `Boʻsagʻadan yuqori hodisalar`,
    readout: `{n} ta hodisa: b = {b} atrofida taxminan [{lo}, {hi}] oraliq, kenglik {w} = {wr} × b, kod {q}.`,
  },
  tech: [
    `Qoida (manifest.json, method.quality): har bir hodisa boʻsagʻasidan yuqori kamida {nMin} ta hodisa, aks holda <code>insufficient</code>; keyin bootstrap 95 % oraligʻi kengligi koʻpi bilan {wA} × b boʻlsa A (b – katakning nuqtaviy bahosi), koʻpi bilan {wB} × b boʻlsa B, aks holda C (b yashiriladi, faqat kenglik eʼlon qilinadi).`,
    `Nega b ga nisbatan (0.5.0 relizidan beri; undan oldin chegaralar mutlaq kenglik edi): oraliq b ning oʻzi bilan birga kengayadi, taxminan 3.92 × b/√n, shuning uchun mutlaq chegara past b li kataklarni qoldirib, hodisalari soni xuddi shunday boʻlgan yuqori b li kataklarni yashirar edi. Maʼlum boʻsagʻadan yuqori 70 ta hodisali sintetik kataklarda eski qoida b = 0.8 boʻlgan kataklarning 98 % ini va b = 1.5 boʻlganlarning 2 % ini koʻrsatgan, b = 1.5 kataklarning koʻrsatilgan b qiymati esa oʻrtacha 1.24 boʻlgan; nisbiy qoida har bir b da 73–77 % ni koʻrsatadi va koʻrsatilgan kataklarning oʻrtachasi haqiqiy b dan 0.02 dan kam farq qiladi (tests/test_atlaslib.py). Hodisalarning umumiy soni bir xil boʻlganda yuqori b li kataklar baribir kamroq oʻtadi, chunki ularning hodisalaridan kamrogʻi MAXC + 0.2 dan yuqorida yotadi.`,
    `Nega faqat n emas, kenglik ham: Mc yomon aniqlanganda yoki tanlanma davrlarni aralashtirganda bir xil n turli kenglik berishi mumkin; bootstrap kengligi Mc noaniqligini ham oʻz ichiga oladi. Boʻsagʻa + 0.2 va + 0.4 dagi b ning ikkalasi ham oraliqdan bir tomonga chiqsa, kesim barqarorligi belgisi (<code>unstable</code>) qoʻshiladi.`,
    `Xarita qoidalari: A toʻliq rangda, B xuddi shu rangda, lekin xiraroq, C shtrixlangan, “yetarli emas” och kulrang fonda. Shartli belgilar sifat filtridan nechta katak oʻtishini sanaydi.`,
    `Cheklov: filtr toʻgʻrilikni (accuracy) emas, aniqlikni (precision) nazorat qiladi. Katak A boʻlishi va baribir siljigan boʻlishi mumkin (masalan, notoʻgʻri boʻsagʻa tufayli), qoʻshni A kataklarning hodisalari esa qisman umumiy (Wiemer & Wyss 2002; Marzocchi et al. 2020).`,
  ],
};
