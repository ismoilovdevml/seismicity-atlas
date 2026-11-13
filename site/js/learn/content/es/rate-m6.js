export default {
  sentence: `La tasa Mw ≥ 6 es el número de terremotos de ISC-GEM de magnitud de momento 6 o más por año en una celda, dividido por el área de la celda y escalado a 100 000 km², para poder comparar celdas de distinto tamaño.`,
  simple: [
    `Con qué frecuencia ocurrieron terremotos grandes en un lugar es la cifra de sismicidad más sencilla. Para comparar lugares de forma justa, se expresa por año y por área.`,
    `Se usa la magnitud 6 porque el catálogo ISC-GEM es completo a partir de ese tamaño durante todo el período contado, de modo que el conteo no está limitado por las redes antiguas.`,
    `Describe el pasado. Una tasa alta indica que el lugar ha sido activo; no dice cuándo ocurrirá el próximo terremoto grande.`,
  ],
  analogy: `Como el número de tormentas eléctricas por año y por 100 km² en un atlas meteorológico: una forma justa de decir dónde son frecuentes las tormentas, no un pronóstico para el próximo martes.`,
  example: {
    title: `La tasa en una celda de subducción cerca de {loc}`,
    body: [
      `{rate} eventos de Mw ≥ 6 por año por 100 000 km². La celda cubre {area} km², así que eso equivale a unos {perYear} eventos de ese tipo por año en la celda.`,
      `{nPos} de las {nAll} celdas tuvieron al menos un evento Mw ≥ 6; su tasa mediana es {med}. La tasa más alta, {topRate}, está en la celda cerca de {topLoc}.`,
    ],
  },
  diagram: {
    title: `Cómo se reparte la tasa Mw ≥ 6 entre las celdas`,
    caption: `Datos reales: un conteo por celda con al menos un evento (cells.geojson). El eje es logarítmico: cada paso rotulado es diez veces el anterior. Mueva el control deslizante para contar las celdas con una tasa igual o superior.`,
    alt: `Histograma de las tasas de las celdas en un eje logarítmico, con la celda de ejemplo marcada con una línea discontinua.`,
    xLabel: `Eventos Mw ≥ 6 por año por 100 000 km²`, yLabel: `Celdas`,
    mine: `celda de ejemplo`,
    slider: `Tasa de al menos`,
    readout: `{n} de {all} celdas tienen una tasa de al menos {r}.`,
  },
  tech: [
    `Definición (docs/method.md §8): <code class="lr-formula">rate_m6 = N(Mw ≥ 6.0, 1964–2021, todas las profundidades, epicentro en la celda) / 58 años / area_km2 × 100 000</code>Se cuenta dentro del propio hexágono, no en el círculo de muestreo, y con todos los eventos de ISC-GEM (las tasas no se limitan a la muestra de b).`,
    `Por qué 1964 y M 6.0: M 6.0 está en o por encima de la completitud de Michael (2014) para 1964–1975 y todos los períodos posteriores, por lo que los conteos no están limitados por la detección.`,
    `Advertencias: las secuencias de réplicas están incluidas, por lo que una sola gran secuencia puede dominar la tasa de una celda; 58 años es poco comparado con los tiempos de recurrencia de los mayores terremotos. Bird & Kagan (2004) modelan las tasas a largo plazo por clase de límite con magnitudes de esquina, algo que este conteo simple no intenta.`,
    `En el sitio: la capa “Tasa M6+” y la tasa en el panel de la celda; los archivos de detalle de cada celda añaden los conteos anuales.`,
  ],
};
