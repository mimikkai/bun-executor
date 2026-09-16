import * as vscode from "vscode";
import { Tool, sh, findBun } from "./tool";
/**
 * install-bun-js-runtime-toolkit
 *
 * Language-model tool that installs the Bun JavaScript runtime on the user's
 * machine. It runs the official bun.sh installer in a visible VS Code
 * terminal, then watches for completion (terminal success marker or the
 * binary appearing at its default install location) and prompts the user to
 * reload the window so the updated PATH is picked up.
 *
 * Takes no parameters. If Bun is already installed, reports the version.
 */
export class InstallBunTool extends Tool {
  public readonly toolName = "install-bun-js-runtime-toolkit";

  protected async call(
    _options: vscode.LanguageModelToolInvocationOptions<object>,
    _token: vscode.CancellationToken
  ): Promise<string> {
    const existing = await findBun();
    if (existing) {
      const v = await sh(existing, ["--version"]);
      return JSON.stringify({
        success: true,
        alreadyInstalled: true,
        bunPath: existing,
        version: v.out,
        message: `Bun ${v.out} is already installed at ${existing}. No installation needed.`,
      });
    }

    // Launch the official installer in a visible terminal.
    const installCmd =
      process.platform === "win32"
        ? 'powershell -c "irm bun.sh/install.ps1|iex"'
        : "curl -fsSL https://bun.sh/install | bash";
    const term = vscode.window.createTerminal({ name: "Bun install" });
    term.show();
    term.sendText(installCmd, true);

    // Wait for the binary to appear at a default install location (up to 5 min).
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline && !_token.isCancellationRequested) {
      await new Promise((r) => setTimeout(r, 5000));
      const found = await findBun();
      if (found) {
        const v = await sh(found, ["--version"]);
        // Modal reload prompt: the installer mutates the user PATH and the
        // extension host only sees the new PATH after a window reload.
        void vscode.window
          .showInformationMessage(
            `Bun ${v.out.trim()} was installed successfully. Reload VS Code so Bun appears on PATH.`,
            { modal: true },
            "Reload Window"
          )
          .then((pick) => {
            if (pick === "Reload Window") {
              void vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          });
        return JSON.stringify({
          success: true,
          alreadyInstalled: false,
          bunPath: found,
          version: v.out.trim(),
          message: `Bun ${v.out.trim()} was installed successfully at ${found}. A window reload was offered to refresh PATH.`,
        });
      }
    }
    return JSON.stringify({
      success: false,
      message:
        "Bun installer was started in the terminal but the binary was not detected within 5 minutes. Check the 'Bun install' terminal for errors, then re-run this tool or reload the window.",
    });
  }
}