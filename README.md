# bun-executor

Bun Executor for VS Code / Copilot Chat.

- **Install Bun** — one command (`Bun: Install Bun`) runs the official bun.sh installer in a visible terminal (PowerShell on Windows, curl|bash elsewhere) and offers a window reload so Bun lands on PATH.
- **Bun Monitor panel** — dedicated activity-bar view showing:
  - Bun version and executable path (or "Bun not found" with an install action)
  - running `bun` processes (polled every 10 s)
  - right-click → kill a process

## Commands

| Command | Description |
|---|---|
| `Bun: Install Bun` | Run the official installer |
| `Bun: Re-check Bun installation` | Re-run `bun --version` |
| `Bun: Refresh monitor panel` | Refresh the monitor view |
| `Bun: Kill process` | Kill a monitored Bun process |
| `Bun: Open installation docs` | Open bun.sh docs |

## Releases

GitHub Actions builds a VSIX on every push to `main` and publishes it under
[Releases](https://github.com/mimikkai/bun-executor/releases). Tag format:
`v{version}` for releases, `v{version}-main.{YYmmddHHMM}` for intermediate
builds when `package.json` version is unchanged.

## Install from VSIX

```
code --install-extension mimikkai-bun-executor-<ver>.vsix
```