type Rgb = readonly [number, number, number];

const parse = (color: string, background: Rgb = [255, 255, 255]): Rgb => {
  // Theme inputs are ColorPicker hex or Ant Design comma-form RGB(A), not arbitrary CSS.
  const normalized = color.trim();
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(normalized)?.[1];
  const expanded =
    hex && hex.length < 5
      ? [...hex].map((value) => value + value).join("")
      : hex;
  let values: number[];
  if (expanded) {
    values = expanded.match(/../g)!.map((value) => Number.parseInt(value, 16));
  } else {
    const functional = /^(rgb|rgba)\(([^()]*)\)$/i.exec(normalized);
    const components = functional?.[2].split(",").map((value) => value.trim());
    const expectedLength = functional?.[1].toLowerCase() === "rgba" ? 4 : 3;
    if (
      !components ||
      components.length !== expectedLength ||
      components.some((value) => !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))
    )
      throw new TypeError("Expected a hex or comma-form RGB(A) theme color");
    values = components.map(Number);
    if (
      values.some(
        (value, index) =>
          !Number.isFinite(value) || value > (index < 3 ? 255 : 1),
      )
    )
      throw new TypeError(
        "Theme color channels must be within their RGB(A) range",
      );
  }
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
const ratio = (a: number, b: number) => {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const hex = (rgb: Rgb) =>
  `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;

export const contrastRatio = (foreground: string, background: string) => {
  const base = parse(background);
  return ratio(luminance(parse(foreground, base)), luminance(base));
};

export const readableTextColor = (background: string) =>
  contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";

const blendPositions = (initial: Rgb, targets: Rgb[]) => {
  const transitions = new Set([0, 1]);
  for (const target of targets) {
    for (const [index, value] of initial.entries()) {
      const distance = Math.abs(target[index] - value);
      for (let level = 0; level < distance; level++)
        transitions.add((level + 0.5) / distance);
    }
  }
  const boundaries = [...transitions].sort((first, second) => first - second);
  // Each interval represents one rounded RGB shade; coarse sampling can skip feasible shades.
  return boundaries.slice(1).map((end, index) => (boundaries[index] + end) / 2);
};

/** Keep a chosen hue when possible; only its displayed text shade changes.
 * Persisted theme colors are never rewritten. Mixed custom surfaces still need review. */
export const ensureContrast = (
  color: string,
  backgrounds: string[],
  minimum = 4.5,
) => {
  const surfaces = backgrounds.map((background) => parse(background));
  const surfaceLuminances = surfaces.map(luminance);
  const initial = parse(color, surfaces[0]);
  const preferred = readableTextColor(backgrounds[0]);
  const targets = [
    parse(preferred),
    parse(preferred === "#000000" ? "#ffffff" : "#000000"),
  ];
  let best = initial;
  let bestRatio = 0;
  for (const position of blendPositions(initial, targets)) {
    for (const target of targets) {
      const candidate = initial.map((value, index) =>
        Math.round(value + (target[index] - value) * position),
      ) as unknown as Rgb;
      const candidateLuminance = luminance(candidate);
      const minimumRatio = Math.min(
        ...surfaceLuminances.map((surface) =>
          ratio(candidateLuminance, surface),
        ),
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
