/** Cor de texto legível (branco ou quase-preto) sobre a cor da marca. */
export function readableOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // contraste com branco vs com #09090b
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.0532) ? "#ffffff" : "#09090b";
}
