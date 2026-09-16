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
exports.Tool = void 0;
exports.sh = sh;
exports.shFile = shFile;
exports.bunBinaryCandidates = bunBinaryCandidates;
exports.findBun = findBun;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/**
 * Base class for all language-model tools, following the
 * vscode-extension-and-mcp-together pattern: invoke() wraps call() and
 * converts the string result into a LanguageModelToolResult, catching errors
 * into a JSON { isError, message } payload the model can read.
 */
class Tool {
    async invoke(options, token) {
        try {
            const response = await this.call(options, token);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(response),
            ]);
        }
        catch (error) {
            const errorPayload = {
                isError: true,
                message: error instanceof Error ? error.message : String(error),
            };
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(JSON.stringify(errorPayload)),
            ]);
        }
    }
    async prepareInvocation(_options, _token) {
        return {};
    }
}
exports.Tool = Tool;
// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function sh(cmd, args, timeout = 5000) {
    const { promise, resolve } = Promise.withResolvers();
    (0, child_process_1.execFile)(cmd, args, { timeout, windowsHide: true }, (err, stdout) => resolve({ ok: !err, out: String(stdout || "").trim() }));
    return promise;
}
/** Run a binary at an explicit path (PATH-independent), optionally in cwd. */
function shFile(file, args, timeout = 30000, cwd) {
    const { promise, resolve } = Promise.withResolvers();
    (0, child_process_1.execFile)(file, args, { timeout, windowsHide: true, cwd }, (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || "") + String(stderr || "") }));
    return promise;
}
function bunBinaryCandidates() {
    const home = os.homedir();
    return process.platform === "win32"
        ? [path.join(home, ".bun", "bin", "bun.exe")]
        : [path.join(home, ".bun", "bin", "bun"), "/usr/local/bin/bun", "/opt/bun/bin/bun"];
}
/** Locate a runnable bun binary: PATH first, then default install locations. */
async function findBun() {
    const r = await sh("bun", ["--version"]);
    if (r.ok && /^\d/.test(r.out))
        return "bun";
    for (const f of bunBinaryCandidates()) {
        if (!fs.existsSync(f))
            continue;
        const v = await shFile(f, ["--version"], 5000);
        if (v.ok && /^\d/.test(v.out.trim()))
            return f;
    }
    return null;
}
//# sourceMappingURL=tool.js.map