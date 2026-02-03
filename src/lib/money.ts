export function formatUSD(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value === 0) return "$0";

  const abs = Math.abs(value);
  // Prices like USD/token can be extremely small; keep readable precision.
  if (abs < 0.000001) return `$${value.toFixed(10)}`;
  if (abs < 0.01) return `$${value.toFixed(8)}`;
  return `$${value.toFixed(4)}`;
}
