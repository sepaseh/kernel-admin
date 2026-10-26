type Rgb = readonly [number, number, number];

const parse = (color: string, background: Rgb = [255, 255, 255]): Rgb => {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color)?.[1];
  const expanded =
    hex && hex.length < 5
      ? [...hex].map((value) => value + value).join("")
      : hex;
  const values = expanded
    ? expanded.match(/../g)!.map((value) => Number.parseInt(value, 16))
    : color.match(/[\d.]+/g)?.map(Number);
  if (!values || values.length < 3) return background;
  let alpha = 1;
  if (values.length > 3) alpha = expanded ? values[3] / 255 : values[3];
  return values
    .slice(0, 3)
    .map((value, index) =>
      Math.round(value * alpha + background[index] * (1 - alpha)),
    ) as unknown as Rgb;
};
const luminance = (rgb: Rgb) =>
  rgb
    .map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
const ratio = (first: Rgb, second: Rgb) => {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const hex = (rgb: Rgb) =>
  `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;

export const contrastRatio = (foreground: string, background: string) => {
  const base = parse(background);
  return ratio(parse(foreground, base), base);
};

export const readableTextColor = (background: string) =>
  contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";

/** Keep a chosen hue when possible; only its displayed text shade changes.
 * Persisted theme colors are never rewritten. Mixed custom surfaces still need review. */
export const ensureContrast = (
  color: string,
  backgrounds: string[],
  minimum = 4.5,
) => {
  const surfaces = backgrounds.map((background) => parse(background));
  const initial = parse(color, surfaces[0]);
  const preferred = readableTextColor(backgrounds[0]);
  const targets = [
    parse(preferred),
    parse(preferred === "#000000" ? "#ffffff" : "#000000"),
  ];
  let best = initial;
  let bestRatio = 0;
  for (let step = 0; step <= 40; step++) {
    for (const target of targets) {
      const candidate = initial.map((value, index) =>
        Math.round(value + ((target[index] - value) * step) / 40),
      ) as unknown as Rgb;
      const minimumRatio = Math.min(
        ...surfaces.map((surface) => ratio(candidate, surface)),
      );
      if (minimumRatio >= minimum) return hex(candidate);
      if (minimumRatio > bestRatio) {
        best = candidate;
        bestRatio = minimumRatio;
      }
    }
  }
  return hex(best);
};
