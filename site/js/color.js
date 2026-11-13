// Colour ramps for the map, generated in OKLCH so lightness is monotone by construction.
// Light mode: low values are light and recede into the land colour; dark mode flips the anchor.

function oklchToLinearRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

function toHex(rgb) {
  return '#' + rgb.map((v) => {
    v = Math.min(1, Math.max(0, v));
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(v * 255).toString(16).padStart(2, '0');
  }).join('');
}

/** OKLCH to hex; chroma is reduced (hue and lightness kept) until the colour is inside sRGB. */
export function oklch(L, C, h) {
  let rgb = oklchToLinearRgb(L, C, h);
  if (!inGamut(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb(L, mid, h))) lo = mid; else hi = mid;
    }
    rgb = oklchToLinearRgb(L, lo, h);
  }
  return toHex(rgb);
}

/** n colours, low to high, one hue. */
export function sequential(h, n, dark) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const L = dark ? 0.40 + 0.46 * t : 0.91 - 0.50 * t;
    const C = dark ? 0.06 + 0.09 * t : 0.045 + 0.105 * t;
    out.push(oklch(L, C, h));
  }
  return out;
}

/** 2k colours: k for the low arm (far to near the centre), then k for the high arm (near to far). */
export function diverging(hLow, hHigh, k, dark) {
  const arm = (h) => {
    const a = [];
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 1 : i / (k - 1); // 0 = next to the centre, 1 = extreme
      const L = dark ? 0.44 + 0.36 * t : 0.86 - 0.40 * t;
      const C = dark ? 0.07 + 0.08 * t : 0.06 + 0.10 * t;
      a.push(oklch(L, C, h));
    }
    return a;
  };
  return [...arm(hLow).reverse(), ...arm(hHigh)];
}

export const HUE = { low: 55, high: 250, mc: 305, rate: 165, quality: 205, check: 40 };
