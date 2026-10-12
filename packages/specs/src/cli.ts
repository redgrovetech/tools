#!/usr/bin/env bun
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import pkg from "../package.json";
import { collectRaw } from "./collect";
import { buildRecord, type RunContext } from "./map";

const HELP = `specs ${pkg.version}
Collect hardware specs and print a device record (JSON).

Usage: specs [options]

Options:
  -o, --out <file>        Write the record to a file instead of stdout
      --compact           Print JSON on one line
      --operator <name>   Technician name or ID
      --station <id>      Bench or station ID
      --asset-tag <tag>   Inventory tag to attach to the device
      --boot-env <env>    usb-live | pxe | installed-os
  -v, --version           Print the version
  -h, --help              Show this help

Exit codes: 0 pass, 1 warning, 2 error.`;

const BOOT_ENVS = ["usb-live", "pxe", "installed-os"] as const;

function platformName(): RunContext["os"] {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function archName(): RunContext["arch"] {
  if (process.arch === "x64" || process.arch === "arm64") return process.arch;
  throw new Error(`Unsupported CPU architecture: ${process.arch} (64-bit x64 or arm64 only)`);
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      out: { type: "string", short: "o" },
      compact: { type: "boolean" },
      operator: { type: "string" },
      station: { type: "string" },
      "asset-tag": { type: "string" },
      "boot-env": { type: "string" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values.version) {
    console.log(pkg.version);
    return 0;
  }

  const bootEnv = values["boot-env"];
  if (bootEnv !== undefined && !(BOOT_ENVS as readonly string[]).includes(bootEnv)) {
    console.error(`--boot-env must be one of: ${BOOT_ENVS.join(", ")}`);
    return 2;
  }

  const startedAt = new Date().toISOString();
  const { raw, errors } = await collectRaw();
  const record = buildRecord(raw, {
    recordId: randomUUID(),
    toolVersion: pkg.version,
    os: platformName(),
    arch: archName(),
    bootEnv: bootEnv as RunContext["bootEnv"],
    startedAt,
    finishedAt: new Date().toISOString(),
    operator: values.operator,
    station: values.station,
    assetTag: values["asset-tag"],
  });
  if (errors.length) {
    record.run.messages = [...(record.run.messages ?? []), ...errors.map((e) => `Probe failed: ${e}`)];
    if (record.run.status === "pass") record.run.status = "warning";
  }

  const json = JSON.stringify(record, null, values.compact ? 0 : 2);
  if (values.out) writeFileSync(values.out, json + "\n");
  else console.log(json);

  return record.run.status === "pass" ? 0 : record.run.status === "warning" ? 1 : 2;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  },
);
