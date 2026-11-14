export default {
  sentence: `Los terremotos inducidos los causa o desencadena la actividad humana, como extraer gas, inyectar aguas residuales o llenar un embalse; el yacimiento de gas de Groningen, en los Países Bajos, es el ejemplo europeo mejor registrado.`,
  simple: [
    `Al sacar gas de una arenisca porosa baja su presión. La roca se compacta una fracción de milímetro por metro y las fallas que cruzan el yacimiento reciben un esfuerzo adicional. Cuando ese esfuerzo se libera, la falla desliza: un terremoto pequeño y normalmente somero (unos 3 km), por lo que incluso una magnitud 3 puede dañar casas.`,
    `El número de estos terremotos sigue la historia de producción, pero con retraso y no de forma proporcional. Groningen produjo gas desde 1963; el primer terremoto registrado fue en 1991, el mayor (ML 3.6) en 2012, y siguió habiendo terremotos después de que la producción se detuviera en 2023.`,
    `El atlas muestra el registro: producción mensual, terremotos mensuales, valores b y una comparación con los estudios publicados. No modela la física ni pronostica terremotos futuros.`,
  ],
  analogy: `Apretar una esponja pegada a un marco: cuanto más fuerte y más tiempo aprietas, más se agrietan las juntas de pegamento, y algunas siguen agrietándose un rato después de soltar.`,
  example: {
    title: `Groningen: producción y terremotos ML ≥ {mc}`,
    body: [
      `Terremotos de ML {mc} o más por año: {rise} en 2003–2013 mientras la producción subía hasta su máximo de {peak} mil millones de m³ ({peakYear}), {restr} en los primeros cinco años de restricciones (2014–2018) y {after} después de detenerse la producción (intervalos del 95 %).`,
      `En {years}, la correlación de rangos entre la producción anual y el número de terremotos es {rho} en el mismo año y {rho1} con la producción del año anterior. Una correlación describe el registro; no separa la producción de otros cambios ocurridos al mismo tiempo.`,
    ],
  },
  diagram: {
    title: `Producción un año, terremotos después`,
    caption: `Totales anuales reales del yacimiento de Groningen (producción de NLOG.NL, catálogo KNMI en la región de estudio). Cada punto es un año de producción frente a los terremotos del mismo año o de uno posterior; elija el desfase. La correlación de rangos se recalcula para los años mostrados. Reproducir añade los años uno a uno.`,
    alt: `Diagrama de dispersión de la producción anual de gas frente al número anual de terremotos ML 1.5 o mayores, Groningen 2003 a 2024. Más producción va con más terremotos, sobre todo con un año de desfase.`,
    xLabel: `Producción, 10⁹ m³ por año`,
    yLabel: `Terremotos ML ≥ 1.5`,
    readout: `Desfase de {lag} año(s): correlación de rangos ρ = {rho} en {n} años.`,
    lagLabel: `Terremotos contados`,
    lagOpt: `+{k} a`,
    colYear: `Año`,
    colEvents: `Terremotos, mismo año`,
  },
  tech: [
    `Datos: catálogo KNMI (servicio de eventos FDSN, magnitud local ML, tipo de evento "induced or triggered event"), producción mensual de Groningen según NLOG (10⁹ m³, desde 2003), región de estudio el contorno NLOG del yacimiento con un margen de 2 km, que reproduce los recuentos de Dost et al. (2017) con un 2 % de diferencia.`,
    `Las tasas usan ML ≥ 1.5 para todo el periodo, la completitud conservadora de la red original (Dost et al. 2017; Kraaijpoel et al. 2022). Las tasas por fase llevan intervalos de Poisson exactos del 95 %. Los valores b usan tres estimadores: el del atlas MAXC + 0.2 con bootstrap, Aki-Utsu con ML fija 1.5 y b-positive (van der Elst 2021).`,
    `La correlación es una correlación de rangos de Spearman de 22 valores anuales (2003–2024). Los valores anuales están autocorrelacionados, así que los p-valores son solo indicativos. El vínculo físico (caída de presión, compactación y esfuerzo en las fallas) lo modelan Bourne et al. (2014) y trabajos posteriores; el atlas no lo modela.`,
    `Validación con valores publicados (Dost et al. 2017; Kraaijpoel et al. 2022; Gulia & Wiemer 2026): se reproducen las cifras clásicas de todo el yacimiento; una comparación de mapas difiere porque el catálogo KNMI por sí solo solo cartografía la parte más densa. La tabla está en la página de Casos de estudio.`,
  ],
};
