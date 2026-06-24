/**
 * Translate SQLite-style positional placeholders (`?`) to Postgres (`$1`, `$2`, …).
 *
 * The entire store layer was written against `node:sqlite`, which uses `?`.
 * Rather than rewrite all 200+ query strings, the async Postgres drivers run
 * every SQL string through this translator at prepare-time. Question marks
 * inside single- or double-quoted string literals are left untouched.
 */
export function toPgPlaceholders(sql: string): string {
  let out = "";
  let index = 0;
  let counter = 0;
  let inSingle = false;
  let inDouble = false;

  while (index < sql.length) {
    const ch = sql[index];

    if (inSingle) {
      out += ch;
      if (ch === "'") {
        // Handle the SQL escaped-quote form '' inside a string literal.
        if (sql[index + 1] === "'") {
          out += "'";
          index += 2;
          continue;
        }
        inSingle = false;
      }
      index += 1;
      continue;
    }

    if (inDouble) {
      out += ch;
      if (ch === '"') inDouble = false;
      index += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
      index += 1;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      index += 1;
      continue;
    }
    if (ch === "?") {
      counter += 1;
      out += `$${counter}`;
      index += 1;
      continue;
    }

    out += ch;
    index += 1;
  }

  return out;
}
