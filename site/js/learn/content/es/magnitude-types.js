export default {
  sentence: `La “magnitud” de un terremoto no es un solo número sino una familia de mediciones, cada una hecha sobre ondas sísmicas distintas, y solo la magnitud de momento Mw sigue creciendo en los terremotos más grandes.`,
  simple: [
    `Una magnitud se lee a partir de la vibración que registran los sismómetros. Cada escala escucha ondas distintas: <strong>mb</strong> usa ondas de cuerpo cortas, de alrededor de un segundo; <strong>Ms</strong> usa ondas superficiales más lentas, de unos veinte segundos; <strong>ML</strong> (la idea original de Richter) y <strong>Md</strong> (basada en la duración del registro) las elaboran las redes locales para eventos cercanos, en su mayoría pequeños.`,
    `<strong>Mw</strong>, la magnitud de momento, es diferente: procede del momento sísmico, que es el área de la falla por cuánto se desplazó por la rigidez de la roca. No se queda sin rango.`,
    `Las escalas de onda corta dejan de crecer en los terremotos grandes. Un terremoto enorme y uno simplemente grande pueden recibir casi la misma mb. Esto se llama <em>saturación</em>.`,
  ],
  analogy: `Medir una ola en la playa con una regla de un metro funciona para las olas pequeñas. Ante un tsunami seguiría leyendo “un metro”. mb es la regla corta; Mw mide todo el volumen de agua.`,
  example: {
    title: `Qué magnitud hay detrás de los puntos del mapa`,
    body: [
      `La capa de eventos del mapa contiene {n} terremotos de magnitud 6 o más. Sus magnitudes proceden de fuentes distintas: {iscgem} son Mw de ISC-GEM, {mwtype} son magnitudes de tipo momento de ComCat, {mbproxy} son mb de ComCat convertidas a un proxy de Mw, {msproxy} son Ms convertidas a un proxy de Mw y {other} conservan sin cambios otro tipo de magnitud.`,
      `El terremoto “{place}” ({year}) tiene magnitud {mag} en ComCat, de tipo “{magtype}”, una magnitud de momento. Su mb se habría saturado muy por debajo de ese valor.`,
      `Las capas de valor b usan solo una de estas fuentes, la Mw de ISC-GEM (véase “Mw directa frente a proxy de Mw”).`,
    ],
  },
  diagram: {
    title: `Saturación de las magnitudes de período corto (esquemático)`,
    caption: `Curvas esquemáticas: muestran la forma de la saturación, no una calibración. El nivel en que se aplana cada escala depende del período de las ondas que mide.`,
    alt: `Gráfico de líneas: la diagonal discontinua es la propia Mw; mb se aplana primero, luego ML y después Ms, a medida que crece el tamaño real.`,
    mw: `Mw (momento, sin saturación)`, mb: `mb (ondas de cuerpo de ≈ 1 s)`, ML: `ML (local)`, Ms: `Ms (ondas superficiales de ≈ 20 s)`,
    xLabel: `Tamaño real, Mw`, yLabel: `Magnitud informada`,
    slider: `Tamaño real Mw`,
    readout: `Con Mw {mw}, las escalas esquemáticas indican mb {mb}, ML {ML} y Ms {Ms}.`,
  },
  tech: [
    `Momento sísmico y magnitud de momento (forma de Hanks–Kanamori, M₀ en N·m):<code class="lr-formula">M₀ = μ · A · D,   Mw = (2/3) · (log₁₀ M₀ − 9.1)</code>donde μ es el módulo de cizalla, A el área de ruptura y D el deslizamiento medio. Como Mw sigue al propio momento, crece sin límite.`,
    `mb se mide en ondas P con períodos cercanos a 1 s y Ms en ondas de Rayleigh cercanas a 20 s. Cuando la ruptura es mucho más larga que esas longitudes de onda, la amplitud en ese período apenas sigue creciendo; mb se aplana poco por encima de 6 y Ms en torno a 8 (los niveles exactos dependen de la agencia y la fórmula).`,
    `En este atlas: b se calcula solo con la Mw de ISC-GEM (1976–2021). La magnitud preferida de ComCat es mayoritariamente mb para M 4.5–6 y Mw por encima, por lo que un valor b ajustado sobre ComCat tal como se distribuye depende de dónde cambia el tipo. Los eventos que solo están en ComCat se llevan a una escala común únicamente para la capa de eventos, con conversiones fijas (pendientes de Scordilis 2006): Mw = 0.92 + 0.85 mb, y una relación bilineal para Ms. La información emergente de cada evento indica el tipo de magnitud de cada punto.`,
    `Limitaciones: las conversiones entre escalas conllevan una dispersión de unas 0.2 unidades de magnitud y sesgan b cuando se usan para estadísticas (Castellaro et al. 2006). Las escalas locales ML y Md difieren de una red a otra, por lo que las capas regionales se mantienen aparte.`,
  ],
};
