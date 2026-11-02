import { randomUUID } from "node:crypto";
export function logFailure(event: string, error: unknown) {
  const requestId = randomUUID();
  const detail =
    error && typeof error === "object"
      ? (error as { name?: string; code?: unknown })
      : {};
  console.error(
    JSON.stringify({
      level: "error",
      event,
      requestId,
      time: new Date().toISOString(),
      errorType: detail.name ?? "UnknownError",
      ...(typeof detail.code === "string" ? { code: detail.code } : {}),
    }),
  );
  return requestId;
}
