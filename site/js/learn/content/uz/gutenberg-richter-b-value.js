export default {
  sentence: `b qiymati Gutenberg-Richter qonunining qiyaligi: u har bir magnituda birligi qadamida zilzilalar necha baravar kamayishini koʻrsatadi va Yerda u 1 ga yaqin.`,
  simple: [
    `Kichik zilzilalar koʻp, yiriklari kam, va bu nisbat hayratlanarli darajada muntazam. b = 1 boʻlganda har bir magnituda birligi yuqoriga qadamda hodisalar taxminan oʻn baravar kam: har bir M6 ga oʻnta M5, har bir M7 ga oʻnta M6.`,
    `<strong>Yuqoriroq b</strong> (masalan, 1.3) nisbatan koʻproq kichik va kamroq yirik hodisalarni bildiradi. <strong>Pastroq b</strong> (masalan, 0.8) nisbatan koʻproq yirik hodisalarni bildiradi.`,
    `Laboratoriya va dala tadqiqotlari b ni togʻ jinsidagi kuchlanish bilan bogʻlaydi: kuchlanish yuqoriroq joylarda, masalan, surilma yoriqlanishda b pastroq; tizmalarda va tashlama yoriqlanishda b yuqoriroq. Global M ≥ 5 katalogda bunday farqlar nozik va ularni oraliqlari orqali talqin qilish kerak.`,
  ],
  analogy: `Pastga tushadigan zinapoyani tasavvur qiling: har bir pogʻona bir magnituda birligi, pastga tushgan har bir pogʻonada esa taxminan oʻn baravar koʻp zilzila bor. b qiymati zinapoyaning qanchalik tikligi.`,
  example: {
    title: `{loc} yaqinidagi subduksiya katagida b`,
    body: [
      `Sayoz hodisalar, ISC-GEM bevosita Mw, har bir hodisa boʻsagʻasidan yuqori: {nb} ta hodisadan b = {b} [{lo}, {hi}], sifat {q}. Bir magnituda birligi yuqorida hodisalar taxminan {ratio} baravar kam.`,
      `Taqqoslash uchun, butun dunyo (1976–2021, bevosita Mw) sayoz hodisalar uchun b = {gB} [{gLo}, {gHi}], chuqurroq hodisalar uchun esa {dB} [{dLo}, {dHi}] beradi.`,
    ],
  },
  diagram: {
    title: `Gutenberg-Richter chizigʻini buring`,
    caption: `Misoldagi katakning haqiqiy kumulyativ sonlari (toʻldirilgan nuqtalar: Mc va undan yuqori). Chiziq Mc dagi son atrofida buriladi; uning qiyaligi −b. “Eng yaxshi moslik” bitta boʻsagʻali maksimal haqiqatga oʻxshashlik bahosidan foydalanadi.`,
    alt: `Log shkaladagi kumulyativ FMD va Mc dagi nuqta orqali oʻtadigan, tikligi b slayderiga bogʻliq toʻgʻri chiziq.`,
    lgData: `Magnitudasi ≥ M boʻlgan hodisalar (haqiqiy)`, lgLine: `Gutenberg-Richter chizigʻi`,
    yLabel: `Magnitudasi ≥ M boʻlgan hodisalar`, pivot: `Mc dagi aylanish nuqtasi`,
    slider: `b`, fitBtn: `Eng yaxshi moslik, b = {b}`,
    readout: `b = {b}: har bir magnituda birligi yuqorida hodisalar taxminan {ratio} baravar kam. Eng yaxshi bitta boʻsagʻali moslik {fit}; bu katak uchun atlas qiymati {atlas}.`,
  },
  tech: [
    `Gutenberg-Richter qonuni: <code class="lr-formula">log₁₀ N(≥ M) = a − b · M</code>Teng kuchli taʼrif: boʻsagʻadan yuqori magnitudalar β = b · ln 10 bilan eksponensial taqsimlangan.`,
    `Baholovchi (boʻlaklash tuzatmasi bilan Aki-Utsu maksimal haqiqatga oʻxshashlik usuli): <code class="lr-formula">b̂ = log₁₀ e / ( M̄ − (Mc − ΔM/2) ),   ΔM = 0.1</code>bu yerda M̄ Mc va undan yuqori hodisalarning oʻrtacha magnitudasi. Atlas xuddi shu baholovchining har bir hodisa uchun alohida boʻsagʻali shaklidan foydalanadi (“Toʻliqlik magnitudasi” ga qarang).`,
    `Moment magnitudasi va daraja qonuni: Mw (2/3) log₁₀ M₀ bilan oʻsgani uchun b = 1.5 β_M, bu yerda β_M seysmik moment taqsimotining koʻrsatkichi. Kagan hamda Bird & Kagan plita chegaralarining aksariyat sinflari uchun β_M ≈ 0.63–0.67 (b ≈ 0.95–1.0), okean oʻrta tizmalarida esa yuqoriroq qiymatlarni topgan.`,
    `Ushbu atlasda: b faqat 95 % oraligʻi va sifat kodi bilan koʻrsatiladi; oraliq juda keng yoki tanlanma juda kichik boʻlsa, u koʻrsatilmaydi. Qoʻshni kataklarning hodisalari qisman umumiy, kichik tanlanmalar esa b ni siljitadi (Marzocchi et al. 2020), shuning uchun ikki joy faqat oraliqlari orqali taqqoslanadi. Saytda: b qatlami, katak panelidagi yirik b qiymati va taqqoslash koʻrinishi.`,
  ],
};
