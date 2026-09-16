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
exports.BunExecuteFileTool = exports.BunExecuteCodeTool = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tool_1 = require("./tool");
async function notInstalledResult(tool) {
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
class BunExecuteCodeTool extends tool_1.Tool {
    toolName = "bun-execute-code";
    async call(options, _token) {
        const opts = (options.input || {});
        const code = (opts.code || "").trim();
        if (!code) {
            throw new Error("Parameter 'code' is required: pass the JavaScript source to execute.");
        }
        const bun = await (0, tool_1.findBun)();
        if (!bun)
            return notInstalledResult(this.toolName);
        const tmp = path.join(os.tmpdir(), `bun-executor-${Date.now()}.js`);
        fs.writeFileSync(tmp, code, "utf8");
        try {
            const r = await (0, tool_1.shFile)(bun, [tmp], 60_000);
            return JSON.stringify({
                success: r.ok,
                exitCode: r.ok ? 0 : 1,
                stdout: r.out,
            });
        }
        finally {
            try {
                fs.unlinkSync(tmp);
            }
            catch {
                /* best effort cleanup */
            }
        }
    }
}
exports.BunExecuteCodeTool = BunExecuteCodeTool;
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
class BunExecuteFileTool extends tool_1.Tool {
    toolName = "bun-execute-file";
    async call(options, _token) {
        const opts = (options.input || {});
        let filePath = (opts.filePath || "").trim();
        if (!filePath) {
            throw new Error("Parameter 'filePath' is required: pass the path to a JS/TS file to execute.");
        }
        if (!path.isAbsolute(filePath)) {
            const ws = vscode.workspace.workspaceFolders?.[0];
            if (ws)
                filePath = path.join(ws.uri.fsPath, filePath);
        }
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const bun = await (0, tool_1.findBun)();
        if (!bun)
            return notInstalledResult(this.toolName);
        const r = await (0, tool_1.shFile)(bun, [filePath], 60_000);
        return JSON.stringify({
            success: r.ok,
            exitCode: r.ok ? 0 : 1,
            stdout: r.out,
            file: filePath,
        });
    }
}
exports.BunExecuteFileTool = BunExecuteFileTool;
//# sourceMappingURL=bunExecuteTools.js.map