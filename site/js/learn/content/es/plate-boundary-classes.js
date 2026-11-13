export default {
  sentence: `Cada terremoto del atlas se etiqueta con el tipo del límite de placas más cercano en el modelo PB2002 (subducción, dorsal, falla transformante, rift y otros), lo que permite comparar b entre contextos tectónicos.`,
  simple: [
    `La capa externa de la Tierra está fragmentada en placas. Donde se encuentran, se mueven de distintas maneras: una se hunde bajo otra (subducción), se separan (dorsales de expansión y rifts) o se deslizan una junto a otra (fallas transformantes).`,
    `El modelo PB2002 de Peter Bird cartografía estos límites y etiqueta cada segmento con una clase. El atlas asigna a cada evento la clase del límite más cercano dentro de 200 km.`,
    `Las clases tienen valores b mensurablemente distintos. Las dorsales de expansión tienen el b más alto (relativamente muchos eventos pequeños); los límites convergentes, el más bajo, lo que encaja con la idea de que b disminuye al aumentar el esfuerzo.`,
  ],
  analogy: `Como las grietas de un lago helado: donde las placas de hielo empujan entre sí se forman grandes crestas y crujidos fuertes; donde se separan, muchas grietas pequeñas. El tipo de borde determina la mezcla de tamaños.`,
  example: {
    title: `b por clase de límite, mundo entero`,
    body: [
      `Agrupando todos los eventos de Mw directa de 1976–2021 por clase, el b más alto se da en {hiName} ({hiCode}): {hiB}. El más bajo, en {loName} ({loCode}): {loB}. Las zonas de subducción dan {subB}.`,
      `Las {nClasses} clases incluyen “ninguna”, los eventos a más de 200 km de un límite. La página Validación compara los valores y su orden con los estudios publicados.`,
    ],
  },
  diagram: {
    title: `b con su intervalo del 95 % por clase de PB2002`,
    caption: `Datos reales (global.json). La línea vertical es b = 1. Elija una clase con el control deslizante o haciendo clic en su fila.`,
    alt: `Gráfico de puntos e intervalos de b por clase de límite de placas, ordenado de mayor a menor.`,
    slider: `Clase`, colClass: `Clase`, colN: `Eventos`,
    readout: `{code}, {name}: b = {b} a partir de {n} eventos. {what}`,
    classes: {
      SUB: `Una placa se hunde bajo otra; los mayores terremotos de la Tierra.`,
      CCB: `Dos continentes chocan, como en el Himalaya.`,
      OCB: `Convergencia dentro de litosfera oceánica sin una placa subducida clara.`,
      CTF: `Placas continentales que se deslizan una junto a otra, como en la falla de San Andrés.`,
      OTF: `Fallas cortas que desplazan las dorsales oceánicas.`,
      CRB: `Un continente que se está separando, como en África oriental.`,
      OSR: `Se forma nuevo fondo oceánico; muchos terremotos pequeños y pocos grandes.`,
      none: `A más de 200 km de cualquier límite de PB2002: interiores de placa y zonas de deformación amplias.`,
    },
  },
  tech: [
    `Clases (Bird 2003): SUB subducción, CCB límite convergente continental, OCB límite convergente oceánico, CTF falla transformante continental, OTF falla transformante oceánica, CRB rift continental, OSR dorsal oceánica; “ninguna” si ningún tramo de límite está a menos de 200 km.`,
    `Asignación: cada evento recibe la clase del tramo de PB2002 más cercano dentro de 200 km. Bird & Kagan (2004) usaron una asignación más cuidadosa; los eventos dentro de la placa subducida (intraslab) en las zonas de subducción pueden quedar mal etiquetados. Los valores b por clase agrupan todos los eventos de una clase (Mw directa, umbrales por evento) y usan el mismo bootstrap que las celdas.`,
    `Interpretación: b ≈ 1.5 β, donde β es el exponente del momento sísmico; Bird & Kagan hallaron β casi universal para la mayoría de las clases y más alto en las dorsales. Schorlemmer et al. (2005) muestran que b es máximo en las fallas normales, intermedio en las de desgarre y mínimo en las inversas.`,
    `En el sitio: la superposición de límites de placas en el mapa y la clase en cada panel de celda; los valores b por clase en la página Validación.`,
  ],
};
