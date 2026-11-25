export default {
  sentence: `La vista sencilla valora cuántos datos tiene el catálogo global sobre terremotos fuertes cerca de un lugar. La palabra (una de cuatro) se lee directamente del código de calidad, de la completitud Mc y de la comprobación de catálogos de la celda bajo el lugar. No valora la red sísmica local.`,
  simple: [
    `Cada lugar del mapa está en una celda estadística (un hexágono de unos {area} km² en la vista científica). Para esa celda el atlas ya conoce tres cosas: su <strong>código de calidad</strong> (qué tan preciso es su valor b), su <strong>completitud Mc</strong> (la magnitud más pequeña que el catálogo registra sin huecos) y si los dos catálogos globales, ISC-GEM y USGS ComCat, <strong>coinciden</strong> en los eventos que comparten.`,
    `La valoración convierte esas tres cosas en palabras sencillas: <strong>Muy bien</strong>, <strong>Bien</strong>, <strong>Limitado</strong> o <strong>Muy pocos datos</strong>. No se calcula nada nuevo ni se oculta nada: la ficha del lugar muestra los tres datos bajo la palabra, y «Vista científica de este lugar» abre la celda completa.`,
    `«Muy pocos datos» es la respuesta más frecuente. Significa que el catálogo global ISC-GEM tiene menos de {nMin} terremotos fuertes (de magnitud {gMc} o más, aproximadamente; {fOld} o más antes de {yNew}) a menos de {radius} km en 1976–2021, lo que ocurre en la mayor parte de la Tierra. Describe ese catálogo, no la red local: las regiones tranquilas con redes nacionales densas, como Suiza o Alemania, también reciben «Muy pocos datos». Donde una capa regional de redes locales cubre el lugar, la ficha enlaza con ella (ver Catálogos regionales). Tampoco describe el peligro: un registro tranquilo no prueba que no pueda ocurrir un terremoto fuerte.`,
  ],
  analogy: `Un boletín escolar que dice «bien» solo sirve si se ven las notas que hay detrás. La valoración es la palabra; el código de calidad, la Mc y la comprobación de catálogos que aparecen debajo son las notas.`,
  example: {
    title: `Cómo se valoran las {nAll} celdas`,
    body: [
      `Con la estadística somera (0–70 km) de cada celda: {nV} están en Muy bien, {nG} en Bien, {nL} en Limitado y {nF} tienen muy pocos datos.`,
      `Un ejemplo de Muy bien: la celda cerca de {vLoc} tiene calidad {vQ}, Mc {vMc} y los catálogos coinciden. Un ejemplo de Limitado: la celda cerca de {lLoc} tiene calidad {lQ}, así que su valor b no se muestra.`,
      `«Muy bien» exige una Mc no mayor que {mcMax}, es decir, la Mc somera global de esta versión ({gMc}) más 0.2.`,
    ],
  },
  diagram: {
    title: `De los tres datos a la palabra`,
    caption: `Elige un código de calidad, una comprobación de catálogos y una Mc para ver la valoración. Las barras cuentan las celdas reales con cada valoración en esta versión.`,
    alt: `Un gráfico de barras horizontales con el número de celdas valoradas Muy bien, Bien, Limitado y Muy pocos datos; la valoración elegida con los controles está resaltada.`,
    q: `Código de calidad`, flag: `Comprobación de catálogos`, mc: `Mc`,
    flagOk: `coinciden`, flagCheck: `no coinciden`, flagFew: `pocos en común`, insufficient: `insuficiente`,
    xLabel: `Número de celdas`,
    readout: `Calidad {q}, catálogos: {flag}, Mc {mc}: {rating}.`,
    colRating: `Valoración`, colCells: `Celdas`,
  },
  tech: [
    `La regla, aplicada a la estadística somera (≤ 70 km) de la celda que contiene el lugar (punto en hexágono; si no hay ninguna, el centro de celda más cercano):`,
    `<table class="data"><thead><tr><th scope="col">Valoración</th><th scope="col">Condición</th></tr></thead><tbody><tr><td>Muy pocos datos</td><td>código de calidad <code>insufficient</code> (menos de {nMin} eventos por encima del umbral)</td></tr><tr><td>Limitado</td><td>código de calidad <code>C</code>, o indicador de catálogos <code>check</code></td></tr><tr><td>Muy bien</td><td>código de calidad <code>A</code>, indicador de catálogos <code>ok</code> y Mc ≤ Mc somera global + 0.2 (= {mcMax})</td></tr><tr><td>Bien</td><td>cualquier otra celda <code>A</code> o <code>B</code></td></tr></tbody></table>`,
    `Las reglas se comprueban en este orden. El código de calidad viene de la anchura del intervalo bootstrap del 95 % de b; el indicador de catálogos, de los eventos de ISC-GEM y ComCat emparejados dentro de la celda (ver Consistencia de catálogos); la Mc, de la estimación de completitud de la celda. El indicador de estabilidad frente al umbral y la estadística profunda no se usan: se muestran en la vista científica.`,
    `Qué se cuenta, y la limitación: eventos someros (≤ 70 km) de ISC-GEM de 1976–2021 con Mw medida directamente (incertidumbre ≤ 0.10), a menos de {radius} km del centro de la celda, cada uno por encima del umbral max(Mc de la celda, mínimo global de su período); ese mínimo es {fOld} antes de {yNew} y {fNew} desde {yNew}. Por eso la valoración mide cuántos terremotos fuertes tiene el catálogo global, con una resolución de cientos de kilómetros, no qué tan bien se vigila un lugar. No dice nada de las redes locales, que a menudo registran eventos mucho más pequeños, y no es una estimación de peligro ni de riesgo (Woessner & Wiemer 2005; Wiemer & Wyss 2002).`,
  ],
};
