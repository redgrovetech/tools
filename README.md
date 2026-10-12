# Redgrove tools

Free, open-source command-line utilities for IT asset disposition (ITAD) and refurbishment benches.

Each tool does one job and writes the same JSON **device record**, so results from different tools link to the same machine and can be collected by scripts, a bench workbench, or a central database.

| Tool | Status | What it does |
| --- | --- | --- |
| [`specs`](packages/specs) | Preview | Collects hardware specs (CPU, memory, drives, battery, graphics, network) |
| `erase` | Planned | Sanitizes HDD, SATA SSD and NVMe drives following NIST SP 800-88 |
| `tpm` | Planned | Reports TPM presence, version and Windows 11 readiness |

Targets: Windows and Linux on x64 first, ARM64 next, macOS later.

## Device record

The shared format is [schema/device-record.v1.schema.json](schema/device-record.v1.schema.json), with examples in [schema/examples](schema/examples).

## License

Apache License 2.0. See [LICENSE](LICENSE).
