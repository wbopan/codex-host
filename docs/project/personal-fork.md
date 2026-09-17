# Personal source fork

This fork keeps Codex Desktop as the primary interface and maintains Host customizations as source commits. `origin` is the personal fork; `upstream` is `BytePioneer-AI/codex-host`. `wenbo/main` carries personal changes. The initial upstream baseline is `ffc9be0ec039d6e5d35c1f31fbdaac0369a85a8e` (Host 0.8.2).

## Setup and build

On macOS, start with an existing Node installation and Xcode Command Line Tools:

```sh
npm run fork:bootstrap
bash tools/fork/with-toolchain.sh npm ci
npm run fork:check
npm run fork:build
```

Bootstrap installs Node 24.13.1 and the compiler pinned by `rust-toolchain.toml` into ignored `.codexhost/toolchains/`. It does not modify shell profiles, global npm packages, or installed applications. Node archives are checked against the upstream release script's pinned checksum; Rustup is checked against Rust's distribution checksum. The bootstrap uses Rust's S3 distribution endpoint because its usual CDN was unreachable on the initial machine. `with-toolchain.sh` must be updated with the Node pin when changing the bundled Node version.

`fork:check` runs TypeScript checks, Claude SDK transport tests, and snapshot launch tests. For additional commands with the same toolchain, use `bash tools/fork/with-toolchain.sh <command>`. UI changes also require the relevant renderer tests and visual checks.

`fork:build` requires committed source, runs the existing upstream release payload builder (TypeScript, renderer, Rust release binaries, plugins, and bundled Node), and copies the result into `.codexhost/builds/<full-git-commit>/`. Each build has a file and permission inventory in `fork-manifest.json`. Existing snapshots are never overwritten. `.codexhost/latest-build.txt` records the most recently built snapshot; it does not activate it.

The snapshot is independent of the development checkout's `node_modules` and the installed Host application. It omits installer distribution metadata, so the built-in upstream installer updater is unavailable. Upgrade the fork through Git and rebuild. No DMG or public release is needed for this local workflow.

## Launch and rollback

For daily development alongside an active stable Desktop, use the [independent debug instance](debug-instance.md). `npm run debug:build` accepts uncommitted source and publishes a new immutable debug snapshot. `npm run debug:start` opens it with independent state; `npm run debug:restart` replaces only the development instance. Stable snapshot promotion below remains a separate operation.

Locate the snapshot using `.codexhost/latest-build.txt`. Its `Launch-Fork.command --dry-run` verifies the inventory and prints the launch command without starting anything. Save work and quit Codex Desktop normally before running or double-clicking `Launch-Fork.command` without that option. The guard rejects a running Desktop or Host and does not terminate processes.

The launcher reuses the existing Host data directory and the official Codex Desktop installation. Keep the official Host application available. After quitting a fork runtime, reopen the official Host application to return to it, or launch a previously validated snapshot to revert only the Host build. Build rollback does not restore session data or undo future database migrations; review migration compatibility before upstream upgrades.

Avoid `npm start` and `npm run install:local` during ongoing Desktop work: upstream scripts stop and restart Desktop. They are separate from the guarded fork workflow. If an interrupted build leaves `.codexhost/fork-build.lock`, first check that no build is running before removing that lock directory.

## Maintain personal changes

Keep Claude protocol fixes and personal UI preferences in separate commits. The initial Claude patch forwards empty-form MCP confirmation requests through the existing approval UI; it does not establish Computer Use or Browser Use acceptance. The companion memory/MCP bridge remains separately configured and is not embedded in the Host repository.

Host UI changes live primarily in `packages/renderer-extension`; Claude SDK behavior belongs in `packages/adapters/claude-code`. Prefer small display options for personal UI choices. Official Desktop controls still depend on version-sensitive renderer integration.

For an upstream update, commit current changes, fetch `upstream`, and create an integration branch from `wenbo/main`. Merge a reviewed upstream commit, resolve conflicts, run the relevant checks, and build a new snapshot. Perform real Desktop acceptance before advancing the daily version. Preserve `main` as the upstream baseline and push personal commits to `origin/wenbo/main`; do not publish npm packages or create upstream release tags for local builds.
