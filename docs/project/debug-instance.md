# Independent debug Desktop

The personal fork has a separate macOS development instance. The installed Host and Codex Desktop remain the daily environment. A debug build does not overwrite a running build or restart either instance.

## Commands

Run from the repository after `npm run fork:bootstrap` and dependency installation:

```sh
npm run debug:check
npm run debug:build
npm run debug:start
npm run debug:status
npm run debug:restart
npm run debug:stop
```

`npm run debug` builds and then restarts only the debug instance. `debug:restart` reuses the latest debug snapshot; it does not build. Repeating `debug:start` while debug is running fails without stopping anything. Stopping or restarting debug interrupts its own active tasks, so keep daily work in the stable instance.

## Build and state ownership

Debug builds use the same release payload packaging and pinned compiler/runtime as `fork:build`, with development lifecycle isolation rather than Rust's unoptimized compiler profile. Uncommitted source is allowed. Each snapshot records the Git commit, a content digest including untracked source, dirty status, and an inventory of runtime files. Changes during a build abort publication. Debug and stable builds share one build lock, but use separate output directories and latest-build pointers.

Snapshots live in `.codexhost/debug-builds/`. A running instance continues using its immutable snapshot when another build finishes. The persistent profile is `.codexhost/debug-instance/`:

| Directory | Owned state |
| --- | --- |
| `app/ChatGPT.app` | An APFS copy of the official signed Desktop, created on first setup and reused |
| `electron/` | Electron and Chromium profile |
| `codex/` | Codex configuration, SQLite state, task history and logs |
| `host/` | Host stores, plugins, startup lock, runtime descriptor and process identity |
| `claude/` | Native Claude configuration and transcripts |
| `broker/` | Reserved independent broker descriptor/socket namespace |
| `workspace/` | Scratch directory for development acceptance |
| `logs/` | Native launcher startup logs |

The official app copy retains its bundle identifier and signature. Setup and launch verify its signature; no bundle patching or re-signing is performed. Its separate executable path lets native process supervision distinguish it from the daily app. The debug launcher requires private, canonical instance directories and a real app copy, rejects an already running copy, and never enters the stable launcher's attach/recovery branch. Shutdown validates the recorded executable, PID, and process start time before signalling that single Desktop root. Its owner cleans up the controller and observed descendants. Detached Electron crash reporters are cleaned only within the private app copy's executable namespace, with the same process identity checks. Host installer updates are disabled for this lifecycle.

The first setup copies a file-based Codex login, if present, into the private profile. It does not link live credentials or copy task databases, plugins or production configuration. The real macOS home is unchanged. Account quotas, Keychain, permissions and external applications remain shared OS resources.

Claude keeps its configuration and transcripts under the private `claude/` directory but reuses the user's existing login through `CLAUDE_SECURESTORAGE_CONFIG_DIR=""`. The empty value selects the default macOS Keychain entry (and default file fallback), independently of `CLAUDE_CONFIG_DIR`. Setting this to an explicit `~/.claude` path would select a different hashed Keychain entry. The override is forwarded through the native LaunchServices environment, including its empty value. No Claude tokens are copied or exported. Login, logout and credential refresh operate on the shared credential store, while task history and settings stay separate.

If the daily Claude login uses a custom credential namespace, set `CLAUDE_SECURESTORAGE_CONFIG_DIR` to that exact directory string when running `debug:start` or `debug:restart`; an explicit value is preserved. This native Claude behavior was verified with Claude Code 2.1.274. The variable is currently undocumented in the official environment-variable reference, so recheck `claude auth status --json` and a real model turn after CLI upgrades. No login can be reused if the selected store itself is logged out.

Local Claude uses the existing native adapter owned by the debug Host. It does not use or install the remote Aqua LaunchAgent broker, and broker management commands reject the debug environment. Instance broker paths are available for explicitly configured broker tests, and inherited Host task identities and remote routing variables are removed from the development launch environment. Debug skips the Host's automatic user-wide delegation skill installation, so a candidate version cannot replace skills used by stable tasks.

Computer Use acts on the same macOS desktop in both instances. Do not run conflicting mouse/keyboard automation concurrently. Native tools and IAB require their own functional acceptance; process and storage isolation alone do not establish those integrations.

## Acceptance

Verify an actual debug Desktop and Host chain while the stable task remains running, then rebuild, restart and stop debug. Record both instances' process IDs and start times, independent state files, and the absence of stable-process replacement. Test a real native backend turn through the debug runtime. Keep live logs and acceptance artifacts under ignored `.codexhost/`; do not commit task contents, credentials or machine-specific runtime records.

Promotion to the daily instance still uses a committed `fork:build` snapshot and a normal idle-time switch. A debug restart does not migrate running tasks between versions.
