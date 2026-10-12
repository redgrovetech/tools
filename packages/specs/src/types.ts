// TypeScript view of schema/device-record.v1.schema.json. Keep the two in step.

export type RunStatus = "pass" | "fail" | "warning" | "error";

export interface DeviceIdentity {
  id: string;
  serialNumber?: string;
  systemUuid?: string;
  manufacturer?: string;
  model?: string;
  sku?: string;
  chassisType?: string;
  assetTag?: string;
}

export interface Drive {
  path?: string;
  model?: string;
  serial: string;
  firmware?: string;
  interface?: "sata" | "nvme" | "sas" | "usb" | "emmc" | "other";
  mediaType?: "hdd" | "ssd";
  capacityBytes?: number;
  smartStatus?: "ok" | "warning" | "failing" | "unknown";
  powerOnHours?: number;
}

export interface SpecsPayload {
  bios?: { vendor?: string; version?: string; releaseDate?: string };
  baseboard?: { manufacturer?: string; model?: string; serial?: string };
  cpu?: {
    manufacturer?: string;
    brand?: string;
    cores?: number;
    physicalCores?: number;
    speedGHz?: number;
    arch?: string;
  };
  memory?: {
    totalBytes?: number;
    modules?: Array<{
      slot?: string;
      sizeBytes?: number;
      type?: string;
      speedMHz?: number;
      manufacturer?: string;
      partNumber?: string;
      serial?: string;
    }>;
  };
  disks?: Drive[];
  graphics?: Array<{ vendor?: string; model?: string; vramMB?: number }>;
  display?: { resolutionX?: number; resolutionY?: number; sizeInches?: number };
  battery?: {
    present: boolean;
    designCapacityWh?: number;
    fullChargeCapacityWh?: number;
    healthPercent?: number;
    cycleCount?: number;
  };
  network?: Array<{ name?: string; type?: "wired" | "wireless" | "other"; mac?: string }>;
  os?: { platform?: string; distro?: string; release?: string };
}

export interface DeviceRecord {
  schemaVersion: "1.0";
  recordId: string;
  device: DeviceIdentity;
  tool: {
    name: string;
    version: string;
    os: "linux" | "windows" | "macos";
    arch: "x64" | "arm64";
    bootEnv?: "usb-live" | "pxe" | "installed-os";
  };
  run: {
    startedAt: string;
    finishedAt: string;
    status: RunStatus;
    operator?: string;
    station?: string;
    messages?: string[];
  };
  kind: "specs" | "erase";
  payload: SpecsPayload | Record<string, unknown>;
}
