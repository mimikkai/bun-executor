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
exports.registerMonitor = registerMonitor;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const DOCS_URL = "https://bun.sh/docs/installation";
const REFRESH_MS = 10000;
// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
function sh(cmd, args, timeout = 5000) {
    const { promise, resolve } = Promise.withResolvers();
    (0, child_process_1.execFile)(cmd, args, { timeout, windowsHide: true }, (err, stdout) => resolve({ ok: !err, out: String(stdout || "").trim() }));
    return promise;
}
function shFile(file, args, timeout = 5000) {
    const { promise, resolve } = Promise.withResolvers();
    (0, child_process_1.execFile)(file, args, { timeout, windowsHide: true }, (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || "") + String(stderr || "") }));
    return promise;
}
// Bun's default install locations, independent of PATH. The extension host
// keeps the PATH from its own startup, so a freshly installed Bun is invisible
// to `bun --version` until reload — check the binary on disk instead.
function bunBinaryCandidates() {
    const home = os.homedir();
    return process.platform === "win32"
        ? [path.join(home, ".bun", "bin", "bun.exe")]
        : [path.join(home, ".bun", "bin", "bun"), "/usr/local/bin/bun", "/opt/bun/bin/bun"];
}
async function freshInstallPresent() {
    for (const f of bunBinaryCandidates()) {
        if (!fs.existsSync(f))
            continue;
        const r = await shFile(f, ["--version"]);
        if (r.ok && /^\d/.test(r.out.trim()))
            return { path: f, version: r.out.trim() };
    }
    return null;
}
async function detectBun() {
    const r = await sh("bun", ["--version"]);
    if (r.ok && /^\d/.test(r.out)) {
        const w = await sh("where", ["bun"], 3000);
        const p = process.platform === "win32" ? String(w.out || "").split(/\r?\n/)[0] : "";
        return { installed: true, version: r.out, path: p || "bun" };
    }
    // PATH may be stale in the extension host — fall back to disk locations.
    const fresh = await freshInstallPresent();
    if (fresh)
        return { installed: true, version: fresh.version, path: fresh.path };
    return { installed: false, version: null, path: null };
}
function listBunProcesses() {
    const { promise, resolve } = Promise.withResolvers();
    if (process.platform === "win32") {
        (0, child_process_1.execFile)("tasklist", ["/FI", "IMAGENAME eq bun.exe", "/FO", "CSV", "/NH"], { timeout: 5000, windowsHide: true }, (err, stdout) => {
            if (err)
                return resolve([]);
            const out = [];
            for (const line of String(stdout || "").split(/\r?\n/)) {
                const m = line.match(/^"([^"]*)","(\d+)"/);
                if (m && /^bun/i.test(m[1]))
                    out.push({ pid: Number(m[2]), name: m[1] });
            }
            resolve(out);
        });
    }
    else {
        (0, child_process_1.execFile)("ps", ["-eo", "pid=,etime=,comm="], { timeout: 5000 }, (err, stdout) => {
            if (err)
                return resolve([]);
            const out = [];
            for (const line of String(stdout || "").split("\n")) {
                const m = line.trim().match(/^(\d+)\s+(\S+)\s+(.*\bbun.*)$/);
                if (m)
                    out.push({ pid: Number(m[1]), name: path.basename(m[3]), time: m[2] });
            }
            resolve(out);
        });
    }
    return promise;
}
function killBunProcess(pid, refresh) {
    const cmd = process.platform === "win32" ? "taskkill" : "kill";
    const args = process.platform === "win32" ? ["/PID", String(pid), "/F"] : ["-9", String(pid)];
    (0, child_process_1.execFile)(cmd, args, { timeout: 5000, windowsHide: true }, (err) => {
        if (err) {
            void vscode.window.showErrorMessage(`Failed to kill pid ${pid}: ${err.message}`);
        }
        refresh();
    });
}
// ---------------------------------------------------------------------------
// Monitor tree view
// ---------------------------------------------------------------------------
class Node {
    type;
    label;
    desc;
    pid;
    constructor(type, label, desc, pid) {
        this.type = type;
        this.label = label;
        this.desc = desc;
        this.pid = pid;
    }
    get contextValue() {
        return this.type === "process" ? "bunProcess" : undefined;
    }
}
class BunMonitorProvider {
    bun = { installed: false, version: null, path: null };
    procs = [];
    _emitter = new vscode.EventEmitter();
    onDidChangeTreeData = this._emitter.event;
    async refreshData() {
        this.bun = await detectBun();
        this.procs = await listBunProcesses();
    }
    fire() {
        this._emitter.fire();
    }
    getTreeItem(node) {
        if (node.type === "status") {
            const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
            item.description = node.desc ?? undefined;
            item.iconPath = node.desc
                ? new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"))
                : new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
            item.tooltip = node.desc || "Bun was not found on PATH";
            return item;
        }
        if (node.type === "info") {
            const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
            item.description = node.desc ?? undefined;
            return item;
        }
        const item = new vscode.TreeItem(`pid ${node.pid}`, vscode.TreeItemCollapsibleState.None);
        item.description = node.label;
        item.iconPath = new vscode.ThemeIcon("terminal-bash");
        item.contextValue = "bunProcess";
        return item;
    }
    async getChildren() {
        await this.refreshData();
        const b = this.bun;
        const nodes = [];
        if (!b.installed) {
            // Empty tree -> viewsWelcome content (Install Bun button) is shown.
            return nodes;
        }
        nodes.push(new Node("status", `Bun ${b.version}`, b.path));
        nodes.push(new Node("info", "Processes", `${this.procs.length} running`));
        for (const p of this.procs) {
            nodes.push(new Node("process", p.name + (p.time ? ` (${p.time})` : ""), null, p.pid));
        }
        return nodes;
    }
}
// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------
function updateStatusBar(item, provider) {
    const b = provider.bun;
    if (b.installed) {
        item.text = `$(check) Bun ${b.version}`;
        item.tooltip = `Bun installed at ${b.path} — click to open the Bun Monitor`;
        item.backgroundColor = undefined;
        item.command = "bunExecutor.refreshPanel";
    }
    else {
        item.text = "$(error) Bun required";
        item.tooltip = "Bun was not found — click to install Bun";
        item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        item.command = "bunExecutor.installBun";
    }
    item.show();
}
// ---------------------------------------------------------------------------
// Installer with terminal watching + modal reload prompt
// ---------------------------------------------------------------------------
function bunInstallCommand() {
    return process.platform === "win32"
        ? 'powershell -c "irm bun.sh/install.ps1|iex"'
        : "curl -fsSL https://bun.sh/install | bash";
}
function promptModalReload(version) {
    void vscode.window
        .showInformationMessage(`Bun ${version} was installed successfully. Reload VS Code so Bun appears on PATH.`, { modal: true }, "Reload Window")
        .then((pick) => {
        if (pick === "Reload Window") {
            void vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
    });
}
async function ensureBun(refresh) {
    const info = await detectBun();
    if (info.installed) {
        void vscode.window.showInformationMessage(`Bun ${info.version} is already installed.`);
        return;
    }
    const term = vscode.window.createTerminal({ name: "Bun install" });
    term.show();
    term.sendText(bunInstallCommand(), true);
    let done = false;
    const promptReload = async () => {
        if (done)
            return;
        done = true;
        const fresh = await freshInstallPresent();
        promptModalReload(fresh ? fresh.version : "");
        refresh();
    };
    // Watch the installer terminal output for the success marker.
    // onDidWriteTerminalData is proposed API in some versions — guard access.
    const w = vscode.window;
    if (w.onDidWriteTerminalData) {
        w.onDidWriteTerminalData((e) => {
            if (e.terminal !== term)
                return;
            if (/was installed successfully/i.test(e.data))
                void promptReload();
        });
    }
    // Fallback: poll for the binary on disk (PATH-independent), 5 min cap.
    const started = Date.now();
    const timer = setInterval(async () => {
        if (done) {
            clearInterval(timer);
            return;
        }
        const fresh = await freshInstallPresent();
        if (fresh) {
            clearInterval(timer);
            void promptReload();
        }
        else if (Date.now() - started > 5 * 60 * 1000) {
            clearInterval(timer);
        }
    }, 5000);
}
// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
function registerMonitor(context) {
    const provider = new BunMonitorProvider();
    const refresh = () => {
        void provider.refreshData().then(() => {
            provider.fire();
            updateStatusBar(statusItem, provider);
        });
    };
    const tree = vscode.window.createTreeView("bunExecutor.monitor", {
        treeDataProvider: provider,
        showCollapseAll: false,
    });
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(tree, statusItem, vscode.commands.registerCommand("bunExecutor.installBun", () => ensureBun(refresh)), vscode.commands.registerCommand("bunExecutor.checkBun", async () => {
        const info = await detectBun();
        if (info.installed) {
            void vscode.window.showInformationMessage(`Bun ${info.version} found on PATH.`);
        }
        else {
            void vscode.window.showWarningMessage("Bun was not found on PATH.");
        }
        refresh();
    }), vscode.commands.registerCommand("bunExecutor.refreshPanel", refresh), vscode.commands.registerCommand("bunExecutor.openDocs", () => vscode.env.openExternal(vscode.Uri.parse(DOCS_URL))), vscode.commands.registerCommand("bunExecutor.killProcess", (node) => {
        if (node && node.type === "process" && node.pid)
            killBunProcess(node.pid, refresh);
    }));
    const refreshTimer = setInterval(refresh, REFRESH_MS);
    context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });
    // First paint.
    refresh();
    // On startup: if Bun is not installed, notify the user with an install offer.
    void provider.refreshData().then(async () => {
        updateStatusBar(statusItem, provider);
        if (!provider.bun.installed) {
            const choice = await vscode.window.showWarningMessage('"Bun" was not found on this system. Some features require Bun to execute code. Install it now?', "Install Bun", "Docs");
            if (choice === "Install Bun") {
                await ensureBun(refresh);
            }
            else if (choice === "Docs") {
                await vscode.env.openExternal(vscode.Uri.parse(DOCS_URL));
            }
        }
    });
}
//# sourceMappingURL=monitor.js.map