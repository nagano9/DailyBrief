import http from "node:http";
import https from "node:https";

/**
 * End a run without hanging and without crashing.
 *
 * Two failure modes, and the naive fix for one causes the other.
 *
 * Leaving the process to exit on its own hangs: keep-alive sockets from
 * `http.globalAgent` and undici hold the event loop open for minutes after
 * the work is done, and stdout buffered to a pipe never flushes — a run that
 * finished in twelve seconds looks like it froze.
 *
 * Calling `process.exit()` instead crashed on Windows:
 *
 *   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c
 *
 * because exit raced libuv tearing those same handles down. That aborted the
 * process *after* the edition was written, which broke the publish chain: the
 * site never built even though the compose step had succeeded.
 *
 * So close the sockets first and let the loop drain naturally, with an
 * unref'd timer as a backstop. Unref'd matters: it cannot delay a clean exit,
 * but it still fires if some other handle is keeping the process alive — the
 * one case where forcing an exit is the right answer.
 */

const FORCE_EXIT_AFTER_MS = Number(process.env.BRIEF_FORCE_EXIT_MS ?? 5000);

function closeUndici(): Promise<void> {
  // Node bundles undici and stashes its dispatcher on a well-known symbol.
  // Absent or differently-shaped in another runtime, hence the guards.
  const dispatcher = (globalThis as Record<symbol, unknown>)[
    Symbol.for("undici.globalDispatcher.1")
  ] as { close?: () => Promise<void> } | undefined;
  if (typeof dispatcher?.close !== "function") return Promise.resolve();
  return dispatcher.close().catch(() => {
    // A dispatcher that will not close is not a reason to fail a run that
    // already produced its output.
  });
}

export async function finish(code = 0): Promise<void> {
  process.exitCode = code;
  http.globalAgent.destroy();
  https.globalAgent.destroy();
  await closeUndici();
  setTimeout(() => process.exit(code), FORCE_EXIT_AFTER_MS).unref();
}
