export default {
  sentence: `La ley de Omori-Utsu describe cómo disminuye la tasa de réplicas con el tiempo tras un sismo principal, aproximadamente como uno dividido por el tiempo transcurrido, con tres números: K (productividad), c (un retardo inicial) y p (la rapidez del decaimiento).`,
  simple: [
    `Justo después de un terremoto grande, las réplicas llegan con rapidez; un día después, con mucha menos frecuencia; un mes después, rara vez. La tasa cae deprisa al principio y luego lentamente, durante meses o años.`,
    `Fusakichi Omori observó en la década de 1890 que la tasa cae aproximadamente como 1/t. Tokuji Utsu añadió el exponente p: con p cercano a 1, diez veces más tarde significa unas diez veces menos réplicas por día.`,
    `<strong>K</strong> fija cuántas réplicas hay en total, <strong>p</strong> con qué rapidez se extinguen, y <strong>c</strong> un breve tiempo inicial en el que la tasa es más plana. Con un catálogo global, a menudo faltan las primeras horas, por lo que c puede no ser medible.`,
  ],
  analogy: `Es como el tañido de una campana grande: fuerte e intenso al principio, luego se desvanece, rápido al comienzo y después cada vez más despacio, pero nunca se detiene de golpe.`,
  example: {
    title: `{place} ({year}), M {mag}`,
    body: [
      `Réplicas dentro de {radius} durante un año, completas por encima de magnitud {mcat}: {nFit} eventos en el ajuste. Resultado: p = {p} (± {sp}), K = {K} por día; c = {c} día (resuelto: {cRes}). Calidad {q}.`,
      `De las {nSeq} secuencias de la página Secuencias, {nA} tienen calidad A y {nB} calidad B. En secuencias sintéticas con p verdadero = {pTrue}, el mismo ajuste recupera p = {pMean} en promedio, con una dispersión entre ejecuciones de {pSd}.`,
    ],
  },
  diagram: {
    title: `Decaimiento de las réplicas en ejes log-log`,
    caption: `Puntos: tasas reales de réplicas de la secuencia (eventos por día por encima de Mcat). Línea: K(t + c)^−p con los valores de p y c de los controles y el K ajustado. Los primeros puntos quedan por debajo de la línea porque al principio se pierden réplicas pequeñas (el ajuste lo modela; la línea no). Abajo: un año en un eje temporal lineal, con réplicas generadas a partir del modelo actual.`,
    alt: `Gráfico log-log de la tasa de réplicas frente a los días desde el sismo principal, con una línea decreciente casi recta; debajo, una franja de marcas densas al principio y escasas después.`,
    lgData: `Tasa observada (real)`, lgModel: `Modelo de Omori-Utsu`,
    xLabel: `Días desde el sismo principal`, yLabel: `Réplicas por día`,
    stripStart: `día 0`, stripEnd: `día 365`, stripLabel: `Réplicas simuladas durante un año`,
    pSlider: `p`, cSlider: `c (días)`, reset: `Valores ajustados`,
    binLabel: `Días`, countLabel: `Réplicas`,
    readout: `p = {p}, c = {c} día, K = {K}: la tasa del día 10 es unas {ratio} veces menor que la del día 1.`,
  },
  tech: [
    `Tasa de Omori-Utsu de eventos por encima de la magnitud de completitud:<code class="lr-formula">λ(t) = K / (t + c)^p</code>con t en días. El número esperado en [t₁, t₂] es K ∫ (t + c)^−p dt.`,
    `Ajuste en este atlas (scripts/sequences.py): máxima verosimilitud sobre eventos de ComCat dentro de max(100 km, L) del sismo principal, L = 10^(−2.44 + 0.59 M) km (Wells & Coppersmith 1994), para 0–365 días. Mcat es MAXC + 0.2 de los días 10–365, nunca inferior a 4.5. El ajuste conserva el inicio de la secuencia modelando la completitud dependiente del tiempo <code>Mc(t) = max(Mcat, Mm − 4.5 − 0.75 log₁₀ t)</code> (Helmstetter et al. 2006; Page et al. 2016), con el b-positive de la secuencia en ese modelo.`,
    `Calidad: A requiere n ≥ 100, σp ≤ 0.10, 0.5 ≤ p ≤ 2 y ningún segundo evento a menos de 0.5 unidades del sismo principal; B requiere n ≥ 50 y σp ≤ 0.20. <code>c_resolved</code> es falso cuando c es inferior a 0.001 día o no tiene error estándar: un catálogo telesísmico pierde las primeras horas, por lo que c no está acotado, mientras que K y p siguen siendo utilizables.`,
    `En el sitio: los gráficos de decaimiento y las insignias de calidad de la página Secuencias. Los puntos de tasa usan intervalos espaciados logarítmicamente de los conteos por encima de Mcat.`,
  ],
};
