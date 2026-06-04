export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

export function sqliteConstraintError(error: unknown, fallbackCode: string, fallbackMessage: string): RequestError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("FOREIGN KEY")) {
    return new RequestError(404, "unknown_project", "Referenced project does not exist");
  }
  if (message.includes("UNIQUE")) {
    return new RequestError(409, fallbackCode, fallbackMessage);
  }
  return new RequestError(400, fallbackCode, fallbackMessage);
}
