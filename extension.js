const vscode = require('vscode');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DOCS_URL = 'https://bun.sh/docs/installation';

// ---------------------------------------------------------------------------
// Bun detection & install (ported from mimikkai-smeta-agent)
// ---------------------------------------------------------------------------

function sh(cmd, args, timeout = 5000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) =>
      resolve({ ok: !err, out: String(stdout || '').trim() })
    );
  });
}

const fs = require('fs');

// Bun's default install locations, independent of PATH. The extension host
// keeps the PATH from its own startup, so a freshly installed Bun is invisible
// to `bun --version` until reload — check the binary on disk instead.
function bunBinaryCandidates() {
  const home = os.homedir();
  return process.platform === 'win32'
    ? [path.join(home, '.bun', 'bin', 'bun.exe')]
    : [path.join(home, '.bun', 'bin', 'bun'), '/usr/local/bin/bun', '/opt/bun/bin/bun'];
}

// Version by running the binary at an explicit path (no PATH needed).
function shFile(file, args, timeout = 5000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, windowsHide: true }, (err, stdout) =>
      resolve({ ok: !err, out: String(stdout || '').trim() })
    );
  });
}

// True once any candidate binary exists and runs.
async function freshInstallPresent() {
  for (const f of bunBinaryCandidates()) {
    if (!fs.existsSync(f)) continue;
    const r = await shFile(f, ['--version']);
    if (r.ok && /^\d/.test(r.out)) return { path: f, version: r.out };
  }
  return null;
}
async function detectBun() {
  const r = await sh('bun', ['--version']);
  if (r.ok && /^\d/.test(r.out)) {
    const w = await sh('where', ['bun'], 3000);
    const p = process.platform === 'win32' ? String(w.out || '').split(/\r?\n/)[0] : '';
    return { installed: true, version: r.out, path: p || 'bun' };
  }
  // PATH may be stale in the extension host — fall back to disk locations.
  const fresh = await freshInstallPresent();
  if (fresh) return { installed: true, version: fresh.version, path: fresh.path };
  return { installed: false, version: null, path: null };
}

function bunInstallCommand() {
  return process.platform === 'win32'
    ? 'powershell -c "irm bun.sh/install.ps1|iex"'
    : 'curl -fsSL https://bun.sh/install | bash';
}

// Run the installer in a visible terminal and WATCH that terminal: as soon as
// its output contains the installer's success line ("Bun X.Y.Z was installed
// successfully!"), show a MODAL (centered) reload prompt.
function runBunInstaller() {
  // Pseudo-terminal so shellIntegration output events are available where the
  // API supports it; plain terminal otherwise falls back to onDidCloseTerminal.
  const term = vscode.window.createTerminal({ name: 'Bun install' });
  term.show();
  term.sendText(bunInstallCommand(), true);

  let done = false;
  const promptReload = async () => {
    if (done) return;
    done = true;
    const info = await detectBun();
    const version = info.installed ? info.version : '';
    const pick = await vscode.window.showInformationMessage(
      `Bun ${version} was installed successfully. Reload VS Code so Bun appears on PATH.`.replace('  ', ' '),
      { modal: true },
      'Reload Window'
    );
    if (pick === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  };

  const dataSub = vscode.window.onDidWriteTerminalData
    ? vscode.window.onDidWriteTerminalData((e) => {
        if (e.terminal !== term) return;
        if (/was installed successfully/i.test(e.data)) void promptReload();
      })
    : null;

  // Fallback/backup: when the terminal is closed (user exits installer) or the
  // process ends, check once more — maybe it finished without the marker.
  const closeSub = vscode.window.onDidCloseTerminal(async (t) => {
    if (t !== term || done) return;
    const fresh = await freshInstallPresent();
    if (fresh) void promptReload();
  });

  // Safety net: also poll on disk in case output events are unavailable.
  const started = Date.now();
  const timer = setInterval(async () => {
    if (done) { clearInterval(timer); return; }
    const fresh = await freshInstallPresent();
    if (fresh) {
      clearInterval(timer);
      void promptReload();
    } else if (Date.now() - started > 5 * 60 * 1000) {
      clearInterval(timer);
    }
  }, 5000);
}

// Called from the welcome button / panel button / command palette: starts the
// official installer immediately — no extra confirmation dialog. If Bun is
// already present, the user just gets a notification.
async function ensureBun() {
  const info = await detectBun();
  if (info.installed) {
    void vscode.window.showInformationMessage(`Bun ${info.version} is already installed.`);
    return;
  }
  runBunInstaller();
}

// ---------------------------------------------------------------------------
// Bun process monitoring: `bun` processes on this machine.
//   win32  -> tasklist /FI "IMAGENAME eq bun.exe" /FO CSV /NH
//   else   -> ps -eo pid,etime,comm | grep bun
// ---------------------------------------------------------------------------

function listBunProcesses() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile(
        'tasklist',
        ['/FI', 'IMAGENAME eq bun.exe', '/FO', 'CSV', '/NH'],
        { timeout: 5000, windowsHide: true },
        (err, stdout) => {
          if (err) return resolve([]);
          const out = [];
          for (const line of String(stdout || '').split(/\r?\n/)) {
            const m = line.match(/^"([^"]*)","(\d+)"/);
            if (m && /^bun/i.test(m[1])) out.push({ pid: Number(m[2]), name: m[1] });
          }
          resolve(out);
        }
      );
    } else {
      execFile('ps', ['-eo', 'pid=,etime=,comm='], { timeout: 5000 }, (err, stdout) => {
        if (err) return resolve([]);
        const out = [];
        for (const line of String(stdout || '').split('\n')) {
          const m = line.trim().match(/^(\d+)\s+(\S+)\s+(.*\bbun.*)$/);
          if (m) out.push({ pid: Number(m[1]), name: path.basename(m[3]), time: m[2] });
        }
        resolve(out);
      });
    }
  });
}

