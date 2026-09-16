import * as vscode from "vscode";
import * as path from "path";
import { Tool, shFile, findBun } from "./tool";

interface InstallOptions {
  packages?: string;
  cwd?: string;
}

/**
 * bun-install-package
 *
 * Runs `bun install` / `bun add <packages>` in a workspace folder and returns
 * the command output. Requires Bun to be installed (use
 * install-bun-js-runtime-toolkit first if it is not).
 *
 * Input:
 * - { "packages": "lodash dayjs" }            -> bun add lodash dayjs
 * - { "packages": "" } or omitted             -> bun install (from package.json)
 * - { "cwd": "subdir" }                       -> run in that workspace-relative dir
 * Returns: JSON { success, exitCode, output, command, cwd }.
 */
export class BunInstallPackageTool extends Tool {
  public readonly toolName = "bun-install-package";

  protected async call(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<string> {
    const opts = (options.input || {}) as InstallOptions;

    // Resolve working directory: 'cwd' param (relative to workspace) or the
    // first workspace folder.
    let cwd = (opts.cwd || "").trim();
    if (cwd && !path.isAbsolute(cwd)) {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (ws) cwd = path.join(ws.uri.fsPath, cwd);
    }
    if (!cwd) {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        throw new Error(
          "No workspace folder is open. Open a project folder or pass an absolute 'cwd'."
        );
      }
      cwd = ws.uri.fsPath;
    }

    const bun = await findBun();
    if (!bun) {
      return JSON.stringify({
        success: false,
        message:
          "Bun is not installed. Use the install-bun-js-runtime-toolkit tool first, then retry bun-install-package.",
      });
    }

    const packages = (opts.packages || "").trim();
    const args = packages ? ["add", ...packages.split(/\s+/)] : ["install"];
    const r = await shFile(bun, args, 300_000, cwd);
    return JSON.stringify({
      success: r.ok,
      exitCode: r.ok ? 0 : 1,
      output: r.out,
      command: `bun ${args.join(" ")}`,
      cwd,
    });
  }
}
