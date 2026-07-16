// Conversion between DB snake_case rows and API camelCase objects.
// Repositories own this boundary (AGENTS.md §5): rows leave repositories in
// camelCase; update payloads enter the DB in snake_case. Conversion is
// shallow by design — values (Dates, JSON columns, nested objects) pass
// through untouched.

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) =>
    char.toUpperCase()
  );
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function toCamelRow<T extends object = Record<string, unknown>>(
  row: object
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value;
  }
  return out as T;
}

export function toCamelRows<T extends object = Record<string, unknown>>(
  rows: object[]
): T[] {
  return rows.map((row) => toCamelRow<T>(row));
}

export function toSnakeRow(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[camelToSnake(key)] = value;
  }
  return out;
}
