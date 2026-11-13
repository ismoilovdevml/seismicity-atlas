export default {
  sentence: `El atlas describe lo que los catálogos sísmicos registraron en el pasado; no predice cuándo, dónde ni de qué tamaño será el próximo terremoto, y no es un mapa oficial de peligro sísmico.`,
  simple: [
    `Un valor b, un nivel de completitud o una tasa resumen muchos terremotos pasados. Son como un promedio a largo plazo. Los terremotos no se atienen a los promedios: se agrupan en el tiempo, y los largos períodos de calma son normales.`,
    `Hoy ningún método puede predecir el momento, el lugar y el tamaño de un terremoto concreto. Existen pronósticos probabilísticos y mapas de peligro, pero los elaboran agencias oficiales a partir de muchos más ingredientes: modelos de fallas, modelos de movimiento del suelo, efectos de sitio y pruebas rigurosas.`,
    `Para decisiones de seguridad, normas de construcción o seguros, consulte a su agencia sismológica nacional y los modelos oficiales de peligro, no este atlas.`,
  ],
  analogy: `Una tabla climática le dice que julio suele ser seco; no puede decirle si lloverá el próximo martes. Para eso necesita un pronóstico, hecho por quienes se dedican a ello.`,
  example: {
    title: `Conteos anuales de una celda activa cerca de {loc}`,
    body: [
      `ComCat registró en promedio {mean} terremotos de magnitud 4.5 o más por año en el círculo de muestreo de esta celda durante {y0}–{y1}, pero el conteo anual varió entre {min} ({yMin}) y {max} ({yMax}).`,
      `La tasa a largo plazo de Mw ≥ 6 en la propia celda corresponde a unos {perYear} eventos de ese tipo por año. Ese promedio no dice nada sobre qué año tendrá uno.`,
    ],
  },
  diagram: {
    title: `Años reales frente a años aleatorios con el mismo promedio`,
    caption: `Azul: conteos anuales reales (ComCat M ≥ 4.5 tal como se distribuye, del archivo de detalle de la celda; se omite el año parcial en curso). Naranja: una historia simulada con el mismo promedio y una distribución temporal puramente aleatoria. Los conteos reales son más irregulares, con más ráfagas, porque los terremotos se agrupan; ninguna de las dos filas indica el conteo del próximo año.`,
    alt: `Barras emparejadas por año: los conteos reales varían mucho, con picos ocasionales; los conteos aleatorios simulados varían menos en torno a la línea discontinua del promedio.`,
    lgReal: `Conteo anual real`, lgSim: `Aleatorio, mismo promedio`,
    xLabel: `Año`, yLabel: `Eventos por año`,
    again: `Simular otra historia`,
    readout: `Promedio de {mean} por año. Los años reales variaron entre {rmin} y {rmax}; esta historia simulada varía entre {smin} y {smax}.`,
  },
  tech: [
    `Qué es el atlas: estadísticas descriptivas de catálogos con su incertidumbre (Mc, b con intervalos, tasas, concordancia, ajustes de Omori retrospectivos). No es un modelo de pronóstico y no se ha evaluado como tal.`,
    `Por qué la estadística no es predicción: un proceso de Poisson o agrupado (de tipo ETAS) con una tasa conocida sigue dejando al azar el momento de cada evento. Los contrastes espaciales de b basados en muestras pequeñas pueden ser artefactos (Marzocchi et al. 2020), y los eventos mayores pueden sorprender incluso a catálogos largos (Kagan & Jackson 2013, sobre Tohoku).`,
    `Dónde encontrar información oficial: su servicio sismológico o geológico nacional; como referencia global, el GEM Global Seismic Hazard Map (enlazado abajo; CC BY-NC-SA, solo lo enlazamos); el USGS publica pronósticos de réplicas para eventos importantes en EE. UU. y para algunos eventos globales en sus páginas de eventos.`,
    `El descargo de responsabilidad de cada página y de los archivos de datos dice lo mismo: estadísticas de catálogos para investigación y educación; no es un pronóstico de terremotos ni un mapa oficial de peligro sísmico.`,
  ],
};
