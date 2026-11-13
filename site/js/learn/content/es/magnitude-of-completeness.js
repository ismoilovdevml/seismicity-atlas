export default {
  sentence: `La magnitud de completitud, Mc, es la menor magnitud a partir de la cual un catálogo registra prácticamente todos los terremotos de un lugar y un período.`,
  simple: [
    `Las redes sísmicas pierden terremotos pequeños: son demasiado débiles para que los detecten suficientes estaciones, o quedan ocultos en la coda de uno mayor. A partir de cierto tamaño ya no se pierde nada. Ese tamaño es Mc.`,
    `Toda estadística que cuente terremotos por tamaño, incluido el valor b, debe usar solo eventos en Mc o por encima. Por debajo, los conteos disminuyen por la red, no por la Tierra.`,
    `Mc cambia con el tiempo y el lugar. Las redes mejoraron con las décadas, así que una misma región tiene hoy una Mc menor que en 1980. Los océanos alejados de las estaciones tienen una Mc más alta que las zonas terrestres bien instrumentadas.`,
  ],
  analogy: `Una red de pesca con una malla fija atrapa todos los peces más grandes que los agujeros y solo algunos de los más pequeños. Contar los peces pequeños de la red informa sobre la red, no sobre el mar. Mc es el tamaño de la malla.`,
  example: {
    title: `Una celda de subducción bien muestreada cerca de {loc}`,
    body: [
      `En esta celda (eventos someros, Mw de ISC-GEM), el intervalo de magnitud más frecuente (la estimación por curvatura máxima, MAXC) es {maxc}. El atlas suma 0.2 y toma Mc = {mc}, con un rango bootstrap de {mcLo}–{mcHi}.`,
      `Cada evento también debe superar el mínimo global de su período: {floor0} para {per0} y {floor1} para {per1}. Así, el umbral efectivo aquí es el mayor entre la Mc de la celda y el mínimo del período.`,
      `Como comparación, el servicio del USGS tal como se distribuye (mayoritariamente mb) es completo aquí desde aproximadamente {mcCc} desde 2010 y desde {mcCc0} en 1973–1989. Una red regional densa detecta eventos mucho menores: el catálogo de {region} ({regionMag}) suele ser completo desde aproximadamente {regionMc}.`,
    ],
  },
  diagram: {
    title: `Elija Mc sobre una distribución frecuencia-magnitud real`,
    caption: `Datos reales: número de eventos someros de Mw de ISC-GEM por intervalo de 0.1 en la celda de ejemplo. Los intervalos grises están por debajo de la Mc elegida y se dejan fuera. El b mostrado usa un único umbral para todos los años; el atlas usa umbrales por evento, por lo que su valor difiere ligeramente.`,
    alt: `Gráfico de barras de conteos de eventos por intervalo de magnitud; las barras suben hasta un pico (MAXC) y luego bajan. Las barras por debajo de la línea discontinua de Mc son grises.`,
    maxc: `MAXC`,
    slider: `Mc`,
    useMaxc: `MAXC + 0.2 = {m}`,
    useAtlas: `Mc del atlas {m}`,
    readout: `Mc {mc}: {n} eventos en ella o por encima; b con un único umbral = {b} (b del atlas para esta celda: {atlas}).`,
  },
  tech: [
    `Estimador: curvatura máxima más 0.2 (MAXC + 0.2, Woessner & Wiemer 2005) sobre magnitudes agrupadas en intervalos de 0.1. MAXC es el intervalo con más eventos; tiende a subestimar Mc, de ahí el +0.2. Los métodos de bondad de ajuste (GFT, Wiemer & Wyss 2000) y de estabilidad de b (MBS) se calculan para la comparación global; MAXC y GFT tienden a dar valores bajos y MBS altos, de modo que juntos acotan Mc (Mignan & Woessner 2012).`,
    `Completitud variable en el tiempo: para 1976–2003 y 2004–2021 se toma un mínimo global por clase de profundidad como max(MAXC + 0.2, MBS) de todos los eventos de Mw directa de ese período. El umbral de cada evento es <code>thrᵢ = max(Mc_cell, floor(period of event i))</code>. Una celda puede elevar el umbral, pero nunca bajarlo por debajo del mínimo.`,
    `b con umbrales por evento: como el exceso de magnitud sobre cualquier umbral es exponencial con el mismo β, <code class="lr-formula">β̂ = n / Σ (mᵢ − (thrᵢ − ΔM/2)),   b = β̂ / ln 10</code>(Aki-Utsu con una Mc por evento). Un único umbral bajo sobre períodos con distinta completitud sesga b hacia abajo.`,
    `En el sitio: la capa de Mc (ISC-GEM, o ComCat para 2010–fecha de corte y 1973–1989 en su propia magnitud, mayoritariamente mb), Mc y su rango en el panel de la celda, la línea discontinua de Mc en la FMD de la celda y el gráfico Mc(t) en los detalles de la celda.`,
  ],
};
