#!/usr/bin/env node
// Sync studio.css into studio.json, check it, and apply it with `t3 theme set`.
//
//   node scripts/apply-theme.mjs            sync, check, apply once
//   node scripts/apply-theme.mjs --watch    re-apply every time studio.css is saved
//   node scripts/apply-theme.mjs --no-apply sync and check only
//
// Any other flags (e.g. --base-dir <dir>) are passed through to `t3 theme set`.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_FILE = join(ROOT, "studio.css");
const JSON_FILE = join(ROOT, "studio.json");
const THEME_ID = "studio";
const CSS_LIMIT = 20_000;

const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const apply = !args.includes("--no-apply");
const t3Args = args.filter((a) => a !== "--watch" && a !== "--no-apply");

function sync() {
  const css = readFileSync(CSS_FILE, "utf8");
  if (css.length > CSS_LIMIT) {
    throw new Error(`studio.css is ${css.length} characters; T3 allows ${CSS_LIMIT}.`);
  }
  const raw = readFileSync(JSON_FILE, "utf8");
  const theme = JSON.parse(raw.replace(/^﻿/, ""));
  theme.css = css;
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const next = (JSON.stringify(theme, null, 2) + "\n").replace(/\n/g, eol);
  if (next !== raw) writeFileSync(JSON_FILE, next);
  console.log(`Synced studio.css into studio.json (${css.length}/${CSS_LIMIT} characters).`);
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
  if (result.status !== 0) throw new Error(`t3 theme set exited with code ${result.status}.`);
}

function run() {
  try {
    sync();
    if (apply) applyTheme();
    return true;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return false;
  }
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
