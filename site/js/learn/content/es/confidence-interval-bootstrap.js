export default {
  sentence: `El intervalo del 95 % que acompaña a cada valor b es el rango que cubriría el b verdadero en 95 de cada 100 repeticiones de la medición, y el atlas lo estima mediante bootstrap: volviendo a extraer el catálogo muchas veces y recalculando b.`,
  simple: [
    `Un valor b obtenido de unos cientos de terremotos es incierto: un conjunto de terremotos ligeramente distinto habría dado un número ligeramente distinto.`,
    `No podemos repetir la historia de la Tierra, pero sí podemos repetir la muestra. El <strong>bootstrap</strong> extrae del catálogo real un nuevo catálogo del mismo tamaño, al azar y con reemplazo (algunos eventos dos veces, otros ninguna), y vuelve a calcular b. Tras muchas de estas extracciones, el 95 % central de los valores b es el intervalo.`,
    `Un intervalo estrecho significa que los datos determinan bien b. Uno amplio significa que no, y entonces el atlas omite b (véase “Códigos de calidad”).`,
  ],
  analogy: `Para saber cuánto podría oscilar el resultado de una encuesta, se podría preguntar muchas veces a un nuevo grupo aleatorio del mismo tamaño. El bootstrap hace esto con las personas a las que ya se preguntó, volviendo a sacarlas al azar.`,
  example: {
    title: `El intervalo de una celda de subducción cerca de {loc}`,
    body: [
      `b = {b} con un intervalo del 95 % de [{lo}, {hi}], de amplitud {ciw}, a partir de {nb} eventos por encima del umbral y {nboot} remuestreos bootstrap. Calidad {q}.`,
      `Cualquier valor de b entre {lo} y {hi} es compatible con estos datos. No se ha demostrado que otra celda cuyo intervalo se superpone con este tenga un b diferente.`,
    ],
  },
  diagram: {
    title: `Los remuestreos bootstrap construyen el intervalo`,
    caption: `Cada remuestreo vuelve a extraer con reemplazo los eventos de la celda por encima de Mc y reestima b con un único umbral fijo. El atlas también reestima Mc en cada remuestreo, por lo que su intervalo (barra sobre el gráfico) suele ser algo más amplio.`,
    alt: `Histograma de valores b bootstrap que crece remuestreo a remuestreo; al final, una banda sombreada marca el 95 % central.`,
    xLabel: `b de un remuestreo bootstrap`, yLabel: `Remuestreos`,
    band: `95 % central`, atlasBar: `intervalo del atlas`,
    start: `Pulse Reproducir para extraer los remuestreos.`,
    running: `Remuestreo {k} de {n}: b = {b}. 95 % central hasta ahora: [{lo}, {hi}].`,
    done: `{n} remuestreos: 95 % central [{lo}, {hi}]. El intervalo del atlas, con Mc reestimada cada vez, es [{alo}, {ahi}].`,
    again: `Nueva extracción`, skip: `Mostrar el resultado`,
  },
  tech: [
    `Procedimiento por celda y clase de profundidad: extraer n eventos con reemplazo de los n eventos del círculo de muestreo; reestimar la Mc de la celda (MAXC + 0.2) y los umbrales por evento; calcular b con el estimador de Aki-Utsu; repetir {nboot} veces. El intervalo va del percentil 2.5 al 97.5 de los remuestreos, por lo que incluye la incertidumbre de Mc (Woessner & Wiemer 2005).`,
    `Por qué {nboot} remuestreos (1000 desde la versión 0.5.0, 200 antes): los límites del intervalo también se estiman a partir de extracciones aleatorias, y cerca de los límites A/B/C su dispersión puede cambiar el código de una celda. En una celda de prueba con 150 eventos (88 por encima del umbral), los límites inferior y superior variaron entre semillas aleatorias con una desviación estándar de 0.012 y 0.024 con 200 remuestreos, y de 0.005 y 0.009 con 1000 (tests/test_atlaslib.py).`,
    `Por qué no solo la fórmula: el error estándar clásico de b, σ ≈ b/√n (Aki) o la forma de Shi–Bolt, supone una Mc conocida y fija. Aquí el propio umbral se estima y la muestra es modesta, por lo que el bootstrap por percentiles es el resumen más honesto. Los gráficos de corte en los detalles de la celda usan ±1.96 σ de Shi–Bolt por rapidez.`,
    `Límites: el bootstrap reproduce el ruido de muestreo, no los errores sistemáticos (una escala de magnitud errónea, eventos perdidos por encima de Mc, la mezcla de dos poblaciones). Que los intervalos se superpongan no demuestra igualdad; que no se superpongan es un indicio conservador de diferencia, no una prueba formal (Marzocchi et al. 2020).`,
    `En el sitio: la barra del intervalo sobre la escala de b en el panel de la celda, el corchete tras cada valor b, la amplitud del intervalo que fija el código de calidad y el gráfico de intervalos de dos filas de la vista de comparación.`,
  ],
};
