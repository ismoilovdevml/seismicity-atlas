export default {
  sentence: `Desde la versión 0.2, cada valor b del atlas usa solo magnitudes de momento de ISC-GEM medidas directamente a partir del momento sísmico, y deja fuera los valores de Mw “proxy” convertidos desde otras escalas.`,
  simple: [
    `ISC-GEM da una Mw para cada terremoto. Para la mayoría de los eventos desde 1976, esa Mw se midió a partir de las formas de onda (el proyecto Global CMT). Para los demás se <em>convirtió</em> desde mb o Ms con una fórmula: un proxy.`,
    `Una conversión es una estimación fundada, con dispersión. Cuando muchas magnitudes estimadas se sitúan cerca del extremo inferior de la muestra, cambian la forma de la distribución de tamaños, y el valor b se desplaza con ellas.`,
    `Por eso el atlas conserva ahora solo las medidas. El indicador que usa es la incertidumbre que acompaña a cada magnitud: las Mw medidas tienen el valor más pequeño; los proxies, valores mayores.`,
  ],
  analogy: `Imagine una encuesta de estaturas en la que a la mayoría se le midió con cinta métrica y a algunos se les estimó por la talla de zapato. Las estimaciones pueden estar bien en promedio, pero difuminan los extremos, y una estadística sobre la rapidez con que escasean las personas altas saldrá desviada.`,
  example: {
    title: `Qué hacen las magnitudes convertidas con b`,
    body: [
      `Eventos someros globales de 2004–2021 por encima de magnitud {cut0}: con la mb de ComCat convertida a Mw, b = {bProxy} ({nProxy} eventos). ComCat tal como se distribuye da {bNative}, y la Mw de ISC-GEM da {bIsc}. La estimación con proxy es demasiado alta, y las tres solo concuerdan a partir de magnitud {agreeCut}.`,
      `Por ello el atlas ajusta b sobre “{sample}” de {period}. Con esa muestra, el b global somero es {gB} [{gLo}, {gHi}] a partir de {gN} eventos por encima de los umbrales de cada período.`,
    ],
  },
  diagram: {
    title: `b global somero según el corte, 2004–2021`,
    caption: `Datos reales (global.json). Las barras son ±1.96 errores estándar. La curva de mb convertida sube abruptamente con cortes bajos, donde la saturación de mb y la pendiente de la conversión distorsionan la distribución.`,
    alt: `Gráfico de líneas de b frente a la magnitud de corte para tres opciones de magnitud; la línea de mb convertida de ComCat empieza mucho más arriba y se une a las otras con cortes más altos.`,
    comcat_proxy: `ComCat, mb convertida a Mw`, comcat_native: `ComCat tal como se distribuye (tipos mixtos)`, iscgem: `Mw de ISC-GEM`,
    xLabel: `Magnitud de corte`, slider: `Corte`,
    readout: `Corte {cut}: la mb convertida da b = {proxy}, ComCat tal como se distribuye {native}, Mw de ISC-GEM {isc}.`,
  },
  tech: [
    `Regla: un evento de ISC-GEM de 1976–2021 entra en la muestra de b solo si la incertidumbre de Mw que figura es como máximo {magerr}, es decir, una magnitud de momento directa. Las tasas, los conteos, Mc(t), las capas de eventos y la comparación con Michael (2014) conservan todos los eventos. Los mínimos de Mc por período se recalculan sobre la misma muestra directa, de modo que umbrales y muestra coinciden.`,
    `Por qué la incertidumbre identifica la Mw directa: en la copia de ISC-GEM de ComCat del USGS no hay un indicador directo/proxy, pero en 1976–2021 ningún evento tiene una incertidumbre entre 0.10 y 0.20, y casi todos los eventos emparejados con una magnitud de Global CMT en ComCat tienen 0.10 (docs/method.md §2.1).`,
    `Por qué no corregir en lugar de excluir: los errores de magnitud gaussianos de tamaño constante dejan b sin sesgo (Tinti & Mulargia 1985). El exceso de b de los proxies es mucho mayor de lo que explicaría el ruido; proviene de qué eventos recibieron proxies y de la conversión por regresión, que sesga b (Castellaro et al. 2006).`,
    `Coste y cuestión abierta: aproximadamente uno de cada ocho eventos de 1976–2021 sale de la muestra de b, el mínimo somero de 1976–2003 sube 0.1 y menos celdas superan el filtro de calidad. En las celdas mostradas en ambas versiones, b bajó ligeramente mientras que b-positive apenas se movió; parte de esa bajada puede deberse a eventos que GCMT no registró justo por encima del umbral. Esto no está resuelto.`,
  ],
};
