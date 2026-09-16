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
exports.BunInstallPackageTool = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const tool_1 = require("./tool");
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
class BunInstallPackageTool extends tool_1.Tool {
    toolName = "bun-install-package";
    async call(options, _token) {
        const opts = (options.input || {});
        // Resolve working directory: 'cwd' param (relative to workspace) or the
        // first workspace folder.
        let cwd = (opts.cwd || "").trim();
        if (cwd && !path.isAbsolute(cwd)) {
            const ws = vscode.workspace.workspaceFolders?.[0];
            if (ws)
                cwd = path.join(ws.uri.fsPath, cwd);
        }
        if (!cwd) {
            const ws = vscode.workspace.workspaceFolders?.[0];
            if (!ws) {
                throw new Error("No workspace folder is open. Open a project folder or pass an absolute 'cwd'.");
            }
            cwd = ws.uri.fsPath;
        }
        const bun = await (0, tool_1.findBun)();
        if (!bun) {
            return JSON.stringify({
                success: false,
                message: "Bun is not installed. Use the install-bun-js-runtime-toolkit tool first, then retry bun-install-package.",
            });
        }
        const packages = (opts.packages || "").trim();
        const args = packages ? ["add", ...packages.split(/\s+/)] : ["install"];
        const r = await (0, tool_1.shFile)(bun, args, 300_000, cwd);
        return JSON.stringify({
            success: r.ok,
            exitCode: r.ok ? 0 : 1,
            output: r.out,
            command: `bun ${args.join(" ")}`,
            cwd,
        });
    }
}
exports.BunInstallPackageTool = BunInstallPackageTool;
//# sourceMappingURL=bunInstallPackageTool.js.map