function killBunProcess(pid) {
  const cmd = process.platform === 'win32' ? 'taskkill' : 'kill';
  const args = process.platform === 'win32' ? ['/PID', String(pid), '/F'] : ['-9', String(pid)];
  execFile(cmd, args, { timeout: 5000, windowsHide: true }, (err) => {
    if (err) {
      void vscode.window.showErrorMessage(`Failed to kill pid ${pid}: ${err.message}`);
    }
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Monitor tree view
// ---------------------------------------------------------------------------

const REFRESH_MS = 10000;

let treeProvider;
let refreshTimer;

class Node {
  constructor(type, label, desc, item) {
    this.type = type;
    this.label = label;
    this.desc = desc;
    this.item = item; // pid for process nodes
  }
  get contextValue() {
    return this.type === 'process' ? 'bunProcess' : undefined;
  }
}

class BunMonitorProvider {
  constructor() {
    this.bun = { installed: false };
  }

  async refreshData() {
    this.bun = await detectBun();
    this.procs = await listBunProcesses();
  }

  getTreeItem(node) {
    if (node.type === 'status') {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.desc;
      item.iconPath = node.desc
        ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
        : new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
      item.tooltip = node.desc || 'Bun was not found on PATH';
      item.command = node.desc
        ? { command: 'bunExecutor.refreshPanel', title: 'Refresh' }
        : { command: 'bunExecutor.installBun', title: 'Install Bun' };
      return item;
    }
    if (node.type === 'info') {
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.description = node.desc;
      return item;
    }
    const item = new vscode.TreeItem(`pid ${node.item}`, vscode.TreeItemCollapsibleState.None);
    item.description = node.label;
    item.iconPath = new vscode.ThemeIcon('terminal-bash');
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
    nodes.push(new Node('status', `Bun ${b.version}`, b.path));
    nodes.push(new Node('info', 'Processes', `${this.procs.length} running`));
    for (const p of this.procs) {
      nodes.push(new Node('process', p.name + (p.time ? ` (${p.time})` : ''), null, p.pid));
    }
    return nodes;
  }
}

function refresh() {
  treeProvider.refreshData().then(() => emitter.fire());
}

// Minimal emitter shared with the provider instance.
const emitter = new vscode.EventEmitter();
BunMonitorProvider.prototype.onDidChangeTreeData = emitter.event;

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function activate(context) {
  treeProvider = new BunMonitorProvider();

  const tree = vscode.window.createTreeView('bunExecutor.monitor', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  context.subscriptions.push(
    tree,
    emitter,
    vscode.commands.registerCommand('bunExecutor.installBun', ensureBun),
    vscode.commands.registerCommand('bunExecutor.checkBun', async () => {
      const info = await detectBun();
      if (info.installed) {
        void vscode.window.showInformationMessage(`Bun ${info.version} found on PATH.`);
      } else {
        void vscode.window.showWarningMessage('Bun was not found on PATH.');
      }
      refresh();
    }),
    vscode.commands.registerCommand('bunExecutor.refreshPanel', refresh),
    vscode.commands.registerCommand('bunExecutor.openDocs', () =>
      vscode.env.openExternal(vscode.Uri.parse(DOCS_URL))
    ),
    vscode.commands.registerCommand('bunExecutor.killProcess', (node) => {
      if (node && node.type === 'process') killBunProcess(node.item);
    })
  );

  // Periodic polling: version + process list.
  refreshTimer = setInterval(refresh, REFRESH_MS);
  context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });

  // First paint.
  refresh();
}

function deactivate() {}

module.exports = { activate, deactivate };