"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallBunTool = void 0;
const vscode = __importStar(require("vscode"));
const tool_1 = require("./tool");
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
class InstallBunTool extends tool_1.Tool {
    toolName = "install-bun-js-runtime-toolkit";
    async call(_options, _token) {
        const existing = await (0, tool_1.findBun)();
        if (existing) {
            const v = await (0, tool_1.sh)(existing, ["--version"]);
            return JSON.stringify({
                success: true,
                alreadyInstalled: true,
                bunPath: existing,
                version: v.out,
                message: `Bun ${v.out} is already installed at ${existing}. No installation needed.`,
            });
        }
        // Launch the official installer in a visible terminal.
        const installCmd = process.platform === "win32"
            ? 'powershell -c "irm bun.sh/install.ps1|iex"'
            : "curl -fsSL https://bun.sh/install | bash";
        const term = vscode.window.createTerminal({ name: "Bun install" });
        term.show();
        term.sendText(installCmd, true);
        // Wait for the binary to appear at a default install location (up to 5 min).
        const deadline = Date.now() + 5 * 60 * 1000;
        while (Date.now() < deadline && !_token.isCancellationRequested) {
            await new Promise((r) => setTimeout(r, 5000));
            const found = await (0, tool_1.findBun)();
            if (found) {
                const v = await (0, tool_1.sh)(found, ["--version"]);
                // Modal reload prompt: the installer mutates the user PATH and the
                // extension host only sees the new PATH after a window reload.
                void vscode.window
                    .showInformationMessage(`Bun ${v.out.trim()} was installed successfully. Reload VS Code so Bun appears on PATH.`, { modal: true }, "Reload Window")
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
            message: "Bun installer was started in the terminal but the binary was not detected within 5 minutes. Check the 'Bun install' terminal for errors, then re-run this tool or reload the window.",
        });
    }
}
exports.InstallBunTool = InstallBunTool;
//# sourceMappingURL=installBunTool.js.map