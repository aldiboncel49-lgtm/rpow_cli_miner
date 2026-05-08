#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");

const STATE_FILE = ".rpow-cli-state.json";
const WORKERS = process.env.RPOW_WORKERS || "2";
const COUNT = process.env.RPOW_COUNT || "1";
const RETRY_DELAY_MS = Number(process.env.RPOW_RETRY_DELAY_MS || 10000);
const MAX_RETRIES = Number(process.env.RPOW_MAX_RETRIES || 0);

// ── Inject state dari env var ──────────────────────────────────────────────

// Prioritas 1: RPOW_COOKIE — cukup paste nilai cookie rpow_session saja
if (process.env.RPOW_COOKIE) {
  const cookieVal = process.env.RPOW_COOKIE.trim();
  // Dukung format "rpow_session=xxx" maupun nilai mentah "xxx"
  const sessionVal = cookieVal.startsWith("rpow_session=")
    ? cookieVal.slice("rpow_session=".length)
    : cookieVal;

  const state = {
    updated_at: new Date().toISOString(),
    cookies: { rpow_session: sessionVal },
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log("[automine] state injected from RPOW_COOKIE");
  console.log("[automine] rpow_session length:", sessionVal.length);

// Prioritas 2: RPOW_STATE_JSON — paste seluruh JSON state
} else if (process.env.RPOW_STATE_JSON) {
  try {
    // Validasi JSON sebelum tulis
    const parsed = JSON.parse(process.env.RPOW_STATE_JSON);
    fs.writeFileSync(STATE_FILE, JSON.stringify(parsed, null, 2));
    console.log("[automine] state injected from RPOW_STATE_JSON");
    console.log("[automine] cookies keys:", Object.keys(parsed.cookies || {}));
  } catch (e) {
    console.error("[automine] ERROR: RPOW_STATE_JSON bukan JSON valid:", e.message);
    process.exit(1);
  }

} else {
  // Tidak ada env var — cek apakah state file sudah ada
  if (fs.existsSync(STATE_FILE)) {
    console.log("[automine] menggunakan state file yang sudah ada");
    try {
      const existing = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      console.log("[automine] cookies keys:", Object.keys(existing.cookies || {}));
    } catch (_) {}
  } else {
    console.error("[automine] ERROR: tidak ada RPOW_COOKIE, RPOW_STATE_JSON, maupun state file.");
    console.error("[automine] Set env var RPOW_COOKIE dengan nilai cookie rpow_session dari browser.");
    process.exit(1);
  }
}

let attempt = 0;

function log(msg) {
  console.log(`[${new Date().toISOString()}] [automine] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  while (true) {
    attempt++;
    log(`attempt #${attempt} — starting mine --count ${COUNT} --workers ${WORKERS}`);
    const result = spawnSync(
      "node",
      ["rpow-cli.js", "mine", "--count", COUNT, "--engine", "native", "--workers", WORKERS],
      { stdio: "inherit" }
    );
    if (result.status === 0) {
      log("mine completed successfully, restarting loop...");
      attempt = 0;
      continue;
    }
    const reason = result.signal
      ? `killed by signal ${result.signal}`
      : `exited with code ${result.status}`;
    log(`mine failed: ${reason}`);
    if (MAX_RETRIES > 0 && attempt >= MAX_RETRIES) {
      log(`max retries (${MAX_RETRIES}) reached, exiting.`);
      process.exit(1);
    }
    log(`retrying in ${RETRY_DELAY_MS / 1000}s...`);
    await sleep(RETRY_DELAY_MS);
  }
}

run();
