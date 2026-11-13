export default {
  sentence: `El desagrupamiento (declustering) elimina los eventos que parecen réplicas o premonitores de otro mayor, usando ventanas en el espacio y el tiempo; en este catálogo global reduce b y depende mucho de la elección de las ventanas, por lo que el mapa muestra el catálogo completo.`,
  simple: [
    `Los terremotos se agrupan: a uno grande le siguen muchos más pequeños en las cercanías. Algunos estudios quieren solo los sismos principales “independientes”, por ejemplo para comprobar si los eventos ocurren al azar en el tiempo.`,
    `El método clásico de Gardner y Knopoff (1974) traza una caja alrededor de cada evento: una distancia y una duración que crecen con su magnitud. Los eventos menores dentro de la caja de uno mayor se marcan como dependientes y se eliminan.`,
    `En un catálogo global de magnitud 5 o más, las cajas de los eventos mayores duran años y alcanzan cientos de kilómetros, por lo que eliminan mucho más que réplicas. Como los eventos eliminados son en su mayoría pequeños, el valor b de lo que queda baja.`,
  ],
  analogy: `Es como contar las personas que visitan una tienda, pero ignorando a quien llegó menos de una hora después de alguien conocido. Con una regla corta se eliminan grupos de amigos; con una regla de “menos de un año”, se elimina también a la mayoría de los clientes habituales, y el conteo restante dice más sobre la regla que sobre la tienda.`,
  example: {
    title: `b desagrupado en una celda de subducción cerca de {loc}`,
    body: [
      `Catálogo completo: b = {b} [{lo}, {hi}]. Tras el desagrupamiento de Gardner-Knopoff: b = {bdecl} [{bdeclLo}, {bdeclHi}].`,
      `En las {nShown} celdas someras mostradas con ambos valores, la mediana de la diferencia entre el b desagrupado y el completo es {med}, y el b desagrupado es menor en {lower} celdas.`,
    ],
  },
  diagram: {
    title: `Las ventanas espacio-temporales eliminan los eventos agrupados`,
    caption: `Catálogo sintético: eventos de fondo aleatorios más tres secuencias. Las ventanas se abren desde el evento mayor hacia abajo; los eventos dentro de una ventana se eliminan. Cambie la escala de las ventanas para ver cuánto depende el resultado de esa elección.`,
    alt: `Diagrama de dispersión de eventos por tiempo y distancia; aparecen rectángulos alrededor de los eventos grandes y los eventos dentro de ellos se vuelven grises; debajo se muestra el valor b de los eventos restantes.`,
    lgKept: `Conservados`, lgRemoved: `Eliminados como dependientes`, lgWindow: `Ventana`,
    xLabel: `Tiempo (años)`, yLabel: `Distancia a lo largo de la zona (km)`,
    slider: `Escala de las ventanas`, all: `Mostrar todas las ventanas`,
    readout: `Escala de las ventanas {k}: {w} de {nw} ventanas abiertas, {kept} de {n} eventos conservados. b de todos los eventos {bAll}, de los eventos conservados {bKept}.`,
  },
  tech: [
    `Ventanas de Gardner-Knopoff como en ZMAP y OpenQuake (scripts/seislib.py, gk_windows), con la distancia L en km y la duración T en días:<code class="lr-formula">L(M) = 10^(0.1238 M + 0.983),   T(M) = 10^(0.032 M + 2.7389) para M ≥ 6.5; si no, 10^(0.5409 M − 0.547)</code>Los eventos se procesan del mayor al menor; un evento dentro de la ventana de otro mayor es dependiente.`,
    `Por qué el atlas no desagrupa el b principal: para M ≥ 6.5 la ventana temporal supera un año, por lo que en un catálogo global M ≥ 5 las ventanas eliminan una gran parte de todos los eventos, incluidos los independientes. El b desagrupado resultante refleja sobre todo la elección de las ventanas. Kagan (2010) desagrupa con otro método, y el valor de Gardner-Knopoff del atlas no reproduce su b global desagrupado; esto figura como discrepancia en docs/validation.md.`,
    `Publicado de todos modos: el b desagrupado y su intervalo bootstrap están en los datos (<code>sh_bdecl</code>, <code>dp_bdecl</code>) y en el bloque de robustez del panel de la celda, de modo que el efecto es visible por celda.`,
    `Las mismas ventanas reaparecen en las secuencias: la página Secuencias selecciona sismos principales independientes con una ventana relacionada (radio según Wells & Coppersmith 1994, un año).`,
  ],
};
