export default {
  sentence: `Los catálogos regionales proceden de redes nacionales densas que registran terremotos mucho menores que los catálogos globales, cada una en su propia escala de magnitud local, por lo que el atlas los dibuja como capas separadas y nunca los fusiona con las celdas globales.`,
  simple: [
    `Una red nacional con estaciones cada pocas decenas de kilómetros capta terremotos demasiado pequeños para sentirse. Eso da miles de eventos donde el catálogo global tiene decenas, y valores b a una escala mucho más fina.`,
    `Pero cada red mide el tamaño a su manera, normalmente con una magnitud local ML o una magnitud de duración Md, calibrada para su propia región. Una ML 3 en Italia y una ML 3 en Nueva Zelanda no son exactamente lo mismo, y ninguna es directamente comparable con la Mw global.`,
    `Por eso las capas regionales se superponen al mapa global con los mismos colores y reglas de calidad, pero en su propia escala, con celdas más finas y círculos más pequeños. Sus licencias también difieren, y la leyenda nombra cada una.`,
  ],
  analogy: `Los pluviómetros propios de una ciudad dan la lluvia calle por calle; un satélite la da para todo el país. Ambos son útiles, pero no se promediaría la lectura de un pluviómetro con un píxel de satélite.`,
  example: {
    title: `{name}`,
    body: [
      `El atlas tiene {nReg} catálogos regionales: {names}. La capa {name} usa {catalogue} ({licence}), {period}, {nEv} eventos, tipo de magnitud {magtype}. Suele ser completa a partir de {mc}, sobre celdas H3 de resolución {res} con un círculo de {radius}.`,
      `El mínimo global somero para {floorPer} es {floor}. Los terremotos en la Mc regional liberan en torno a {ratio} veces menos energía radiada que los del mínimo global.`,
    ],
  },
  diagram: {
    title: `Completitud de los catálogos regionales frente al mínimo global`,
    caption: `Datos reales (regional/index.json, manifest.json). Cada paso de 1 en magnitud equivale a unas 32 veces en energía y, con b ≈ 1, a unas 10 veces en el número de eventos. Las magnitudes regionales son escalas locales, por lo que las posiciones son orientativas.`,
    alt: `Un eje de magnitud con un punto por catálogo regional entre aproximadamente 1 y 3, y una línea discontinua para el mínimo global por encima de 5.`,
    xLabel: `Magnitud de completitud típica`, globalLabel: `mínimo global {m}`, pick: `Región`,
    readout: `{name}: {catalogue}, {magtype}, {licence}, {period}. Mc típica {mc}, resolución H3 {res}, círculo de {radius}. Eso está {dm} unidades por debajo del mínimo global: unas {energy} veces menos energía por evento y aproximadamente {count} veces más eventos por unidad de tiempo.`,
  },
  tech: [
    `Un tipo de magnitud por región: cada capa regional usa un único tipo de magnitud tal como lo distribuye el servicio de eventos FDSN de la red; los eventos con otro tipo se excluyen y la exclusión se indica en la advertencia de la región (docs/regional.md).`,
    `Celdas y umbrales: resolución H3 más fina y un círculo de muestreo más pequeño, Mc variable en el tiempo por período, el mismo estimador de Aki-Utsu con umbrales por evento, intervalos bootstrap y las mismas reglas A/B/C/insuficiente que la capa global.`,
    `Nunca fusionados: los valores b regionales no son comparables uno a uno con los valores b globales de Mw (escalas locales, rangos de magnitud distintos), por lo que se dibujan sobre las celdas globales y se etiquetan, no se promedian.`,
    `Licencias y atribución: cada red publica bajo sus propias condiciones (el diagrama de arriba lista cada una a partir de los datos). El bloque de leyenda de cada región nombra el catálogo, la licencia, el período y la Mc típica, y la página Acerca de y datos da la atribución completa.`,
  ],
};
