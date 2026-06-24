export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

export function sqliteConstraintError(error: unknown, fallbackCode: string, fallbackMessage: string): RequestError {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

  // Postgres: 23503 = foreign_key_violation, 23505 = unique_violation.
  // Keep the SQLite text checks as a fallback for any non-PG path.
  const isForeignKey = code === "23503" || message.includes("FOREIGN KEY") || message.toLowerCase().includes("foreign key");
  const isUnique = code === "23505" || message.includes("UNIQUE") || message.toLowerCase().includes("duplicate key");

  if (isForeignKey) {
    return new RequestError(404, "unknown_project", "Referenced project does not exist");
  }
  if (isUnique) {
    return new RequestError(409, fallbackCode, fallbackMessage);
  }
  return new RequestError(400, fallbackCode, fallbackMessage);
}
