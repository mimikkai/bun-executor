import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Tool, shFile, findBun } from "./tool";

interface ExecuteOptions {
  code?: string;
  filePath?: string;
}

async function notInstalledResult(tool: string): Promise<string> {
  return JSON.stringify({
    success: false,
    message: `Bun is not installed. Use the install-bun-js-runtime-toolkit tool first, then retry ${tool}.`,
  });
}

/**
 * bun-execute-code
 *
 * Executes a JavaScript/TypeScript snippet (passed inline as the `code`
 * parameter) with the Bun runtime. The snippet is written to a temp file and
 * run as a normal script; stdout/stderr is returned. Bun must be installed
 * (use install-bun-js-runtime-toolkit first if it is not).
 *
 * Input: { "code": "console.log(2 + 2)" }
 * Returns: JSON { success, exitCode, stdout }. Execution timeout is 60 seconds.
 */
export class BunExecuteCodeTool extends Tool {
  public readonly toolName = "bun-execute-code";

  protected async call(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<string> {
    const opts = (options.input || {}) as ExecuteOptions;
    const code = (opts.code || "").trim();
    if (!code) {
      throw new Error("Parameter 'code' is required: pass the JavaScript source to execute.");
    }

    const bun = await findBun();
    if (!bun) return notInstalledResult(this.toolName);

    const tmp = path.join(os.tmpdir(), `bun-executor-${Date.now()}.js`);
    fs.writeFileSync(tmp, code, "utf8");
    try {
      const r = await shFile(bun, [tmp], 60_000);
      return JSON.stringify({
        success: r.ok,
        exitCode: r.ok ? 0 : 1,
        stdout: r.out,
      });
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* best effort cleanup */
      }
    }
  }
}

/**
 * bun-execute-file
 *
 * Executes a JavaScript/TypeScript file that already exists on disk with the
 * Bun runtime. Use this when the user references a script (e.g. "run
 * src/index.ts") instead of passing inline code.
 *
 * Input: { "filePath": "src/scripts/hello.js" }
 * Relative paths are resolved against the first workspace folder.
 * Returns: JSON { success, exitCode, stdout, file }. Execution timeout is 60 seconds.
 */
export class BunExecuteFileTool extends Tool {
  public readonly toolName = "bun-execute-file";

  protected async call(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<string> {
    const opts = (options.input || {}) as ExecuteOptions;
    let filePath = (opts.filePath || "").trim();
    if (!filePath) {
      throw new Error("Parameter 'filePath' is required: pass the path to a JS/TS file to execute.");
    }

    if (!path.isAbsolute(filePath)) {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (ws) filePath = path.join(ws.uri.fsPath, filePath);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const bun = await findBun();
    if (!bun) return notInstalledResult(this.toolName);

    const r = await shFile(bun, [filePath], 60_000);
    return JSON.stringify({
      success: r.ok,
      exitCode: r.ok ? 0 : 1,
      stdout: r.out,
      file: filePath,
    });
  }
}