export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, "0");
}

/**
 * Blend base toward overlay by overlayPercent (0–100).
 * @param {string} baseHex
 * @param {string} overlayHex
 * @param {number} overlayPercent
 */
export function mixHex(baseHex, overlayHex, overlayPercent) {
  const base = hexToRgb(normalizeHex(baseHex));
  const overlay = hexToRgb(normalizeHex(overlayHex));
  if (!base || !overlay) return normalizeHex(baseHex);
  const t = overlayPercent / 100;
  const w = 1 - t;
  return normalizeHex(
    rgbToHex(
      Math.round(base.r * w + overlay.r * t),
      Math.round(base.g * w + overlay.g * t),
      Math.round(base.b * w + overlay.b * t),
    ),
  );
}

/** @param {number} r @param {number} g @param {number} b @returns {{ h: number, s: number, v: number }} */
export function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) * 60;
    } else {
      h = ((rn - gn) / delta + 4) * 60;
    }
  }

  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

/** @param {number} h @param {number} s @param {number} v @returns {{ r: number, g: number, b: number }} */
export function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - chroma;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) {
    rp = chroma;
    gp = x;
  } else if (hue < 120) {
    rp = x;
    gp = chroma;
  } else if (hue < 180) {
    gp = chroma;
    bp = x;
  } else if (hue < 240) {
    gp = x;
    bp = chroma;
  } else if (hue < 300) {
    rp = x;
    bp = chroma;
  } else {
    rp = chroma;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/** @param {string} hex @returns {{ h: number, s: number, v: number }} */
export function hexToHsv(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 0 };
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

/** @param {number} h @param {number} s @param {number} v */
export function hsvToHex(h, s, v) {
  const rgb = hsvToRgb(h, s, v);
  return normalizeHex(rgbToHex(rgb.r, rgb.g, rgb.b));
}

/** Full-saturation color at hue h (for SV field gradient). @param {number} h */
export function hueToHex(h) {
  return hsvToHex(h, 1, 1);
}

/** @param {string} digits @returns {string | null} six hex digits */
function expandHexDigits(digits) {
  const clean = digits.replace(/[^0-9a-f]/gi, "");
  if (clean.length === 3) {
    return clean
      .split("")
      .map((char) => char + char)
      .join("")
      .toUpperCase();
  }
  if (clean.length === 6) return clean.toUpperCase();
  return null;
}

/** @param {string} hex */
export function normalizeHex(hex) {
  const trimmed = hex.trim();
  if (trimmed.startsWith("#")) {
    const six = expandHexDigits(trimmed.slice(1));
    if (six) {
      const rgb = hexToRgb(`#${six}`);
      if (rgb) return rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase();
    }
  }
  const rgb = hexToRgb(trimmed);
  if (!rgb) return "#000000";
  return rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase();
}

/**
 * Parse a CSS color value (token, hex, or rgb) to normalized #RRGGBB.
 * @param {string} value
 * @returns {string | null}
 */
export function cssColorToHex(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return normalizeHex(trimmed);

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return normalizeHex(
      rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])),
    );
  }

  return null;
}

/** @param {string} raw */
export function sanitizeHexDigits(raw) {
  return raw.replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
}

/** @param {string} raw @returns {string | null} normalized #RRGGBB, or null if not parseable */
export function parseHexInput(raw) {
  const six = expandHexDigits(raw.replace(/[^0-9a-f]/gi, ""));
  if (!six) return null;
  const hex = `#${six}`;
  return hexToRgb(hex) ? normalizeHex(hex) : null;
}

/** @param {string} hex #RRGGBB */
export function hexDisplayDigits(hex) {
  return normalizeHex(hex).slice(1);
}

/** @param {string} hex */
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white hex for readable text on a solid background. @param {string} hex */
export function contrastTextColor(hex) {
  return relativeLuminance(hex) > 0.179 ? "#000000" : "#FFFFFF";
}

/** WCAG contrast ratio (1–21). @param {string} hexA @param {string} hexB */
export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(normalizeHex(hexA));
  const b = relativeLuminance(normalizeHex(hexB));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbToLab(rgb) {
  let r = rgb.r / 255,
    g = rgb.g / 255,
    b = rgb.b / 255,
    x,
    y,
    z;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function deltaE(labA, labB) {
  const deltaL = labA.l - labB.l;
  const deltaA = labA.a - labB.a;
  const deltaB = labA.b - labB.b;
  const c1 = Math.sqrt(labA.a * labA.a + labA.b * labA.b);
  const c2 = Math.sqrt(labB.a * labB.a + labB.b * labB.b);
  const deltaC = c1 - c2;
  let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
  const sc = 1.0 + 0.045 * c1;
  const sh = 1.0 + 0.015 * c1;
  const deltaLKlsl = deltaL / 1.0;
  const deltaCkcsc = deltaC / sc;
  const deltaHkhsh = deltaH / sh;
  const i =
    deltaLKlsl * deltaLKlsl +
    deltaCkcsc * deltaCkcsc +
    deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}

/** Perceptual distance below which a sample needs an edge against its surface. */
export const COLOR_SEPARATION_DELTA_E = 10;

/**
 * True when sample and surface are too similar to distinguish without a hairline edge.
 * @param {string} sampleHex
 * @param {string} surfaceHex
 * @param {number} [threshold]
 */
export function colorsNeedSeparation(sampleHex, surfaceHex, threshold = COLOR_SEPARATION_DELTA_E) {
  const sampleRgb = hexToRgb(normalizeHex(sampleHex));
  const surfaceRgb = hexToRgb(normalizeHex(surfaceHex));
  if (!sampleRgb || !surfaceRgb) return false;
  return deltaE(rgbToLab(sampleRgb), rgbToLab(surfaceRgb)) < threshold;
}
