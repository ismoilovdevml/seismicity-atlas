export default {
  sentence: `Zilzila “magnitudasi” bitta son emas, balki har biri turli seysmik toʻlqinlar boʻyicha oʻlchanadigan oʻlchovlar oilasi; ulardan faqat moment magnitudasi Mw eng yirik zilzilalarda ham oʻsishda davom etadi.`,
  simple: [
    `Magnituda seysmometrlar qayd etgan tebranishdan aniqlanadi. Turli shkalalar turli toʻlqinlarni “tinglaydi”: <strong>mb</strong> qisqa, taxminan bir soniyali hajmiy toʻlqinlardan foydalanadi; <strong>Ms</strong> taxminan yigirma soniyali sekinroq sirt toʻlqinlaridan foydalanadi; <strong>ML</strong> (Richterning dastlabki gʻoyasi) va <strong>Md</strong> (yozuv qancha davom etishidan) yaqin atrofdagi, asosan kichik hodisalar uchun mahalliy tarmoqlar tomonidan hisoblanadi.`,
    `<strong>Mw</strong>, moment magnitudasi, boshqacha: u seysmik momentdan olinadi, yaʼni yoriq maydoni, u qancha masofaga siljigani va togʻ jinsi qattiqligining koʻpaytmasidan. Uning diapazoni tugab qolmaydi.`,
    `Qisqa toʻlqinli shkalalar yirik zilzilalarda oʻsishdan toʻxtaydi. Juda kuchli zilzila bilan shunchaki yirik zilzila deyarli bir xil mb olishi mumkin. Bu <em>toʻyinish</em> deb ataladi.`,
  ],
  analogy: `Plyajdagi toʻlqinni bir metrli chizgʻich bilan oʻlchash kichik toʻlqinlar uchun yaraydi. Sunami uchun ham siz baribir “bir metr” deb oʻqiysiz. mb qisqa chizgʻich; Mw esa butun suv hajmini oʻlchaydi.`,
  example: {
    title: `Xaritadagi nuqtalar ortida qaysi magnituda turibdi`,
    body: [
      `Xaritaning hodisalar qatlamida magnitudasi 6 va undan yuqori {n} ta zilzila bor. Ularning magnitudalari turli manbalardan olingan: {iscgem} tasi ISC-GEM Mw, {mwtype} tasi ComCat ning moment turidagi magnitudalari, {mbproxy} tasi Mw proksiga konversiya qilingan ComCat mb, {msproxy} tasi Mw proksiga konversiya qilingan Ms, {other} tasi esa boshqa magnituda turini oʻzgarishsiz saqlaydi.`,
      `{year} yilgi {place} ComCat da {mag} magnitudaga ega, turi “{magtype}”, yaʼni moment magnitudasi. Uning mb qiymati bundan ancha pastda toʻyingan boʻlardi.`,
      `b qiymati qatlamlari bu manbalardan faqat bittasidan, ISC-GEM Mw dan foydalanadi (“Bevosita va proksi Mw” ga qarang).`,
    ],
  },
  diagram: {
    title: `Qisqa davrli magnitudalarning toʻyinishi (sxematik)`,
    caption: `Sxematik egri chiziqlar: ular kalibrovkani emas, toʻyinish shaklini koʻrsatadi. Har bir shkala tekislanadigan daraja u oʻlchaydigan toʻlqinlar davriga bogʻliq.`,
    alt: `Chiziqli grafik: shtrixli diagonal Mw ning oʻzi; haqiqiy oʻlcham oʻsgan sari avval mb, keyin ML, keyin Ms tekislanadi.`,
    mw: `Mw (moment, toʻyinmaydi)`, mb: `mb (≈ 1 s hajmiy toʻlqinlar)`, ML: `ML (mahalliy)`, Ms: `Ms (≈ 20 s sirt toʻlqinlari)`,
    xLabel: `Haqiqiy oʻlcham, Mw`, yLabel: `Eʼlon qilingan magnituda`,
    slider: `Haqiqiy oʻlcham Mw`,
    readout: `Mw {mw} da sxematik shkalalar mb {mb}, ML {ML} va Ms {Ms} koʻrsatadi.`,
  },
  tech: [
    `Seysmik moment va moment magnitudasi (Hanks–Kanamori shakli, M₀ N·m da):<code class="lr-formula">M₀ = μ · A · D,   Mw = (2/3) · (log₁₀ M₀ − 9.1)</code>bu yerda μ siljish moduli, A uzilish maydoni, D esa oʻrtacha siljish. Mw momentning oʻzidan kelib chiqqani uchun u chegarasiz oʻsadi.`,
    `mb davri 1 s atrofidagi P toʻlqinlarda, Ms esa davri 20 s atrofidagi Rayleigh toʻlqinlarida oʻlchanadi. Uzilish bu toʻlqin uzunliklaridan ancha uzun boʻlgach, oʻsha davrdagi amplituda deyarli oʻsmay qoladi; mb taxminan 6 dan biroz yuqorida, Ms esa 8 atrofida tekislanadi (aniq darajalar agentlik va formulaga bogʻliq).`,
    `Ushbu atlasda: b faqat ISC-GEM Mw (1976–2021) boʻyicha hisoblanadi. ComCat ning afzal magnitudasi M 4.5–6 uchun asosan mb, undan yuqorida esa Mw, shuning uchun manbadagi holicha ComCat boʻyicha moslashtirilgan b qiymati tur qayerda almashishiga bogʻliq. Faqat ComCat dagi hodisalar umumiy shkalaga faqat hodisalar qatlami uchun, belgilangan konversiyalar bilan keltiriladi (Scordilis 2006 qiyaliklari): Mw = 0.92 + 0.85 mb va Ms uchun ikki chiziqli bogʻlanish. Hodisa ustidagi maslahat oynasi har bir nuqtaning magnituda turini koʻrsatadi.`,
    `Cheklovlar: shkalalar orasidagi konversiyalar taxminan 0.2 magnituda birligi tarqoqlikka ega va statistika uchun ishlatilganda b ni siljitadi (Castellaro et al. 2006). Mahalliy ML va Md shkalalari tarmoqdan tarmoqqa farq qiladi, shuning uchun mintaqaviy qatlamlar alohida saqlanadi.`,
  ],
};
