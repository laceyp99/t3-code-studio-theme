#!/usr/bin/env node
// Sync studio.css into studio.json, check it, and apply it with `t3 theme set`.
//
//   node scripts/apply-theme.mjs            sync, check, apply once
//   node scripts/apply-theme.mjs --watch    re-apply every time studio.css is saved
//   node scripts/apply-theme.mjs --no-apply sync and check only
//   node scripts/apply-theme.mjs --remote laptop
//                                          also apply on an SSH host (repeatable)
//
// A remote host needs key-based SSH (no password prompt), `t3` on its PATH,
// and an existing ~/.t3/userdata/themes/ folder (not created here). The file
// is copied into that folder and applied with `t3 theme set studio`.
//
// Any other flags (e.g. --base-dir <dir>) are passed through to the local
// `t3 theme set`.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_FILE = join(ROOT, "studio.css");
const JSON_FILE = join(ROOT, "studio.json");
const THEME_ID = "studio";
// T3 refuses to publish a theme file over 32 KiB (ThemeFileTooLargeError).
const THEME_BYTE_LIMIT = 32_768;

let watchMode = false;
let apply = true;
const remotes = [];
const t3Args = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--watch") watchMode = true;
  else if (arg === "--no-apply") apply = false;
  else if (arg === "--remote" || arg.startsWith("--remote=")) {
    const host = arg === "--remote" ? args[++i] : arg.slice("--remote=".length);
    // A host starting with "-" would be read by ssh as an option.
    if (!host || host.startsWith("-")) {
      console.error("Error: --remote needs an SSH host, e.g. --remote laptop");
      process.exit(1);
    }
    remotes.push(host);
  } else t3Args.push(arg);
}

function sync() {
  const css = readFileSync(CSS_FILE, "utf8");
  const raw = readFileSync(JSON_FILE, "utf8");
  const theme = JSON.parse(raw.replace(/^\uFEFF/, ""));
  theme.css = css;
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const next = (JSON.stringify(theme, null, 2) + "\n").replace(/\n/g, eol);
  const bytes = Buffer.byteLength(next);
  if (bytes > THEME_BYTE_LIMIT) {
    throw new Error(`studio.json would be ${bytes} bytes; T3 allows ${THEME_BYTE_LIMIT}.`);
  }
  if (next !== raw) writeFileSync(JSON_FILE, next);
  console.log(`Synced studio.css into studio.json (${bytes}/${THEME_BYTE_LIMIT} bytes).`);
}

function applyTheme() {
  const win = process.platform === "win32";
  const cmdArgs = ["theme", "set", "studio.json", "--id", THEME_ID, ...t3Args];
  const options = { cwd: ROOT, stdio: "inherit" };
  // t3 on Windows is a .cmd shim, which needs a shell, so pass one quoted command line.
  const result = win
    ? spawnSync(["t3.cmd", ...cmdArgs].map((a) => `"${a}"`).join(" "), { ...options, shell: true })
    : spawnSync("t3", cmdArgs, options);
  if (result.error?.code === "ENOENT") {
    throw new Error("Could not find the t3 CLI on PATH. Import studio.json in Settings > Appearance instead.");
  }
  if (result.status !== 0) {
    // On Windows a missing t3 shows up as a cmd error and a non-zero exit, not ENOENT.
    const hint = win ? " If t3 is not on PATH, import studio.json in Settings > Appearance instead." : "";
    throw new Error(`t3 theme set exited with code ${result.status}.${hint}`);
  }
}

function applyRemote(host) {
  console.log(`Applying on ${host}...`);
  // BatchMode fails fast instead of waiting on a password prompt.
  const sshOptions = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
  const options = { cwd: ROOT, stdio: "inherit" };
  const copy = spawnSync(
    "scp",
    ["-q", ...sshOptions, "studio.json", `${host}:.t3/userdata/themes/${THEME_ID}.json`],
    options,
  );
  if (copy.error?.code === "ENOENT") throw new Error("Could not find scp on PATH. Install the OpenSSH client.");
  if (copy.status !== 0) throw new Error(`Copying studio.json to ${host} failed (scp exited with code ${copy.status}).`);
  // Plain `t3` also works on Windows hosts: cmd and PowerShell both resolve it to t3.cmd.
  const set = spawnSync("ssh", [...sshOptions, host, `t3 theme set ${THEME_ID}`], options);
  if (set.status !== 0) throw new Error(`t3 theme set on ${host} exited with code ${set.status}.`);
}

function run() {
  try {
    sync();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return false;
  }
  if (!apply) return true;
  // Try every target, so one unreachable machine doesn't block the others.
  let ok = true;
  for (const step of [applyTheme, ...remotes.map((host) => () => applyRemote(host))]) {
    try {
      step();
    } catch (err) {
      console.error(`Error: ${err.message}`);
      ok = false;
    }
  }
  return ok;
}

const ok = run();

if (watchMode) {
  console.log("Watching studio.css. Press Ctrl+C to stop.");
  let timer;
  // Watch the folder, not the file: editors that save by replacing the file
  // would leave a file watcher attached to the old copy on Linux and macOS.
  // Editors also fire several events per save, so wait for them to settle.
  watch(ROOT, (_event, filename) => {
    if (filename && filename !== "studio.css") return;
    clearTimeout(timer);
    timer = setTimeout(run, 200);
  });
} else if (!ok) {
  process.exitCode = 1;
}
