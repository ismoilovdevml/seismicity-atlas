export default {
  sentence: `El mapa se dibuja sobre hexágonos H3, pero las estadísticas de cada celda usan todos los terremotos dentro de un círculo fijo alrededor del centro de la celda, de modo que cada lugar se mide sobre la misma área.`,
  simple: [
    `H3 es una cuadrícula global de hexágonos creada por Uber y muy usada en mapas. Los hexágonos cubren la esfera con áreas casi iguales, y cada celda tiene un identificador estable, lo que simplifica los enlaces y las uniones de datos.`,
    `Un hexágono de la cuadrícula global es pequeño para hacer estadísticas: rara vez contiene suficientes terremotos grandes. Por eso el atlas toma un <strong>círculo</strong> alrededor del centro de cada celda, mayor que el hexágono, y calcula Mc y b con todos los eventos que contiene.`,
    `Los círculos vecinos se superponen, así que las celdas vecinas comparten terremotos. Por tanto, un patrón de aspecto suave en el mapa se debe en parte a los círculos, no a la Tierra.`,
  ],
  analogy: `Imagine medir la calidad del aire en las esquinas de la cuadrícula de una ciudad, pero cada sensor promedia el aire dentro de una distancia fija a pie. Las esquinas cercanas dan lecturas parecidas en parte porque respiran el mismo aire.`,
  example: {
    title: `La celda cerca de {loc}`,
    body: [
      `Este hexágono cubre {area} km² ({res}). El círculo de muestreo de {radius} km de radio cubre {circle} km², unas {ratio} veces el hexágono. Hay {nCells} hexágonos con al menos un evento en la capa global.`,
      `Los catálogos regionales usan cuadrículas más finas con círculos más pequeños, adaptados a sus terremotos mucho menores: resolución H3 y radio {regList}.`,
    ],
  },
  diagram: {
    title: `Una celda y su círculo de muestreo, a escala`,
    caption: `Área del hexágono tomada de los datos (la celda de ejemplo, o la celda mediana de un catálogo regional), dibujada como un hexágono regular de la misma área. Los círculos discontinuos pertenecen a dos vecinos y muestran la superposición.`,
    alt: `Un hexágono rodeado de seis vecinos, con un círculo grande alrededor del hexágono central y dos círculos discontinuos de vecinos que se superponen con él.`,
    resLabel: `Cuadrícula`, globalOpt: `Global, {r}`, regionalOpt: `Regional res. {res}, {r}`,
    slider: `Radio del círculo`,
    overlapYes: `Los círculos vecinos se superponen, así que los vecinos comparten eventos.`,
    overlapNo: `Los círculos vecinos no se superponen.`,
    readout: `Resolución {res}: hexágono de {area} km², círculo de radio {r} = {circle} km², {ratio} veces el hexágono. {overlap}`,
  },
  tech: [
    `Cuadrícula: resolución H3 {globalRes} para la capa global. Estadísticas por celda: todos los eventos con epicentro a menos de {radius} km (distancia ortodrómica) del centro de la celda, como en el enfoque de radio constante de ZMAP (Wiemer & Wyss 2002). Las tasas usan el área de la propia celda, no la del círculo.`,
    `Por qué un radio fijo y no los N eventos más cercanos: el soporte espacial es el mismo en todas partes, de modo que dos lugares se comparan sobre la misma huella, y los lugares con pocos datos quedan honestamente vacíos (b omitido) en vez de tomar prestados eventos lejanos. El coste es que el tamaño de la muestra, y con él la incertidumbre, varía; se indica.`,
    `Las celdas H3 no son exactamente de igual área (aproximadamente un factor de dos dentro de una misma resolución), por lo que las tasas se dividen por el área propia de cada celda, <code>area_km2</code>.`,
    `Sensibilidad al radio (docs/method.md §1): con 200 o 400 km en lugar de 300 km, b cambia menos de 0.04 (mediana) donde se muestra; el radio decide sobre todo cuántas celdas alcanzan el tamaño de muestra.`,
  ],
};
