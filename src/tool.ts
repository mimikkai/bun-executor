import * as vscode from "vscode";

/**
 * Base class for all language-model tools, following the
 * vscode-extension-and-mcp-together pattern: invoke() wraps call() and
 * converts the string result into a LanguageModelToolResult, catching errors
 * into a JSON { isError, message } payload the model can read.
 */
export abstract class Tool implements vscode.LanguageModelTool<object> {
  abstract toolName: string;

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const response = await this.call(options, token);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(response),
      ]);
    } catch (error) {
      const errorPayload = {
        isError: true,
        message: error instanceof Error ? error.message : String(error),
      };
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(errorPayload)),
      ]);
    }
  }

  protected abstract call(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<string>;

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Shared helpers (mirror extension.js logic)
// ---------------------------------------------------------------------------

import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function sh(cmd: string, args: string[], timeout = 5000): Promise<{ ok: boolean; out: string }> {
  const { promise, resolve } = Promise.withResolvers<{ ok: boolean; out: string }>();
  execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) =>
    resolve({ ok: !err, out: String(stdout || "").trim() })
  );
  return promise;
}

/** Run a binary at an explicit path (PATH-independent). */
export function shFile(file: string, args: string[], timeout = 30000): Promise<{ ok: boolean; out: string }> {
  const { promise, resolve } = Promise.withResolvers<{ ok: boolean; out: string }>();
  execFile(file, args, { timeout, windowsHide: true }, (err, stdout, stderr) =>
    resolve({ ok: !err, out: String(stdout || "") + String(stderr || "") })
  );
  return promise;
}

export function bunBinaryCandidates(): string[] {
  const home = os.homedir();
  return process.platform === "win32"
    ? [path.join(home, ".bun", "bin", "bun.exe")]
    : [path.join(home, ".bun", "bin", "bun"), "/usr/local/bin/bun", "/opt/bun/bin/bun"];
}

/** Locate a runnable bun binary: PATH first, then default install locations. */
export async function findBun(): Promise<string | null> {
  const r = await sh("bun", ["--version"]);
  if (r.ok && /^\d/.test(r.out)) return "bun";
  for (const f of bunBinaryCandidates()) {
    if (!fs.existsSync(f)) continue;
    const v = await shFile(f, ["--version"], 5000);
    if (v.ok && /^\d/.test(v.out.trim())) return f;
  }
  return null;
}