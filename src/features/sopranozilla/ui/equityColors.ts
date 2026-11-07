// Equity colors as the user's reference tool paints them (D144), read from
// its screenshots:
// - a hand (the cells of its equity matrix): ABSOLUTE scale — red near 0 %,
//   orange ~25 %, yellow at 50 %, green toward 100 % (74o 2.93 red, AJs 23.46
//   orange, Q8s 50.00 yellow, AA 89.75 green);
// - each combo of a hand (its list): RELATIVE to the hand's mean — olive when
//   close to it (J2 7.83 % and AA 89.80 % look the same), green well above
//   (75s 33.79 vs 10.56), brown just below, red far below (75s 1.87).

type Rgb = readonly [number, number, number];
type Stop = readonly [number, Rgb];

function lerp(stops: readonly Stop[], x: number): string {
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (x <= first[0]) return rgb(first[1]);
  if (x >= last[0]) return rgb(last[1]);
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i]!;
    const [x0, c0] = stops[i - 1]!;
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return rgb([0, 1, 2].map((k) => c0[k]! + (c1[k]! - c0[k]!) * t) as unknown as Rgb);
    }
  }
  return rgb(last[1]);
}

const rgb = (c: Rgb) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;

/** Equity in % → the matrix cell color (absolute). */
const ABSOLUTE: readonly Stop[] = [
  [0, [226, 38, 28]],
  [12, [233, 72, 26]],
  [25, [240, 128, 30]],
  [40, [244, 190, 40]],
  [50, [246, 236, 46]],
  [70, [180, 230, 44]],
  [90, [76, 222, 38]],
  [100, [60, 214, 40]],
];

/** Points above (+) / below (−) the hand's mean → the combo text color. */
const RELATIVE: readonly Stop[] = [
  [-9, [222, 70, 52]],
  [-3, [205, 128, 52]],
  [-1.2, [196, 150, 60]],
  [0, [190, 186, 76]],
  [1.5, [186, 190, 76]],
  [8, [112, 216, 66]],
];

/** Background of a hand's equity badge (0..1). */
export function handEquityColor(eq: number): string {
  return lerp(ABSOLUTE, eq * 100);
}

/** Text color of a combo's equity vs its hand's mean (both 0..1). */
export function comboEquityColor(eq: number, handMean: number): string {
  return lerp(RELATIVE, (eq - handMean) * 100);
}
