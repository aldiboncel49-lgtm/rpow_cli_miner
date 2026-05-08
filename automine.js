#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");

const STATE_FILE = ".rpow-cli-state.json";
const WORKERS = process.env.RPOW_WORKERS || "2";
const COUNT = process.env.RPOW_COUNT || "1";
const RETRY_DELAY_MS = Number(process.env.RPOW_RETRY_DELAY_MS || 10000);
const MAX_RETRIES = Number(process.env.RPOW_MAX_RETRIES || 0);

// Inject state dari env var kalau ada
if (process.env.RPOW_STATE_JSON && !fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, process.env.RPOW_STATE_JSON);
  console.log("[automine] state injected from RPOW_STATE_JSON");
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
