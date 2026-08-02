/**
 * Tiny hex color helpers.
 *
 * Used by the trainer table theme: a layer stores a SINGLE hex and the felt
 * gradient stops are derived from it (lighter at the top, darker at the rim),
 * so a "color" in the UI is one swatch instead of three.
 */

/** Parse `#rrggbb` (or `#rgb`) into [r, g, b]. Returns null on anything else. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const body = m[1]!;
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, '0');
}

/**
 * Lighten (`amount > 0`) or darken (`amount < 0`) a hex color by mixing it
 * toward white or black. `amount` is a fraction in [-1, 1]; out-of-range values
 * are clamped. Mixing (rather than scaling) means pure black still lightens and
 * pure white still darkens — scaling `#000000` by 1.12 stays black.
 *
 * Invalid input is returned untouched so a bad persisted value degrades to a
 * flat color instead of an invalid CSS declaration.
 */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const a = Math.max(-1, Math.min(1, amount));
  const target = a >= 0 ? 255 : 0;
  const w = Math.abs(a);
  const [r, g, b] = rgb;
  return `#${toHex(r + (target - r) * w)}${toHex(g + (target - g) * w)}${toHex(
    b + (target - b) * w,
  )}`;
}

/**
 * Multiply every channel by `factor` (clamped to 0-255). Unlike `shade`, this
 * keeps saturation, which is what a felt highlight needs — mixing toward white
 * washes a deep blue-green out to grey.
 */
export function brighten(hex: string, factor: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const f = Math.max(0, factor);
  return `#${toHex(rgb[0] * f)}${toHex(rgb[1] * f)}${toHex(rgb[2] * f)}`;
}

/** `rgba(...)` string from a hex + alpha. Handy for glows and inline overlays. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

/**
 * Relative luminance (WCAG). Used to decide whether a themed surface needs
 * light or dark text without asking the user to think about contrast.
 */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `true` when white text reads comfortably on `hex`. */
export function prefersLightText(hex: string): boolean {
  return luminance(hex) < 0.45;
}
