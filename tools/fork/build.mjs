import { execFileSync } from "node:child_process";
import { chmod, copyFile, cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { prepareReleasePayload } from "../../scripts/release/prepare-payload.mjs";
import { hostReleaseTarget } from "../../scripts/release/targets.mjs";
import { inventory, verifySnapshot } from "./launch.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (process.argv.length !== 2) throw new Error("Usage: npm run fork:build");
if (process.platform !== "darwin") throw new Error("Fork snapshots currently support macOS.");
if (git("status", "--porcelain"))
  throw new Error("Commit or stash source changes before building a snapshot.");
const commit = git("rev-parse", "HEAD");
const output = path.join(root, ".codexhost/builds", commit);
await mkdir(path.dirname(output), { recursive: true });
// An exclusive reservation prevents concurrent builders from touching shared release output.
const lock = path.join(root, ".codexhost/fork-build.lock");
await mkdir(lock);
let reserved = false;
try {
  await mkdir(output);
  reserved = true;
  const prepared = await prepareReleasePayload({ root, target: hostReleaseTarget() });
  if (git("rev-parse", "HEAD") !== commit || git("status", "--porcelain")) {
    throw new Error("Source changed while building; no snapshot was published.");
  }
  await cp(prepared.payloadRoot, output, { recursive: true, force: false });
  // Source-owned versions are upgraded through Git, outside the official installer updater.
  await rm(path.join(output, "app/codexhost-distribution.json"));
  await copyFile(path.join(root, "tools/fork/launch.mjs"), path.join(output, "launch.mjs"));
  const launcher = path.join(output, "Launch-Fork.command");
  await writeFile(
    launcher,
    '#!/bin/bash\nset -euo pipefail\nFORK_BUILD="$(cd "$(dirname "$0")" && pwd)"\nexec "$FORK_BUILD/runtime/node" "$FORK_BUILD/launch.mjs" "$@"\n',
  );
  await chmod(launcher, 0o755);
  const manifest = {
    schemaVersion: 1,
    commit,
    upstream: "https://github.com/BytePioneer-AI/codex-host",
    upstreamBase: git("merge-base", "HEAD", "upstream/main"),
    version: prepared.version,
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    rust: execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim(),
    createdAt: new Date().toISOString(),
    files: await inventory(output),
  };
  await writeFile(
    path.join(output, "fork-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await verifySnapshot(output);
  const pointer = path.join(root, ".codexhost/latest-build.txt");
  await writeFile(`${pointer}.tmp`, `${output}\n`);
  await rename(`${pointer}.tmp`, pointer);
  console.log(`Verified snapshot: ${output}\nLaunch after quitting Desktop: ${launcher}`);
} catch (error) {
  if (reserved) await rm(output, { recursive: true, force: true });
  throw error;
} finally {
  await rm(lock, { recursive: true, force: true });
}
