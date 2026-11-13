export default {
  sentence: `El valor b es la pendiente de la ley de Gutenberg-Richter: indica cuántas veces menos terremotos hay por cada paso de una unidad de magnitud, y en la Tierra es cercano a 1.`,
  simple: [
    `Los terremotos pequeños son frecuentes y los grandes escasos, y la proporción es sorprendentemente regular. Con b = 1, cada paso de una unidad de magnitud hacia arriba tiene unas diez veces menos eventos: diez M5 por cada M6, diez M6 por cada M7.`,
    `Un <strong>b más alto</strong> (por ejemplo 1.3) significa relativamente más eventos pequeños y menos grandes. Un <strong>b más bajo</strong> (por ejemplo 0.8) significa relativamente más eventos grandes.`,
    `Los estudios de laboratorio y de campo relacionan b con el esfuerzo en la roca: b más bajo donde el esfuerzo es mayor, como en las fallas inversas; b más alto en las dorsales y en las fallas normales. En un catálogo global M ≥ 5 estas diferencias son sutiles y deben leerse a través de sus intervalos.`,
  ],
  analogy: `Imagine una escalera que baja: cada peldaño es una unidad de magnitud, y cada peldaño hacia abajo contiene unas diez veces más terremotos. El valor b es lo empinada que es la escalera.`,
  example: {
    title: `b en una celda de subducción cerca de {loc}`,
    body: [
      `Eventos someros, Mw directa de ISC-GEM, por encima de los umbrales por evento: b = {b} [{lo}, {hi}] a partir de {nb} eventos, calidad {q}. Una unidad de magnitud más arriba, unas {ratio} veces menos eventos.`,
      `Como comparación, el mundo entero (1976–2021, Mw directa) da b = {gB} [{gLo}, {gHi}] para los eventos someros y {dB} [{dLo}, {dHi}] para los más profundos.`,
    ],
  },
  diagram: {
    title: `Gire la recta de Gutenberg-Richter`,
    caption: `Conteos acumulados reales de la celda de ejemplo (puntos rellenos: en Mc o por encima). La recta pivota alrededor del conteo en Mc; su pendiente es −b. “Mejor ajuste” usa la estimación de máxima verosimilitud con un único umbral.`,
    alt: `FMD acumulada en escala logarítmica con una línea recta que pasa por el punto en Mc y cuya inclinación sigue el control de b.`,
    lgData: `Eventos con magnitud ≥ M (reales)`, lgLine: `Recta de Gutenberg-Richter`,
    yLabel: `Eventos con magnitud ≥ M`, pivot: `pivote en Mc`,
    slider: `b`, fitBtn: `Mejor ajuste, b = {b}`,
    readout: `b = {b}: cada unidad de magnitud más arriba tiene unas {ratio} veces menos eventos. Mejor ajuste con un único umbral {fit}; el valor del atlas para esta celda es {atlas}.`,
  },
  tech: [
    `Ley de Gutenberg-Richter: <code class="lr-formula">log₁₀ N(≥ M) = a − b · M</code>De forma equivalente, las magnitudes por encima del umbral siguen una distribución exponencial con β = b · ln 10.`,
    `Estimador (máxima verosimilitud de Aki-Utsu con la corrección por agrupamiento en intervalos): <code class="lr-formula">b̂ = log₁₀ e / ( M̄ − (Mc − ΔM/2) ),   ΔM = 0.1</code>donde M̄ es la magnitud media de los eventos en Mc o por encima. El atlas usa la forma con umbral por evento del mismo estimador (véase “Magnitud de completitud”).`,
    `Magnitud de momento y ley de potencias: como Mw crece con (2/3) log₁₀ M₀, b = 1.5 β_M, donde β_M es el exponente de la distribución del momento sísmico. Kagan y Bird & Kagan obtuvieron β_M ≈ 0.63–0.67 (b ≈ 0.95–1.0) para la mayoría de las clases de límite de placas y valores más altos en las dorsales oceánicas.`,
    `En este atlas: b se muestra solo con su intervalo del 95 % y su código de calidad; se omite cuando el intervalo es demasiado amplio o la muestra demasiado pequeña. Las celdas vecinas comparten eventos, y las muestras pequeñas sesgan b (Marzocchi et al. 2020), por lo que dos lugares se comparan solo a través de sus intervalos. En el sitio: la capa de b, el valor b destacado en el panel de la celda y la vista de comparación.`,
  ],
};
