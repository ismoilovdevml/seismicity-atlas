export default {
  sentence: `b-positive estima el valor b a partir de los saltos positivos entre magnitudes de terremotos consecutivos, lo que lo hace robusto cuando faltan temporalmente eventos pequeños, por ejemplo justo después de un terremoto grande.`,
  simple: [
    `Después de un terremoto grande, los sismogramas se saturan de señales y muchas réplicas pequeñas nunca llegan a catalogarse. Un valor b normal ve entonces muy pocos eventos pequeños y resulta demasiado bajo.`,
    `b-positive usa un truco (van der Elst 2021): recorrer los terremotos en orden temporal y ver cuánto mayor es cada uno que el anterior. Solo se conservan los aumentos claros. Los tamaños de esos aumentos siguen la misma ley que las propias magnitudes, con el mismo b, y apenas dependen de si la red estaba perdiendo eventos pequeños en ese momento.`,
    `El atlas usa b-positive como comprobación de robustez junto al b principal, no como sustituto.`,
  ],
  analogy: `Si en una sala ruidosa solo oye una conversación de vez en cuando, no puede contar las palabras dichas en voz baja. Pero sí puede notar cuánto más fuerte es una palabra que la que oyó justo antes, y eso le informa sobre el rango de voz de quien habla.`,
  example: {
    title: `Una celda de subducción cerca de {loc}`,
    body: [
      `b principal = {b} [{lo}, {hi}]; b-positive = {bpos} [{bposLo}, {bposHi}].`,
      `En las {nShown} celdas someras mostradas con ambos valores, b-positive queda dentro del intervalo del 95 % de b en el {share} % de las celdas, y la mediana de b-positive menos b es {med}.`,
    ],
  },
  diagram: {
    title: `Eventos pequeños perdidos: b clásico frente a b-positive`,
    caption: `Catálogo sintético con b verdadero = 1: una actividad de fondo constante más una secuencia de réplicas. Tras el evento grande, el umbral de detección empieza alto y vuelve a bajar a lo largo de la parte elegida del eje temporal; los puntos grises son eventos perdidos.`,
    alt: `Diagrama de dispersión de la magnitud frente al tiempo; tras un evento grande, muchos puntos pequeños se vuelven grises a medida que aumenta el control de incompletitud.`,
    lgSeen: `Registrados`, lgMissed: `Perdidos`, xLabel: `Tiempo`, yLabel: `Magnitud`, big: `evento grande`,
    slider: `Período incompleto tras el evento grande`,
    readout: `{miss} de {n} eventos perdidos. b clásico = {b}, b-positive = {bp} (valor verdadero 1.00).`,
  },
  tech: [
    `Las diferencias entre magnitudes de una misma distribución exponencial siguen una distribución de Laplace; su lado positivo es exponencial con el mismo β. Con magnitudes consecutivas en orden temporal y una diferencia mínima δ:<code class="lr-formula">b⁺ = log₁₀ e / ( media(Δmᵢ | Δmᵢ ≥ δ) − (δ − ΔM/2) ),   Δmᵢ = mᵢ − mᵢ₋₁</code>El atlas usa δ = 0.2 y ΔM = 0.1 (scripts/seislib.py, b_positive).`,
    `Entrada: eventos por encima del mínimo del período, en orden temporal. Intervalo: ±1.96 σ a partir de la varianza de las diferencias; b-positive se publica solo para celdas de calidad A o B.`,
    `Por qué es robusto: una breve laguna en la detección elimina eventos pequeños, pero un salto positivo se mide sobre todo desde un evento previo menor hasta uno mayor que sí queda registrado, por lo que la distribución de los saltos apenas se ve afectada (van der Elst 2021).`,
    `Cuestión abierta (docs/method.md §2.1): con la muestra de Mw directa, b bajó ligeramente en algunas celdas mientras que b-positive apenas se movió; parte de ello puede deberse a eventos que GCMT no registró justo por encima del umbral. En el sitio: b⁺ con su intervalo en el bloque de robustez del panel de la celda.`,
  ],
};
