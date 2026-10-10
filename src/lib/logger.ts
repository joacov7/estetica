import "server-only";

/**
 * Minimal structured logger. Writes one JSON line per event to stdout/stderr,
 * which Vercel captures in its logs. Centralizing it here means we can later
 * forward to Sentry/Logtail by changing only this file. Never throws, and never
 * logs secrets or full PII — pass only safe context.
 */
type Level = "error" | "warn" | "info";

function emit(level: Level, event: string, data: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  emit("error", event, { message, ...(code ? { code } : {}), ...context });
}

export function logWarn(event: string, context: Record<string, unknown> = {}) {
  emit("warn", event, context);
}

export function logInfo(event: string, context: Record<string, unknown> = {}) {
  emit("info", event, context);
}
