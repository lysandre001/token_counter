// Minimal CSV parser (RFC4180-ish) for simple data tables.
// Supports quoted fields, escaped quotes, and CRLF/LF newlines.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }

      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }

    if (ch === "\r") {
      // Handle CRLF or lone CR
      const next = text[i + 1];
      if (next === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    field += ch;
    i += 1;
  }

  // Final field
  row.push(field);
  // Avoid adding a trailing empty row when file ends with newline
  const isTrailingEmptyRow = row.length === 1 && row[0] === "" && rows.length > 0;
  if (!isTrailingEmptyRow) rows.push(row);

  return rows;
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.every((v) => (v ?? "").trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j += 1) {
      obj[header[j]] = (r[j] ?? "").trim();
    }
    out.push(obj);
  }

  return out;
}
