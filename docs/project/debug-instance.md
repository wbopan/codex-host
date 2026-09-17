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

When the user has installed the separate `codexhost-claude-bridge` adapter as the user-level `codex_desktop` MCP, debug setup registers that same adapter in the private Claude profile and adds its SessionStart and lifecycle hooks. Only this bridge registration is imported. Its MCP environment points to the debug app copy and debug Codex home; its memory hook reads the daily `~/.codex/memories` as shared, read-only context. Existing debug configuration and unrelated MCPs/hooks remain in place, conflicting registrations stop setup before writes, and changed files are backed up in `claude/backups/desktop-bridge-*`. The adapter scripts remain in their existing installation and must remain available. Without that installation, debug setup does not invent a Desktop tool provider.

After adding a bridge to an already running development profile, use a fresh Claude task so the native process reloads MCPs and hooks. A successful MCP connection exposes `mcp__codex_desktop__js` and `js_reset`; it does not establish application authorization or browser connectivity. Verify those through a real Host task, retaining its genuine task/turn identity and native permission prompts. A link to a Codex plugin does not make its tools available to a Claude task.

Debug setup selects the official MCP owner with `env.CODEXHOST_CUA_OWNER = "app-server"` in its private Claude settings, preserving any explicit debug override. Setup requires the installed adapter's `app_server_mcp.py` and shared helper alongside its MCP and hook scripts before changing configuration. This owner starts the signed official app-server, allocates an ephemeral native context for MCP execution, and uses `mcpServer/tool/call` for `cua_repl` only. The outer adapter continues to authenticate the real Host task and turn and forwards their MCP metadata unchanged. Elicitation requests pass through to Claude and the Host approval UI. The native context is separate from the visible Host task; no native task ID is invented or substituted for the caller. Other MCP tools are not exposed by this adapter. The native API is experimental and should be revalidated after Desktop upgrades.

Live development validation showed that this owner reaches the IAB API with the correct Host task identity while the direct child-MCP path was rejected by the native peer authorizer. A real Claude task opened example.com in IAB, read its title, visible text and accessibility tree, returned a screenshot, and closed the test tab. The official app and its peer checks remain unchanged. IAB still requires a Desktop window route for the actual task. After a debug restart, opening that task in the debug window establishes the route; invoking it headlessly while the window shows the home screen returns `No ChatGPT browser route is available`. A missing route is distinct from failed connection authorization.

On exit, the outer bridge allows the native owner to finish its scoped process cleanup. A live ephemeral MCP context shut down with all four observed owned processes gone. With the default approval policy, permission requests remain transparent, including user declines; shutdown and permission-translation tests do not replace application-level acceptance.

Claude's `bypassPermissions` controls Claude tool approvals, not native MCP elicitation. The optional private file `claude/codex-desktop.json` can set `{ "version": 1, "appApprovals": "allow" }` when the user wants standing consent for desktop-app access. The installed adapter's `app_approval_policy.py` recognizes only native `cua_repl` empty-form app confirmations that explicitly allow persistent approval, after the native app policy has allowed the target. It returns the native `accept` response with `_meta.persist = "always"`. Other requests still go through the permission UI, including device verification, authentication, input forms, audio recording and requests that disallow persistent approval. The policy file is read for every new request; changing `appApprovals` to `ask` or removing the file stops new automatic grants. Previously saved native app approvals survive a new MCP context; revoke those separately under Settings > Computer Use > Always-allowed apps. Setup does not enable this policy or import stable-instance permissions automatically.

Computer Use acts on the same macOS desktop in both instances. Do not run conflicting mouse/keyboard automation concurrently. Native tools and IAB require their own functional acceptance; process and storage isolation alone do not establish those integrations.

## Acceptance

Verify an actual debug Desktop and Host chain while the stable task remains running, then rebuild, restart and stop debug. Record both instances' process IDs and start times, independent state files, and the absence of stable-process replacement. Test a real native backend turn through the debug runtime. Keep live logs and acceptance artifacts under ignored `.codexhost/`; do not commit task contents, credentials or machine-specific runtime records.

Promotion to the daily instance still uses a committed `fork:build` snapshot and a normal idle-time switch. A debug restart does not migrate running tasks between versions.
