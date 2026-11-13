export default {
  sentence: `Chastota-magnituda taqsimoti (FMD) katalogda har bir oʻlchamdagi zilzilalar qanchaligini sanaydi; u Mc ham, b qiymati ham aniqlanadigan grafikdir.`,
  simple: [
    `Biror joydagi zilzilalarni 0.1 magnituda birligi kenglikdagi oʻlcham sinflariga ajrating va har bir sinfni sanang. Oʻsha jadval FMD boʻladi.`,
    `Uni ikki xil chizish mumkin. <strong>Kumulyativ boʻlmagan</strong>: har bir sinfdagi son. <strong>Kumulyativ</strong>: kamida shu oʻlchamdagi hodisalar soni, N(≥ M). Kumulyativ egri chiziq silliqroq, chunki har bir nuqta barcha yirikroq hodisalarni ham oʻz ichiga oladi.`,
    `Oddiy son oʻqida egri chiziq jardan qulagandek pasayadi va yirik hodisalar asos chizigʻida yoʻqolib ketadi. Har bir chiziq pastdagisidan oʻn baravar katta boʻlgan logarifmik son oʻqida esa Mc dan yuqori qism toʻgʻri chiziqqa aylanadi. Oʻsha toʻgʻri chiziq Gutenberg-Richter qonunidir.`,
  ],
  analogy: `Bu bankadagi tangalarni qiymati boʻyicha sanashga oʻxshaydi: kichik tangalar koʻp, yiriklari kamroq. Har qadamda oʻn baravar oshadigan shkalada “kamida shuncha” qiymatga ega tangalar sonini chizing, shunda muntazam qonuniyat toʻgʻri chiziq boʻlib namoyon boʻladi.`,
  example: {
    title: `{loc} yaqinidagi subduksiya katagining FMD si`,
    body: [
      `Bu katak tanlanmasida {total} ta sayoz ISC-GEM Mw hodisasi bor. Eng kichik sinf, {mFirst}, {nFirst} ta hodisaga ega, eng yirik hodisa esa {mMax} sinfida.`,
      `Mc = {mc} da shu oʻlchamdagi yoki undan yirik {nMc} ta hodisa bor. Bir magnituda birligi yuqorida, {m1} da, atigi {nM1} tasi qoladi: taxminan oʻn baravar kam, 1 ga yaqin b qiymati aynan shuni anglatadi.`,
    ],
  },
  diagram: {
    title: `Bitta FMD, toʻrt koʻrinish`,
    caption: `Misoldagi katakning haqiqiy maʼlumotlari. Boʻlakdagi sonlar va kumulyativ sonlar orasida, shuningdek chiziqli va logarifmik son oʻqi orasida almashtiring. Shtrixli chiziq atlas Mc si.`,
    alt: `Katakning chastota-magnituda taqsimoti grafigi; uni ustunlar va kumulyativ nuqtalar, chiziqli va logarifmik koʻrinishlar orasida almashtirish mumkin.`,
    yCum: `Magnitudasi ≥ M boʻlgan hodisalar`, yNon: `Har 0.1 lik boʻlakdagi hodisalar`,
    kindLabel: `Sonlar`, non: `Boʻlak boʻyicha`, cum: `Kumulyativ`,
    scaleLabel: `Oʻq`, lin: `Chiziqli`, log: `Log`,
    read_non_lin: `Chiziqli oʻqda boʻlak boʻyicha sonlar: Mc yaqinidagi choʻqqi ustunlik qiladi va eng yirik hodisalar koʻrinmaydi.`,
    read_non_log: `Log oʻqda boʻlak boʻyicha sonlar: Mc dan yuqorida ustunlar toʻgʻri chiziq boʻylab pasayadi; Mc dan pastda esa hodisalar oʻtkazib yuborilgani uchun kamayadi.`,
    read_cum_lin: `Chiziqli oʻqda kumulyativ sonlar: tik egri chiziq, yirik magnitudalar uchun uni oʻqish qiyin.`,
    read_cum_log: `Log oʻqda kumulyativ sonlar: klassik Gutenberg-Richter grafigi. Mc dan yuqorida nuqtalar qiyaligi −b boʻlgan toʻgʻri chiziqqa yaqin joylashadi.`,
  },
  tech: [
    `Magnitudalar ΔM = 0.1 kenglikdagi boʻlaklarga ajratilganda kumulyativ boʻlmagan FMD n(Mᵢ), yaʼni M qiymati [Mᵢ − ΔM/2, Mᵢ + ΔM/2) da yotgan hodisalar soni, kumulyativ FMD esa N(≥ Mᵢ) = Σ_{j ≥ i} n(Mⱼ). Mc dan yuqorida ikkalasi ham<code class="lr-formula">log₁₀ N(≥ M) = a − b · M</code>ga boʻysunadi, kumulyativ boʻlmagan sonlar esa xuddi shu qiyalikka, lekin kichikroq ozod hadga ega.`,
    `Moslashtirish: atlas hech qachon b ni chizilgan nuqtalar boʻyicha eng kichik kvadratlar usuli bilan moslashtirmaydi (nuqtalar mustaqil emas va yirik magnitudalardagi sonlar juda kichik); u maksimal haqiqatga oʻxshashlik baholovchisidan foydalanadi (“Gutenberg-Richter b qiymati” ga qarang).`,
    `Maʼlumotlar: katak tafsilot fayllarida ISC-GEM (b tanlanmasi, v0.2 dan beri bevosita Mw) va manbadagi holicha ComCat uchun har bir chuqurlik sinfi boʻyicha kumulyativ boʻlmagan FMD bor. Katak paneli kumulyativ FMD ni Mc chizigʻi bilan log oʻqda chizadi, CSV yuklab olish esa har bir boʻlak uchun sonlar va kumulyativ sonlarni beradi.`,
    `Ehtiyot boʻling: bir necha yuz hodisada yuqori dum shovqinli boʻladi va yakka yirik hodisalar uzun tekis pogʻonada turadi. Marzocchi et al. (2020) kichik tanlanmalardan olingan b siljigan boʻlishini va tanlanmadagi eng yirik magnituda bilan korrelyatsiyalanishini koʻrsatgan.`,
  ],
};
