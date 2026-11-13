export default {
  sentence: `La concordancia entre catálogos compara, celda por celda, los mismos terremotos en los dos catálogos globales que usa el atlas, ComCat del USGS e ISC-GEM: cuánto difieren sus magnitudes y localizaciones, y qué eventos aparecen solo en uno de ellos.`,
  simple: [
    `Dos agencias pueden describir el mismo terremoto de forma distinta. ComCat (USGS) suele dar la magnitud de ondas de cuerpo mb para los eventos moderados; ISC-GEM recalculó todo como magnitud de momento. Las localizaciones también difieren, de unos pocos a decenas de kilómetros, y las profundidades aún más.`,
    `El atlas empareja los eventos de ambos catálogos (cercanos en tiempo y espacio) y resume, por celda, la mediana de las diferencias de magnitud y de localización, así como los eventos que solo aparecen en un catálogo.`,
    `Donde concuerdan, puede confiar en que las cifras del catálogo significan lo que dicen. Donde discrepan, tenga cuidado con cualquier estadística de cualquiera de los dos.`,
  ],
  analogy: `Como dos mapas de la misma ciudad hechos por topógrafos distintos: la mayoría de las calles coinciden, algunas están un poco desplazadas y unas pocas aparecen solo en un mapa. La comparación le indica dónde volver a comprobar.`,
  example: {
    title: `Una celda con muchos eventos emparejados cerca de {loc}`,
    body: [
      `{cn} eventos emparejados. Mediana de Mw de tipo momento de ComCat menos Mw de ISC-GEM: {dmw}. Mediana de mb de ComCat menos Mw de ISC-GEM: {dmb}. Mediana de la diferencia de epicentro {dloc}, mediana de la diferencia de profundidad {ddep} km. Eventos solo en ISC-GEM: {gonly}; eventos Mw ≥ 6 solo en ComCat: {conly}.`,
      `En el conjunto de celdas: {ok} están marcadas como “concuerdan”, {check} como “revisar” y {few} tienen muy pocas parejas para decidir. En las {nValid} celdas con al menos 10 parejas, la mediana de mb de ComCat menos Mw de ISC-GEM es {medDmb}, y la de Mw de tipo momento de ComCat menos Mw de ISC-GEM, {medDmw}.`,
    ],
  },
  diagram: {
    title: `Diferencias de magnitud entre los catálogos, por celda`,
    caption: `Datos reales: un valor por celda con al menos 10 eventos emparejados. mb queda sistemáticamente por debajo de Mw para estos tamaños, en parte por la saturación; las magnitudes de tipo momento concuerdan estrechamente (sombreado: dentro de ±0.10).`,
    alt: `Histograma de las medianas por celda de las diferencias de magnitud; la diferencia de mb se centra muy por debajo de cero y la de Mw de tipo momento cerca de cero.`,
    which: `Comparar`, dmb: `mb de ComCat − Mw de ISC-GEM`, dmw: `Mw de tipo momento de ComCat − Mw de ISC-GEM`,
    xLabel: `Mediana de la diferencia de magnitud en la celda`, yLabel: `Celdas`, mine: `celda de ejemplo`,
    read_dmb: `mb de ComCat menos Mw de ISC-GEM: mediana {med} en {n} celdas; {out} celdas difieren en más de 0.10.`,
    read_dmw: `Mw de tipo momento de ComCat menos Mw de ISC-GEM: mediana {med} en {n} celdas; {out} celdas difieren en más de 0.10.`,
  },
  tech: [
    `Emparejamiento: un evento de ISC-GEM y uno de ComCat forman una pareja cuando están a menos de 30 s y 100 km; las parejas se asignan a la celda del epicentro de ISC-GEM (docs/method.md §7).`,
    `<ul><li><code>c_dmw</code>: mediana de Mw de tipo momento de ComCat menos Mw de ISC-GEM.</li><li><code>c_dmb</code>: mediana de mb de ComCat menos Mw de ISC-GEM.</li><li><code>c_dloc</code>, <code>c_ddep</code>: medianas de las diferencias de epicentro (km) y de profundidad.</li><li><code>c_gonly</code>: eventos de ISC-GEM sin pareja en ComCat; <code>c_conly</code>: eventos de ComCat con proxy de Mw ≥ 6.0 sin pareja en ISC-GEM.</li></ul>`,
    `Indicador: <code>few</code> si hay menos de 10 parejas; <code>check</code> si |c_dmw| > 0.10, c_dloc > 30 km o (c_gonly + c_conly) / c_n > 0.10; en otro caso <code>ok</code> (docs/data-schema.md).`,
    `En el sitio: la capa “Concordancia” con sus tres variantes (indicador, ΔMw, distancia entre epicentros) y la lista de concordancia entre catálogos en el panel de la celda.`,
  ],
};
