export default {
  sentence: `La distribución frecuencia-magnitud (FMD) cuenta cuántos terremotos de cada tamaño contiene un catálogo, y es el gráfico del que se leen tanto Mc como el valor b.`,
  simple: [
    `Se ordenan los terremotos de un lugar en clases de tamaño de 0.1 unidades de magnitud de ancho y se cuenta cada clase. Esa tabla es la FMD.`,
    `Puede dibujarse de dos maneras. <strong>No acumulada</strong>: el conteo de cada clase. <strong>Acumulada</strong>: el conteo de eventos al menos de ese tamaño, N(≥ M). La curva acumulada es más suave, porque cada punto incluye todos los eventos mayores.`,
    `En un eje de conteo normal, la curva cae en picado y los eventos grandes desaparecen sobre la línea base. En un eje de conteo logarítmico, donde cada línea de la cuadrícula es diez veces la anterior, la parte por encima de Mc se convierte en una línea recta. Esa línea recta es la ley de Gutenberg-Richter.`,
  ],
  analogy: `Es como contar las monedas de un frasco por su valor: muchas monedas pequeñas y menos grandes. Si se representa cuántas monedas valen “al menos esto”, en una escala que multiplica por diez en cada paso, un patrón regular aparece como una línea recta.`,
  example: {
    title: `La FMD de una celda de subducción cerca de {loc}`,
    body: [
      `La muestra de esta celda tiene {total} eventos someros de Mw de ISC-GEM. La clase más pequeña, {mFirst}, tiene {nFirst} eventos y el evento mayor está en la clase {mMax}.`,
      `Con Mc = {mc} hay {nMc} eventos de ese tamaño o mayores. Una unidad de magnitud más arriba, en {m1}, solo quedan {nM1}: unas diez veces menos, que es lo que significa un valor b cercano a 1.`,
    ],
  },
  diagram: {
    title: `Una FMD, cuatro vistas`,
    caption: `Datos reales de la celda de ejemplo. Alterne entre conteos por intervalo y conteos acumulados, y entre un eje de conteo lineal y uno logarítmico. La línea discontinua es la Mc del atlas.`,
    alt: `Gráfico de la distribución frecuencia-magnitud de la celda que puede alternarse entre barras y puntos acumulados, lineal y logarítmico.`,
    yCum: `Eventos con magnitud ≥ M`, yNon: `Eventos por intervalo de 0.1`,
    kindLabel: `Conteos`, non: `Por intervalo`, cum: `Acumulados`,
    scaleLabel: `Eje`, lin: `Lineal`, log: `Log`,
    read_non_lin: `Conteos por intervalo en un eje lineal: domina el pico cerca de Mc y los eventos mayores son invisibles.`,
    read_non_log: `Conteos por intervalo en un eje logarítmico: por encima de Mc las barras caen a lo largo de una línea recta; por debajo de Mc descienden porque se pierden eventos.`,
    read_cum_lin: `Conteos acumulados en un eje lineal: una curva empinada, difícil de leer para las magnitudes grandes.`,
    read_cum_log: `Conteos acumulados en un eje logarítmico: el gráfico clásico de Gutenberg-Richter. Por encima de Mc, los puntos quedan cerca de una línea recta cuya pendiente es −b.`,
  },
  tech: [
    `Con magnitudes agrupadas en intervalos de ΔM = 0.1, la FMD no acumulada es n(Mᵢ), el conteo con M en [Mᵢ − ΔM/2, Mᵢ + ΔM/2), y la FMD acumulada es N(≥ Mᵢ) = Σ_{j ≥ i} n(Mⱼ). Por encima de Mc, ambas siguen<code class="lr-formula">log₁₀ N(≥ M) = a − b · M</code>y los conteos no acumulados tienen la misma pendiente con una ordenada en el origen menor.`,
    `Ajuste: el atlas nunca ajusta b por mínimos cuadrados sobre los puntos representados (los puntos no son independientes y los conteos de las magnitudes grandes son minúsculos); usa el estimador de máxima verosimilitud (véase “Valor b de Gutenberg-Richter”).`,
    `Datos: los archivos de detalle de cada celda contienen la FMD no acumulada por clase de profundidad para ISC-GEM (la muestra de b, Mw directa desde la v0.2) y para ComCat tal como se distribuye. El panel de la celda dibuja la FMD acumulada en un eje logarítmico con la línea de Mc, y la descarga CSV lista los conteos y los conteos acumulados por intervalo.`,
    `Precaución: con unos cientos de eventos, la cola superior es ruidosa, y los eventos grandes aislados quedan sobre un escalón largo y plano. Marzocchi et al. (2020) muestran que b obtenido de muestras pequeñas está sesgado y se correlaciona con la mayor magnitud de la muestra.`,
  ],
};
