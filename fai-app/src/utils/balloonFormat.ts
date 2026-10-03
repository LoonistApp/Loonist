/**
 * Formats a characteristic's displayed balloon number, applying the
 * project's configured balloon prefix (e.g. "D-" -> "D-12", "D-12.1").
 */
export function formatBalloonNumber(
  itemNumber: number,
  subNumber: string | undefined,
  balloonPrefix: string | undefined
): string {
  const base = subNumber || String(itemNumber);
  return balloonPrefix ? `${balloonPrefix}${base}` : base;
}
