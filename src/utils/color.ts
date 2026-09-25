/**
 * Adds an alpha channel to a color from `useThemeColors()`. For places that cannot read var(), such
 * as an SVG `fill` attribute (the Playground minimap mask), and still need a translucent theme color.
 * Handles the two shapes `useThemeColors()` returns: `rgb(r g b)` and the `#rrggbb` fallbacks.
 */
export function withAlpha(color: string, alpha: number): string {
  const rgb = /^rgb\(([^)/]+)\)$/.exec(color.trim());
  if (rgb) return `rgb(${rgb[1].trim()} / ${alpha})`;
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${channel}`;
  }
  return color;
}
