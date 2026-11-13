export default {
  sentence: `b-positive b qiymatini ketma-ket zilzilalar magnitudalari orasidagi musbat sakrashlardan baholaydi; bu uni kichik hodisalar vaqtincha oʻtkazib yuborilganda, masalan, yirik zilziladan keyin darhol, barqaror qiladi.`,
  simple: [
    `Yirik zilziladan keyin seysmogrammalar toʻlib ketadi va koʻplab kichik aftershoklar hech qachon katalogga kiritilmaydi. Shunda oddiy b qiymati juda kam kichik hodisani koʻradi va juda past chiqadi.`,
    `b-positive bir usuldan foydalanadi (van der Elst 2021): zilzilalarni vaqt tartibida koʻrib chiqing va har biri oldingisidan qanchalik katta ekaniga qarang. Faqat aniq oʻsishlarni qoldiring. Bu oʻsishlarning kattaliklari magnitudalarning oʻzi bilan bir xil qonunga, bir xil b bilan boʻysunadi va oʻsha paytda tarmoq kichik hodisalarni oʻtkazib yuborganmi-yoʻqmi, bunga deyarli bogʻliq emas.`,
    `Atlas b-positive dan asosiy b ning oʻrnini bosuvchi sifatida emas, uning yonidagi barqarorlik tekshiruvi sifatida foydalanadi.`,
  ],
  analogy: `Agar shovqinli xonada suhbatni faqat vaqti-vaqti bilan eshitsangiz, sekin aytilgan soʻzlarni sanay olmaysiz. Lekin bir soʻz undan oldin eshitgan soʻzingizdan qanchalik balandroq ekanini baribir payqay olasiz, bu esa soʻzlovchi ovozining diapazoni haqida maʼlumot beradi.`,
  example: {
    title: `{loc} yaqinidagi subduksiya katagi`,
    body: [
      `Asosiy b = {b} [{lo}, {hi}]; b-positive = {bpos} [{bposLo}, {bposHi}].`,
      `Ikkala qiymati ham bor {nShown} ta koʻrsatilgan sayoz katakning {share} % ida b-positive b ning 95 % oraligʻi ichida yotadi, b-positive minus b ning medianasi esa {med}.`,
    ],
  },
  diagram: {
    title: `Oʻtkazib yuborilgan kichik hodisalar: klassik b va b-positive`,
    caption: `Haqiqiy b = 1 boʻlgan sintetik katalog: barqaror fon va aftershoklar ketma-ketligi. Yirik hodisadan keyin qayd etish boʻsagʻasi yuqoridan boshlanadi va vaqt oʻqining tanlangan qismi davomida qaytib pasayadi; kulrang nuqtalar oʻtkazib yuborilgan.`,
    alt: `Magnitudaning vaqtga nisbatan nuqtali grafigi; toʻliqsizlik slayderi oshgan sari yirik hodisadan keyingi koʻplab kichik nuqtalar kulrangga aylanadi.`,
    lgSeen: `Qayd etilgan`, lgMissed: `Oʻtkazib yuborilgan`, xLabel: `Vaqt`, yLabel: `Magnituda`, big: `yirik hodisa`,
    slider: `Yirik hodisadan keyingi toʻliqsiz davr`,
    readout: `{n} ta hodisadan {miss} tasi oʻtkazib yuborilgan. Klassik b = {b}, b-positive = {bp} (haqiqiy qiymat 1.00).`,
  },
  tech: [
    `Bitta eksponensial taqsimotdan olingan magnitudalar farqlari Laplas taqsimotiga boʻysunadi; uning musbat tomoni xuddi shu β bilan eksponensial. Vaqt tartibidagi ketma-ket magnitudalar va minimal farq δ bilan:<code class="lr-formula">b⁺ = log₁₀ e / ( mean(Δmᵢ | Δmᵢ ≥ δ) − (δ − ΔM/2) ),   Δmᵢ = mᵢ − mᵢ₋₁</code>Atlas δ = 0.2 va ΔM = 0.1 dan foydalanadi (scripts/seislib.py, b_positive).`,
    `Kirish: davr quyi chegarasidan yuqori hodisalar, vaqt tartibida. Oraliq: farqlar dispersiyasidan ±1.96 σ; b-positive faqat sifati A yoki B boʻlgan kataklar uchun eʼlon qilinadi.`,
    `Nega u barqaror: qayd etishdagi qisqa uzilish kichik hodisalarni olib tashlaydi, lekin musbat sakrash asosan kichikroq oldingi hodisadan baribir qayd etilgan yirikroq hodisagacha oʻlchanadi, shuning uchun sakrashlar taqsimotiga taʼsir kam (van der Elst 2021).`,
    `Ochiq masala (docs/method.md §2.1): bevosita Mw tanlanmasi bilan baʼzi kataklarda b biroz pasaydi, b-positive esa deyarli oʻzgarmadi; buning bir qismi boʻsagʻadan biroz yuqoridagi GCMT oʻtkazib yuborgan hodisalar boʻlishi mumkin. Saytda: katak panelining barqarorlik blokidagi b⁺ va uning oraligʻi.`,
  ],
};
