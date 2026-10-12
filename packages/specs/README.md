# specs

Collects a machine's hardware specs and writes a [device record](../../schema/device-record.v1.schema.json) as JSON. Built on [systeminformation](https://github.com/sebhildebrandt/systeminformation).

```sh
specs                         # print the record
specs -o record.json          # write it to a file
specs --station bench-2 --operator tech-03 --asset-tag RG-000123
```

Exit codes: `0` pass, `1` warning (for example, firmware has no serial number so the device ID falls back to the disk serial), `2` error.

## What it records

Device identity (manufacturer, model, serial, UUID, chassis type), BIOS, baseboard, CPU, memory modules, drives (model, serial, interface, HDD/SSD, capacity, SMART status), graphics, display, battery health, physical network adapters, and OS.

Firmware placeholders such as `To be filled by O.E.M.` or `Default string` are dropped, never stored.

## Device ID

`device.id` links every tool's records for one machine. It is the SHA-256 of `manufacturer|serial|uuid` (lowercased). When firmware has neither a serial nor a UUID, it falls back to the first internal disk serial, then the OS machine ID, and the run status becomes `warning`.

## Develop

```sh
bun install
bun test
bun src/cli.ts
bun run build        # standalone binaries in dist/ for linux, windows and macOS (x64 and arm64)
```

Linux needs root for full disk and memory details (`sudo specs`).
