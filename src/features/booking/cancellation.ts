/**
 * Whether a client may still cancel/reschedule their own appointment via the
 * public self-service link, given the business's free-cancellation window.
 *
 * Pure function (no I/O) so it can be unit-tested and reused on client & server.
 * - A past/in-progress appointment can never be modified by the client.
 * - windowHours <= 0 means "no restriction" (any future time is allowed).
 */
export function canModifyByClient(nowMs: number, startAtMs: number, windowHours: number): boolean {
  if (startAtMs <= nowMs) return false;
  if (windowHours <= 0) return true;
  return startAtMs - nowMs >= windowHours * 60 * 60 * 1000;
}
