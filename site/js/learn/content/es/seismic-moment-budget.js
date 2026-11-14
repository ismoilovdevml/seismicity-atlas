export default {
  sentence: `Un balance de momento sísmico compara el momento que acumula la deformación de la corteza, medida con GNSS e InSAR, con el momento que han liberado los terremotos; su cociente se llama a veces acoplamiento sísmico.`,
  simple: [
    `Las placas y los bloques de corteza se mueven unos milímetros al año. Donde la corteza está bloqueada, ese movimiento se almacena como deformación, como un resorte que se tensa. Los terremotos la liberan. El momento sísmico (rigidez × área de falla × deslizamiento) mide el tamaño de un terremoto en las mismas unidades que la deformación acumulada.`,
    `Sumar todos los terremotos desde 1904 y dividir por la tasa geodésica da un cociente. Por debajo de 1 parece un “déficit”, por encima un “excedente”. Pero los mayores terremotos de una región como el Tian Shan vuelven cada pocos siglos, así que un evento en 120 años decide el cociente.`,
    `Por eso el atlas nunca muestra el cociente solo: siempre con su intervalo del 95 % y p_full, la fracción de catálogos simulados de la misma longitud, con acoplamiento total, que liberan menos de lo observado. Parte de la deformación puede ir además a reptación y plegamiento, sin terremotos.`,
  ],
  analogy: `Juzgar el presupuesto de una casa por un mes en el que cayó el pago anual del seguro: ese mes parece de gasto excesivo, los once siguientes parecen austeros, y ninguno dice si el año cuadra.`,
  example: {
    title: `Tian Shan, cinturón completo`,
    body: [
      `Tasa de momento geodésica con acoplamiento total: {mg} [{mgLo}, {mgHi}] × 10¹⁹ N m por año. Liberación sísmica observada desde 1904 dividida por esa tasa: {r} [{lo}, {hi}] (95 %), p_full {p}. Un déficit más allá del ruido del catálogo necesitaría p_full por debajo de 0.05; aquí no hay ningún déficit detectable más allá del ruido del catálogo.`,
      `En el Tian Shan central el cociente es {cr} [{clo}, {chi}], p_full {cp}; quitar su mayor terremoto (Mw {cm}, {cy}) cambia el valor central en un factor de {ck}. La magnitud de esquina que equilibraría el balance del cinturón con la tasa observada de {n6} eventos Mw ≥ 6 desde 1964 es Mw {bal}.`,
    ],
  },
  diagram: {
    title: `Cómo se ve una zona totalmente acoplada en un catálogo corto`,
    caption: `Sintético, con semilla fija. Naranja: el balance geodésico de todo el cinturón del Tian Shan acumulándose con acoplamiento total. Azul: los terremotos de un catálogo simulado que libera en promedio exactamente ese balance (tasa observada de Mw ≥ 6, b del cinturón, magnitud de esquina que equilibra). Mueva la longitud del catálogo; los escalones son grandes terremotos individuales.`,
    alt: `Una recta de momento geodésico acumulado y una escalera de momento sísmico liberado que se queda atrás durante décadas y salta por delante con cada gran terremoto.`,
    lgGeod: `Balance geodésico (acoplamiento total)`,
    lgSeis: `Liberado por terremotos simulados`,
    xLabel: `Años de catálogo`,
    yLabel: `Momento, 10²¹ N m`,
    bigLabel: `mayor Mw {m}`,
    readout: `Tras {y} años: liberado / acumulado = {ratio} con {n} terremotos simulados Mw ≥ 6. La tabla da la dispersión en 200 historias de 120 años.`,
    slider: `Longitud del catálogo`,
    yearsFmt: `{y} años`,
    again: `Simular otra historia`,
    colQ: `Percentil, 200 historias de 120 años`,
    colRatio: `Liberado / acumulado`,
  },
  tech: [
    `Tasa de momento geodésica: Ṁg = 2 μ H Σ A ε̇, con ε̇ = max(|ε̇1|, |ε̇2|, |ε̇1 + ε̇2|) (Savage & Simpson 1997), en las mallas de tasa de deformación de 0.05° de Ou et al. (2026) y Chang et al. (2025), con μ 28–33 GPa y H 15–25 km elegidos uniformemente. Es el momento mínimo con acoplamiento total.`,
    `Tasa de momento sísmico: ISC-GEM y ComCat Mw ≥ 5.8, profundidad ≤ 70 km, cada banda de magnitud sumada en su propio periodo completo (Michael 2014), con la incertidumbre de Mw en el intervalo; y una tasa a largo plazo de una ley de Gutenberg-Richter truncada (Kagan 2002).`,
    `p_full: 4 000 catálogos simulados desde 1904 hasta el corte con acoplamiento total, cada uno con la magnitud de esquina que equilibra el balance (Bird & Kagan 2004), analizados con el mismo estimador por bandas. p_full es la fracción que libera menos de lo observado.`,
    `Validación: la aritmética de Kostrov reproduce a Molnar & Ghose (2000), 6.86 frente a 7 ± 2 mm/año; la fracción de deformación al oeste de 82° E coincide con Chang et al. (2025) dentro de la precisión indicada. Con los momentos de Molnar & Ghose el cociente del cinturón se reduce a la mitad, por eso las magnitudes antiguas figuran como advertencia.`,
  ],
};
