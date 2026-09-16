import * as vscode from "vscode";
import { InstallBunTool } from "./installBunTool";
import { BunExecuteCodeTool, BunExecuteFileTool } from "./bunExecuteTools";
import { BunInstallPackageTool } from "./bunInstallPackageTool";
import { registerMonitor } from "./monitor";

export function activate(context: vscode.ExtensionContext) {
  // Monitor panel + status bar + commands (port of the original extension.js).
  registerMonitor(context);

  // Language-model tools, registered through the tool provider pattern
  // (vscode.lm.registerTool) so they surface as MCP tools in Copilot Chat.
  const tools = [
    new InstallBunTool(),
    new BunExecuteCodeTool(),
    new BunExecuteFileTool(),
    new BunInstallPackageTool(),
  ];
  for (const tool of tools) {
    context.subscriptions.push(vscode.lm.registerTool(tool.toolName, tool));
  }
}

export function deactivate() {}