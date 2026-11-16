export default {
  sentence: `Cada celda recibe un código de calidad, A, B, C o insuficiente, según el número de eventos y la amplitud de su intervalo del 95 % en relación con b, y el valor b se muestra solo para A y B.`,
  simple: [
    `El atlas tiene una regla estricta: <strong>ningún valor b sin su intervalo y su código de calidad</strong>.`,
    `Si hay muy pocos terremotos por encima del umbral de completitud, la celda es <strong>insuficiente</strong>. Si hay suficientes pero el intervalo sigue siendo muy amplio en comparación con el propio b, la celda es <strong>C</strong> y b se oculta: un número que podría ser cualquier cosa dentro de un rango amplio induciría a error. Los intervalos estrechos dan <strong>A</strong>, y los moderadamente estrechos, <strong>B</strong>.`,
    `Así pues, las zonas grises y rayadas del mapa no son trabajo pendiente. Son la respuesta honesta para un catálogo global de terremotos moderados y grandes.`,
  ],
  analogy: `Una estación meteorológica que solo registró dos días el año pasado no puede dar un promedio anual fiable. El atlas prefiere dejar la casilla vacía y explicar por qué antes que imprimir una suposición.`,
  example: {
    title: `Cuatro celdas, cuatro códigos`,
    body: [
      `De las {nAll} celdas someras con eventos: {nA} son A, {nB} son B, {nC} son C y {nI} son insuficientes.`,
      `A: la celda cerca de {aLoc} tiene {aNb} eventos por encima del umbral y un intervalo de amplitud {aCiw}, es decir {aCiwr} × b (b = {aB}). B: la celda cerca de {bLoc}, {bNb} eventos, amplitud {bCiw}, es decir {bCiwr} × b (b = {bB}). C: la celda cerca de {cLoc} tiene {cNb} eventos pero un intervalo de amplitud {cCiwr} × b, por lo que b se omite. Insuficiente: la celda cerca de {iLoc} tiene solo {iNb} eventos por encima del umbral.`,
      `Los umbrales provienen de la versión de los datos: A con amplitud de hasta {wA} × b, B de hasta {wB} × b, y al menos {nMin} eventos.`,
    ],
  },
  diagram: {
    title: `Tamaño de la muestra, amplitud relativa del intervalo y código`,
    caption: `El control deslizante usa la aproximación de manual amplitud / b ≈ 2 × 1.96 / √n, que no depende de b; las celdas reales (puntos) se sitúan según su amplitud bootstrap dividida por su b. Con menos eventos que el mínimo, el resultado es “insuficiente” sea cual sea la amplitud.`,
    alt: `Un eje horizontal de amplitud del intervalo dividida por b con zonas A en verde, B en azul y C en rojo; un marcador se desplaza al cambiar el número de eventos; cuatro celdas reales se muestran como puntos.`,
    xLabel: `Amplitud del intervalo del 95 % dividida por b`,
    zone: `{q}`, cellLabel: `celda {q} real, {nb} eventos`, insufficient: `insuficiente`,
    slider: `Eventos por encima del umbral`,
    readout: `{n} eventos: intervalo de aproximadamente [{lo}, {hi}] en torno a b = {b}, amplitud {w} = {wr} × b, código {q}.`,
  },
  tech: [
    `Regla (manifest.json, method.quality): al menos {nMin} eventos por encima de los umbrales por evento; si no, <code>insufficient</code>; después, A si el intervalo bootstrap del 95 % tiene una amplitud de como máximo {wA} × b (b es la estimación puntual de la celda), B si es como máximo {wB} × b, y C en otro caso (b enmascarado; solo se publica la amplitud).`,
    `Por qué en relación con b (desde la versión 0.5.0; antes los límites eran amplitudes absolutas): el intervalo crece con el propio b, aproximadamente 3.92 × b/√n, de modo que un límite absoluto conservaba las celdas de b bajo y ocultaba las de b alto con el mismo número de eventos. En celdas sintéticas con 70 eventos por encima de un umbral conocido, la regla anterior mostraba el 98 % de las celdas con b = 0.8 y el 2 % de las de b = 1.5, y el b mostrado de las celdas con b = 1.5 promediaba 1.24; la regla relativa muestra entre el 73 y el 77 % para cualquier b, y la media de las celdas mostradas difiere del b verdadero en menos de 0.02 (tests/test_atlaslib.py). Con el mismo número total de eventos, las celdas de b alto siguen pasando con menos frecuencia, porque una parte menor de sus eventos queda por encima de MAXC + 0.2.`,
    `Por qué la amplitud y no solo n: el mismo n puede dar amplitudes distintas cuando Mc está mal definida o la muestra mezcla períodos; la amplitud bootstrap incluye la incertidumbre de Mc. Se añade un indicador de estabilidad frente al corte (<code>unstable</code>) cuando b con umbral + 0.2 y + 0.4 queda en ambos casos fuera del intervalo, del mismo lado.`,
    `Convenciones del mapa: A a color pleno, B del mismo color con opacidad reducida, C rayado, insuficiente con un velo gris claro. La leyenda cuenta cuántas celdas superan el filtro.`,
    `Limitación: el filtro controla la precisión, no la exactitud. Una celda puede ser A y aun así estar sesgada (por ejemplo, por un umbral erróneo), y las celdas A vecinas comparten eventos (Wiemer & Wyss 2002; Marzocchi et al. 2020).`,
  ],
};
