export const number = (n: number, digits = 0) => new Intl.NumberFormat("en-CA", { maximumFractionDigits: digits }).format(n);
export const date = (value: string, year = false) => new Date(value.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", ...(year ? { year: "numeric" as const } : {}), timeZone: "UTC" });
export function download(filename: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (x: unknown) => `"${String(x ?? "").replaceAll('"', '""')}"`;
  return [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(escape).join(",")).join("\r\n");
}
