import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../schema/device-record.v1.schema.json";
import eraseExample from "../../../schema/examples/erase.json";
import { clean, deviceId } from "../src/identity";
import { buildRecord, type RawSpecs, type RunContext } from "../src/map";
import hp from "./fixtures/hp-elitebook.json";
import whitebox from "./fixtures/whitebox-desktop.json";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const ctx: RunContext = {
  recordId: "0f8b8c7e-6b1e-4d3a-9a51-2c7f5b9d1e44",
  toolVersion: "0.1.0",
  os: "windows",
  arch: "x64",
  startedAt: "2026-10-13T14:00:00.000Z",
  finishedAt: "2026-10-13T14:00:02.000Z",
};

function expectValid(record: unknown) {
  const ok = validate(record);
  if (!ok) throw new Error(JSON.stringify(validate.errors, null, 2));
}

describe("clean", () => {
  test("drops firmware placeholders", () => {
    for (const v of ["", " ", "-", "Default string", "To Be Filled By O.E.M.", "System Serial Number", "00000000", "FFFFFFFF", undefined, null]) {
      expect(clean(v)).toBeUndefined();
    }
  });
  test("keeps real values, trimmed", () => {
    expect(clean("  5CG1234ABC ")).toBe("5CG1234ABC");
  });
});

describe("deviceId", () => {
  test("is stable and case-insensitive", () => {
    const a = deviceId({ manufacturer: "HP", serialNumber: "5CG1234ABC", systemUuid: "ABC" });
    const b = deviceId({ manufacturer: "hp", serialNumber: "5cg1234abc", systemUuid: "abc" });
    expect(a?.id).toBe(b!.id);
    expect(a?.source).toBe("system");
  });
  test("falls back to disk serial, then OS machine ID", () => {
    expect(deviceId({ fallbackDiskSerial: "Z9A1" })?.source).toBe("disk");
    expect(deviceId({ osMachineId: "8f3a" })?.source).toBe("os");
    expect(deviceId({})).toBeUndefined();
  });
});

describe("buildRecord on an HP laptop", () => {
  const record = buildRecord(hp as RawSpecs, ctx);
  const p = record.payload as any;

  test("is valid against the schema", () => expectValid(record));
  test("identifies the device from firmware", () => {
    expect(record.run.status).toBe("pass");
    expect(record.device).toMatchObject({ manufacturer: "HP", serialNumber: "5CG1234ABC", chassisType: "Notebook" });
    expect(record.device.systemUuid).toBe("4c4c4544-0042-3510-8058-b2c04f4e3132");
  });
  test("maps drives, including the USB stick", () => {
    expect(p.disks).toEqual([
      expect.objectContaining({ serial: "S4GENX0R123456", interface: "nvme", mediaType: "ssd", smartStatus: "ok" }),
      expect.objectContaining({ serial: "4C530001230101112345", interface: "usb" }),
    ]);
  });
  test("reports battery health in Wh", () => {
    expect(p.battery).toEqual({ present: true, designCapacityWh: 53, fullChargeCapacityWh: 44.52, healthPercent: 84, cycleCount: 212 });
  });
  test("computes display size and skips virtual NICs", () => {
    expect(p.display).toEqual({ resolutionX: 1920, resolutionY: 1080, sizeInches: 13.9 });
    expect(p.network.map((n: any) => n.type)).toEqual(["wireless", "wired"]);
  });
});

describe("buildRecord on a whitebox desktop with placeholder firmware", () => {
  const record = buildRecord(whitebox as RawSpecs, { ...ctx, os: "linux", assetTag: "RG-000123" });
  const p = record.payload as any;

  test("is valid against the schema", () => expectValid(record));
  test("falls back to the first internal disk serial and warns", () => {
    expect(record.run.status).toBe("warning");
    expect(record.device.serialNumber).toBeUndefined();
    expect(record.device.systemUuid).toBeUndefined();
    expect(record.device.id).toBe(deviceId({ fallbackDiskSerial: "Z9A1B2C3" })!.id);
  });
  test("uses the asset tag passed in, not the placeholder", () => {
    expect(record.device.assetTag).toBe("RG-000123");
  });
  test("skips drives with no serial and flags failing SMART", () => {
    expect(p.disks).toHaveLength(2);
    expect(p.disks[1]).toMatchObject({ mediaType: "ssd", interface: "sata", smartStatus: "failing" });
  });
  test("omits unknowns instead of writing placeholders", () => {
    expect(p.memory.modules[0].serial).toBeUndefined();
    expect(p.battery).toEqual({ present: false });
    expect(p.display).toBeUndefined();
  });
});

test("errors when nothing identifies the device", () => {
  const raw = { ...(whitebox as RawSpecs), diskLayout: [], osInfo: { platform: "linux" } };
  const record = buildRecord(raw, ctx);
  expect(record.run.status).toBe("error");
  expectValid(record);
});

test("the erase example in schema/examples is valid", () => expectValid(eraseExample));
