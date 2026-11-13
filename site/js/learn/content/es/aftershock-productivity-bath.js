export default {
  sentence: `La ley de Båth dice que la mayor réplica suele ser unas 1.2 unidades de magnitud menor que el sismo principal, y el modelo de Reasenberg-Jones combina el decaimiento de Omori-Utsu con la ley de Gutenberg-Richter para indicar cuántas réplicas de cada tamaño cabe esperar.`,
  simple: [
    `Los terremotos grandes tienen réplicas grandes, pero normalmente claramente menores. Markus Båth observó que esa diferencia es sorprendentemente estable, de alrededor de 1.2 en promedio, con una amplia dispersión de una secuencia a otra.`,
    `Cuántas réplicas produce una secuencia es su <strong>productividad</strong>. Si se combina la rapidez con que las réplicas se extinguen (Omori-Utsu) con la forma en que se reparten sus tamaños (Gutenberg-Richter), se puede decir, para una secuencia ya ajustada, cuántos eventos por encima de un tamaño dado implica el modelo en una ventana de tiempo. Es el modelo de Reasenberg-Jones que usan las agencias para sus avisos sobre réplicas.`,
    `En este atlas, estas cifras describen solo secuencias pasadas. No son un pronóstico.`,
  ],
  analogy: `Un fuego artificial grande deja una estela chisporroteante: muchas chispas pequeñas, unas pocas más grandes, y la mayor chispa suele ser claramente menor que el estallido principal.`,
  example: {
    title: `Las mayores réplicas de las secuencias del atlas`,
    body: [
      `En {nWith} de las {nSeq} secuencias, la capa de eventos M ≥ 6 contiene un evento posterior dentro de la ventana de la secuencia. La mediana de la diferencia entre el sismo principal y la mayor de esas réplicas es {med}.`,
      `{place} (M {mag}): mayor evento posterior en la ventana M {aMag}, una diferencia de {dM}. Su ajuste da K = {K} por día, p = {p} y b-positive de la secuencia {bSeq} por encima de Mcat {mcat}.`,
    ],
  },
  diagram: {
    title: `La diferencia entre el sismo principal y la mayor réplica`,
    caption: `Datos reales: cada punto es una secuencia (sismo principal de sequences.json, mayor evento posterior de la capa de eventos M ≥ 6 dentro del mismo radio y de un año; tipos de magnitud tal como se distribuyen). La línea discontinua es el 1.2 de Båth. La lectura de abajo aplica la forma de Reasenberg-Jones a la secuencia ajustada: es la descripción de una secuencia pasada, no un pronóstico.`,
    alt: `Diagrama de dispersión de la diferencia de magnitud frente a la magnitud del sismo principal para las secuencias del atlas, en torno a una línea discontinua en 1.2.`,
    xLabel: `Magnitud del sismo principal`, yLabel: `Sismo principal menos mayor réplica`,
    bathLine: `Ley de Båth, 1.2`,
    seqSlider: `Secuencia`, mSlider: `Magnitud para el conteo ({place})`, daysLabel: `Ventana`, days: `{d} días`,
    pick: `{place}: M {m}, mayor réplica M {a}, diferencia {d}.`,
    rj: `Para {place}, el modelo ajustado implica unos {n} eventos de M ≥ {m} desde el día 1 hasta el día 1 + {days} (una probabilidad del {prob} % de al menos uno, si el modelo se cumpliera).`,
    colPlace: `Secuencia`, colMain: `Sismo principal`, colAfter: `Mayor réplica (capa M ≥ 6)`, colGap: `Diferencia`,
  },
  tech: [
    `Ley de Båth: <code class="lr-formula">ΔM = Mprincipal − Mmayor réplica ≈ 1.2</code>como promedio, con una dispersión de varias décimas. La diferencia del atlas usa las magnitudes de la capa de eventos (Mw de ISC-GEM o ComCat tal como se distribuye, convertida cuando es necesario), por lo que es solo orientativa.`,
    `Tasa de Reasenberg-Jones de réplicas con magnitud ≥ M en el tiempo t (días):<code class="lr-formula">λ(t, M) = K · 10^(−b (M − Mcat)) · (t + c)^−p</code>con K, c y p del ajuste de Omori-Utsu por encima de Mcat y b el b-positive de la secuencia. El número esperado en una ventana es la integral sobre t, y la probabilidad de al menos un evento es 1 − e^(−N) para un proceso de Poisson (Reasenberg & Jones 1989).`,
    `La productividad aumenta con el tamaño del sismo principal; Page et al. (2016) dan parámetros globales, dependientes de la región, para los pronósticos operativos de réplicas. Los ajustes del atlas son retrospectivos y telesísmicos (completitud M ≥ 4.5), por lo que no dicen nada sobre las réplicas pequeñas ni sobre secuencias en curso.`,
    `El próximo Monitor de secuencias reutiliza estas cantidades para secuencias recientes; allí se aplica la misma advertencia.`,
  ],
};
