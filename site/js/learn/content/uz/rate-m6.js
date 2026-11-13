export default {
  sentence: `Mw ≥ 6 chastotasi katakdagi moment magnitudasi 6 yoki undan yuqori ISC-GEM zilzilalarining yillik soni boʻlib, katak maydoniga boʻlinadi va 100 000 km² ga keltiriladi, shunda turli oʻlchamdagi kataklarni taqqoslash mumkin.`,
  simple: [
    `Biror joyda yirik zilzilalar qanchalik tez-tez sodir boʻlgani eng oddiy seysmiklik koʻrsatkichi. Joylarni adolatli taqqoslash uchun u yil va maydon birligiga hisoblanadi.`,
    `Magnituda 6 ishlatiladi, chunki ISC-GEM katalogi hisoblangan butun davr uchun shu oʻlchamda toʻliq, shuning uchun son eski tarmoqlar bilan cheklanmaydi.`,
    `U oʻtmishni tavsiflaydi. Yuqori chastota joy faol boʻlganini bildiradi; keyingi yirik zilzila qachon boʻlishini aytmaydi.`,
  ],
  analogy: `Ob-havo atlasidagi 100 km² ga yiliga momaqaldiroqlar soniga oʻxshaydi: momaqaldiroqlar qayerda tez-tez boʻlishini adolatli aytish usuli, kelasi seshanba uchun prognoz emas.`,
  example: {
    title: `{loc} yaqinidagi subduksiya katagida chastota`,
    body: [
      `100 000 km² ga yiliga Mw ≥ 6 boʻlgan {rate} ta hodisa. Katak {area} km² ni qamraydi, demak katakda yiliga taxminan {perYear} ta shunday hodisa.`,
      `{nAll} ta katakdan {nPos} tasida kamida bitta Mw ≥ 6 hodisa boʻlgan; ularning median chastotasi {med}. Eng yuqori chastota, {topRate}, {topLoc} yaqinidagi katakda.`,
    ],
  },
  diagram: {
    title: `Mw ≥ 6 chastotasi kataklar boʻyicha qanday taqsimlangan`,
    caption: `Haqiqiy maʼlumotlar: kamida bitta hodisali har bir katak uchun bitta qiymat (cells.geojson). Oʻq logarifmik: har bir belgilangan qadam oldingisidan oʻn baravar katta. Chastotasi berilgan qiymatga teng yoki undan yuqori kataklarni sanash uchun slayderni suring.`,
    alt: `Logarifmik oʻqdagi kataklar chastotalari gistogrammasi, misoldagi katak shtrixli chiziq bilan belgilangan.`,
    xLabel: `100 000 km² ga yiliga Mw ≥ 6 hodisalar`, yLabel: `Kataklar`,
    mine: `misoldagi katak`,
    slider: `Chastota kamida`,
    readout: `{all} ta katakdan {n} tasining chastotasi kamida {r}.`,
  },
  tech: [
    `Taʼrif (docs/method.md §8): <code class="lr-formula">rate_m6 = N(Mw ≥ 6.0, 1964–2021, barcha chuqurliklar, episentr katak ichida) / 58 yil / area_km2 × 100,000</code>Tanlanma doirasida emas, oltiburchakning oʻzida va barcha ISC-GEM hodisalari bilan sanaladi (chastotalar b tanlanmasi bilan cheklanmaydi).`,
    `Nega 1964 va M 6.0: M 6.0 Michael (2014) ning 1964–1975 va undan keyingi barcha davrlar uchun toʻliqlik qiymatiga teng yoki undan yuqori, shuning uchun sonlar qayd etish imkoniyati bilan cheklanmaydi.`,
    `Ogohlantirishlar: aftershoklar ketma-ketliklari kiritilgan, shuning uchun bitta juda kuchli ketma-ketlik katak chastotasida ustunlik qilishi mumkin; 58 yil eng yirik zilzilalarning takrorlanish davrlariga nisbatan qisqa. Bird & Kagan (2004) uzoq muddatli chastotalarni chegara sinflari boʻyicha burchak magnitudalari bilan modellashtiradi, bu oddiy sanash esa bunga urinmaydi.`,
    `Saytda: “M6+ chastotasi” qatlami va katak panelidagi chastota; katak tafsilot fayllarida yillik sonlar ham bor.`,
  ],
};
