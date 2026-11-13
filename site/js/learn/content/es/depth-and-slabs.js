export default {
  sentence: `La mayoría de los terremotos ocurren en las primeras decenas de kilómetros, pero en las zonas de subducción también se producen dentro de la placa que se hunde (la placa subducida, o slab) hasta unos 700 km, y el atlas cartografía por separado los eventos someros (≤ 70 km) y los más profundos (> 70 km) porque las dos poblaciones se comportan de forma distinta.`,
  simple: [
    `Un terremoto comienza en un punto del interior de la Tierra, el <strong>hipocentro</strong>; el punto de la superficie situado encima es el epicentro. La profundidad importa: la misma magnitud sacude mucho menos la superficie cuando ocurre a 400 km de profundidad.`,
    `Donde una placa se hunde bajo otra, sigue rompiéndose a medida que desciende. Al representar los terremotos por profundidad a lo largo de una línea que atraviesa esa zona aparece una banda inclinada, la zona de Wadati-Benioff, que dibuja la placa subducida dentro del manto.`,
    `Los terremotos profundos y los someros tienen valores b distintos, así que mezclarlos difuminaría ambos. El selector de profundidad del mapa elige qué población muestran las capas de b, Mc y calidad.`,
  ],
  analogy: `Como una hoja de papel empujada en ángulo bajo un libro: los pliegues siguen a la hoja hacia abajo. Los terremotos son los pliegues, y sus profundidades dibujan la hoja.`,
  example: {
    title: `Un corte transversal de la placa subducida de Tonga`,
    body: [
      `La capa de eventos M ≥ 6 tiene {n} eventos entre 16° y 24° S cerca de la fosa de Tonga, {y0}–{y1}. {nDeep} de ellos están a más de 70 km de profundidad; el más profundo está a {deepest} (M {deepestM}).`,
      `A escala mundial (1976–2021, Mw directa), los eventos someros dan b = {gB} y los más profundos b = {dB} [{dLo}, {dHi}]: la población más profunda tiene relativamente más eventos grandes.`,
    ],
  },
  diagram: {
    title: `Hipocentros bajo Tonga, de oeste a este`,
    caption: `Datos reales: eventos M ≥ 6 de la capa de eventos, 16–24° S, proyectados sobre una línea oeste-este (distancia desde 174° O). En los catálogos globales, las profundidades de los eventos son menos precisas que los epicentros, y muchos eventos someros se sitúan en profundidades fijas por defecto. Pulse Reproducir para añadir los años en orden.`,
    alt: `Corte transversal con la profundidad creciendo hacia abajo: los eventos someros se concentran cerca de la fosa y una banda de eventos más profundos se inclina hacia el oeste hasta unos 700 km.`,
    lgShallow: `Profundidad ≤ 70 km`, lgDeep: `Profundidad > 70 km`,
    xLabel: `Distancia al este de 174° O (km)`, yLabel: `Profundidad (km)`,
    split: `70 km: la división de profundidad del atlas`, east: `este (lado de la fosa)`, west: `oeste`,
    slider: `Eventos hasta el año`,
    readout: `Hasta {y}: {n} eventos, {deep} de ellos a más de 70 km de profundidad.`,
  },
  tech: [
    `Clases de profundidad: ≤ 70 km (campos <code>sh_*</code>) y > 70 km (<code>dp_*</code>), cada una con su propia Mc, b, intervalo y calidad. Para la comparación con Michael (2014), la validación usa su división en 60 km. Michael obtuvo b ≈ 0.99 para los eventos profundos y 1.05 para los someros en 1964–2009 / 1918–2009.`,
    `Edad de la placa y b: Nishikawa & Ide (2014) hallaron que b en las zonas de subducción aumenta con la edad de la placa subducida; el atlas reproduce el signo de esa diferencia (página Validación, grupos por edad de la placa subducida).`,
    `Geometría de las placas subducidas: Slab2 (Hayes et al. 2018) modela la superficie 3D de cada placa subducida principal. El atlas aún no usa Slab2; una próxima vista 3D de profundidad mostrará los hipocentros en tres dimensiones.`,
    `Precaución: las profundidades telesísmicas pueden errar en decenas de kilómetros, y muchos eventos someros se fijan en profundidades estándar (por ejemplo 10, 15 o 33 km). La división en 70 km es gruesa a propósito.`,
  ],
};
