// Sempre use estas funções para evitar conversão dupla.

export function dollarsFromCents(cents?: number | null): number {
  const v = Number(cents ?? 0);
  return Math.round(v) / 100;
}

export function centsFromInput(input: string | number): number {
  // Aceita "70", "70,00", "70.00"
  const n = Number(
    String(input)
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  );
  if (!isFinite(n)) return 0;
  // Usa arredondamento para evitar 69.999999
  return Math.round(n * 100);
}

export function formatUSDFromCents(cents?: number | null): string {
  const d = dollarsFromCents(cents);
  return d.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
