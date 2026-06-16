// Hand-picked palette (Sasha Trubetskoy's "20 distinct colors" set) chosen
// for maximum perceptual separation. Equal-step HSL hue rotation looks "even"
// mathematically but isn't perceptually even — humans see a wide swath of
// hue (roughly 60°-180°, green/cyan/yellow-green) as "the same green", so
// formula-generated palettes keep producing look-alike colors in that band.
// This list avoids that by construction.
const PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4',
  '#f032e6', '#bfef45', '#fabed4', '#469990', '#9a6324', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#ffe119',
  '#e6beff', '#808080',
];

export function chartColors(count: number): string[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => PALETTE[i % PALETTE.length]);
}
