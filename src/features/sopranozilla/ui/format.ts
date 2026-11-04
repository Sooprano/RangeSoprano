export function pct(x: number, digits = 1): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '—';
}

export function combos(x: number): string {
  return x.toFixed(2);
}

export function bb(x: number | undefined): string {
  return x === undefined ? '—' : `${x.toFixed(1)} bb`;
}
