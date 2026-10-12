import { createHash } from "node:crypto";

// Values firmware vendors leave in place of a real serial, UUID or name.
const PLACEHOLDERS = new Set([
  "",
  "-",
  "0",
  "none",
  "n/a",
  "na",
  "null",
  "unknown",
  "default",
  "default string",
  "to be filled by o.e.m.",
  "to be filled by oem",
  "o.e.m.",
  "oem",
  "system serial number",
  "chassis serial number",
  "base board serial number",
  "system product name",
  "system manufacturer",
  "not specified",
  "not applicable",
  "not available",
  "invalid",
  "123456789",
  "0123456789",
  "1234567890",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "03000200-0400-0500-0006-000700080009",
]);

/** Trims a firmware string and returns undefined for blanks and known placeholders. */
export function clean(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  if (PLACEHOLDERS.has(s.toLowerCase())) return undefined;
  // Strings of one repeated character, like "0000000" or "xxxxxxxx".
  if (s.length > 1 && /^(.)\1+$/.test(s)) return undefined;
  return s;
}

function sha256(input: string): string {
  return createHash("sha256").update(input.toLowerCase()).digest("hex");
}

export interface IdentityInput {
  manufacturer?: string;
  serialNumber?: string;
  systemUuid?: string;
  fallbackDiskSerial?: string;
  osMachineId?: string;
}

export interface IdentityResult {
  id: string;
  source: "system" | "disk" | "os";
}

/**
 * Builds the stable device ID that links every tool's records for one machine.
 * Prefers firmware serial/UUID, then the first internal disk serial, then the OS machine ID.
 */
export function deviceId(input: IdentityInput): IdentityResult | undefined {
  if (input.serialNumber || input.systemUuid) {
    return {
      id: sha256(`${input.manufacturer ?? ""}|${input.serialNumber ?? ""}|${input.systemUuid ?? ""}`),
      source: "system",
    };
  }
  if (input.fallbackDiskSerial) return { id: sha256(`disk|${input.fallbackDiskSerial}`), source: "disk" };
  if (input.osMachineId) return { id: sha256(`os|${input.osMachineId}`), source: "os" };
  return undefined;
}
