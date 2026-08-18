import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { classifyError, logLlmCall } from "../log";
import type { LlmRunOptions, LlmRunResult } from "../llm";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL?.trim() || "sonnet";

/**
 * Locate the `claude` executable.
 *
 * The previous implementation returned `%APPDATA%\npm\claude.cmd`
 * unconditionally on Windows, which is only correct for an npm global
 * install. The native installer puts `claude.exe` under
 * `%USERPROFILE%\.local\bin`, so that guess produced a path that does not
 * exist and the CLI failed with "The system cannot find the path
 * specified" — before any API call, with no hint about the cause.
 *
 * Candidates are now probed for existence and PATH is the final fallback,
 * which is what works when the install location is neither of the two.
 */
function resolveCliPath(): string {
  const override = process.env.CLAUDE_CLI_PATH?.trim();
  if (override) return override;

  const home = process.env.USERPROFILE || process.env.HOME;
  const candidates = [
    process.env.APPDATA && path.join(process.env.APPDATA, "npm", "claude.cmd"),
    home && path.join(home, ".local", "bin", "claude.exe"),
    home && path.join(home, ".local", "bin", "claude"),
  ].filter((p): p is string => !!p);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // spawn runs with shell:true, so a bare name resolves through PATH
  // (including PATHEXT on Windows).
  return "claude";
}

/**
 * Invoke the local `claude` CLI in print mode against the Max subscription.
 * Writes the user prompt over stdin to bypass shell argument length limits.
 *
 * stderr is logged as warnings but not thrown — plugins like claude-mem
 * sometimes emit non-fatal hook errors on stderr that the CLI itself
 * still completes around.
 */
export function runClaudeCli({
  systemPrompt,
  userPrompt,
  timeoutMs = 180_000,
}: LlmRunOptions): Promise<LlmRunResult> {
  const cli = resolveCliPath();
  const args = [
    "--print",
    "--model",
    CLAUDE_MODEL,
    "--append-system-prompt",
    systemPrompt,
  ];
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      const success = err === null;
      logLlmCall({
        ts: new Date(started).toISOString(),
        backend: "claude-cli",
        model: CLAUDE_MODEL,
        durationMs,
        success,
        inputChars: systemPrompt.length + userPrompt.length,
        outputChars: stdout.length,
        errorCategory: success
          ? null
          : classifyError(`${stderr}\n${err?.message ?? ""}`),
        errorSnippet:
          !success && stderr.trim() ? stderr.trim().slice(0, 200) : null,
      });
      if (err) reject(err);
      else resolve({ text: stdout.trim(), durationMs });
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`claude CLI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => finish(err));
    child.on("close", (code) => {
      if (stderr.trim()) {
        console.warn(`[claude-cli] stderr (non-fatal): ${stderr.trim()}`);
      }
      if (code !== 0 && !stdout.trim()) {
        finish(new Error(`claude CLI exited ${code} with empty stdout`));
        return;
      }
      finish(null);
    });

    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}
