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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const installBunTool_1 = require("./installBunTool");
const bunExecuteTools_1 = require("./bunExecuteTools");
const bunInstallPackageTool_1 = require("./bunInstallPackageTool");
const monitor_1 = require("./monitor");
function activate(context) {
    // Monitor panel + status bar + commands (port of the original extension.js).
    (0, monitor_1.registerMonitor)(context);
    // Language-model tools, registered through the tool provider pattern
    // (vscode.lm.registerTool) so they surface as MCP tools in Copilot Chat.
    const tools = [
        new installBunTool_1.InstallBunTool(),
        new bunExecuteTools_1.BunExecuteCodeTool(),
        new bunExecuteTools_1.BunExecuteFileTool(),
        new bunInstallPackageTool_1.BunInstallPackageTool(),
    ];
    for (const tool of tools) {
        context.subscriptions.push(vscode.lm.registerTool(tool.toolName, tool));
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map