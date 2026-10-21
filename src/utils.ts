export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD in the machine's local timezone (isoDate above is UTC). */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The intervals.icu events endpoint rejects a bare date with a 422. Promote
 * YYYY-MM-DD to local midnight and pass anything else (already a datetime)
 * through unchanged.
 */
export function toLocalDateTime(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
}

/** Drop null/undefined values so tool output stays small. */
export function dropNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;
}

/** Keep only the listed keys, omitting any that are null/undefined. */
export function pick(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return dropNulls(Object.fromEntries(keys.map((k) => [k, obj[k]])));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
