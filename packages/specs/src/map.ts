import type { Systeminformation as SI } from "systeminformation";
import { clean, deviceId } from "./identity";
import type { DeviceRecord, Drive, RunStatus, SpecsPayload } from "./types";

/** Everything the specs tool reads from systeminformation, gathered before mapping. */
export interface RawSpecs {
  system: Partial<SI.SystemData>;
  bios: Partial<SI.BiosData>;
  baseboard: Partial<SI.BaseboardData>;
  chassis: Partial<SI.ChassisData>;
  cpu: Partial<SI.CpuData>;
  mem: Partial<SI.MemData>;
  memLayout: Partial<SI.MemLayoutData>[];
  diskLayout: Partial<SI.DiskLayoutData>[];
  graphics: { controllers?: Partial<SI.GraphicsControllerData>[]; displays?: Partial<SI.GraphicsDisplayData>[] };
  battery: Partial<SI.BatteryData>;
  network: Partial<SI.NetworkInterfacesData>[];
  osInfo: Partial<SI.OsData>;
}

export interface RunContext {
  recordId: string;
  toolVersion: string;
  os: DeviceRecord["tool"]["os"];
  arch: DeviceRecord["tool"]["arch"];
  bootEnv?: DeviceRecord["tool"]["bootEnv"];
  startedAt: string;
  finishedAt: string;
  operator?: string;
  station?: string;
  assetTag?: string;
}

function isEmptyObject(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0;
}

/** Drops undefined fields and empty objects so unknown values are omitted rather than written as null or {}. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && !isEmptyObject(v))) as T;
}

function positive(n: unknown): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

function round(n: number | undefined, digits = 1): number | undefined {
  if (n === undefined) return undefined;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function driveInterface(d: Partial<SI.DiskLayoutData>): Drive["interface"] {
  const t = `${d.interfaceType ?? ""} ${d.type ?? ""}`.toLowerCase();
  if (t.includes("nvme")) return "nvme";
  if (t.includes("usb")) return "usb";
  if (t.includes("sas") || t.includes("scsi")) return "sas";
  if (t.includes("sata") || t.includes("ata")) return "sata";
  if (t.includes("mmc")) return "emmc";
  return d.interfaceType ? "other" : undefined;
}

function mediaType(d: Partial<SI.DiskLayoutData>): Drive["mediaType"] {
  const t = (d.type ?? "").toLowerCase();
  if (t === "hd") return "hdd";
  if (t === "ssd" || t === "nvme") return "ssd";
  return undefined;
}

function smartStatus(s: string | undefined): Drive["smartStatus"] {
  const v = (s ?? "").toLowerCase();
  if (v === "ok") return "ok";
  if (v.includes("fail")) return "failing";
  if (v.includes("warn")) return "warning";
  return "unknown";
}

export function mapDisks(disks: Partial<SI.DiskLayoutData>[]): Drive[] {
  const out: Drive[] = [];
  for (const d of disks) {
    const serial = clean(d.serialNum);
    if (!serial) continue; // A drive without a serial can't be tracked or certified.
    out.push(
      compact({
        path: clean(d.device),
        model: clean(d.name),
        serial,
        firmware: clean(d.firmwareRevision),
        interface: driveInterface(d),
        mediaType: mediaType(d),
        capacityBytes: positive(d.size),
        smartStatus: smartStatus(d.smartStatus),
        powerOnHours: positive(d.smartData?.power_on_time?.hours),
      }),
    );
  }
  return out;
}

function toWh(value: number | undefined, unit: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (unit === "mWh") return round(value / 1000, 2);
  if (unit === "Wh") return round(value, 2);
  return undefined; // mAh can't be converted without voltage.
}

export function mapBattery(b: Partial<SI.BatteryData>): SpecsPayload["battery"] {
  if (!b.hasBattery) return { present: false };
  const design = positive(b.designedCapacity);
  const full = positive(b.maxCapacity);
  return compact({
    present: true,
    designCapacityWh: toWh(design, b.capacityUnit),
    fullChargeCapacityWh: toWh(full, b.capacityUnit),
    healthPercent: design && full ? round((full / design) * 100) : undefined,
    cycleCount: typeof b.cycleCount === "number" && b.cycleCount >= 0 ? b.cycleCount : undefined,
  });
}

export function mapSpecs(raw: RawSpecs): SpecsPayload {
  const display = (raw.graphics.displays ?? []).find((d) => positive(d.resolutionX));
  const diagonalCm =
    display && positive(display.sizeX) && positive(display.sizeY)
      ? Math.hypot(display.sizeX as number, display.sizeY as number)
      : undefined;

  const modules = raw.memLayout
    .filter((m) => positive(m.size))
    .map((m) =>
      compact({
        slot: clean(m.bank),
        sizeBytes: positive(m.size),
        type: clean(m.type),
        speedMHz: positive(m.clockSpeed),
        manufacturer: clean(m.manufacturer),
        partNumber: clean(m.partNum),
        serial: clean(m.serialNum),
      }),
    );

  return compact({
    bios: compact({ vendor: clean(raw.bios.vendor), version: clean(raw.bios.version), releaseDate: clean(raw.bios.releaseDate) }),
    baseboard: compact({
      manufacturer: clean(raw.baseboard.manufacturer),
      model: clean(raw.baseboard.model),
      serial: clean(raw.baseboard.serial),
    }),
    cpu: compact({
      manufacturer: clean(raw.cpu.manufacturer),
      brand: clean(raw.cpu.brand),
      cores: positive(raw.cpu.cores),
      physicalCores: positive(raw.cpu.physicalCores),
      speedGHz: positive(raw.cpu.speed),
      arch: clean(raw.osInfo.arch),
    }),
    memory: compact({ totalBytes: positive(raw.mem.total), modules }),
    disks: mapDisks(raw.diskLayout),
    graphics: (raw.graphics.controllers ?? [])
      .filter((g) => clean(g.model))
      .map((g) => compact({ vendor: clean(g.vendor), model: clean(g.model), vramMB: positive(g.vram) })),
    display: display
      ? compact({
          resolutionX: positive(display.resolutionX),
          resolutionY: positive(display.resolutionY),
          sizeInches: diagonalCm ? round(diagonalCm / 2.54) : undefined,
        })
      : undefined,
    battery: mapBattery(raw.battery),
    network: raw.network
      .filter((n) => !n.internal && !n.virtual && (n.type === "wired" || n.type === "wireless"))
      .map((n) => compact({ name: clean(n.ifaceName) ?? clean(n.iface), type: n.type as "wired" | "wireless", mac: clean(n.mac) })),
    os: compact({ platform: clean(raw.osInfo.platform), distro: clean(raw.osInfo.distro), release: clean(raw.osInfo.release) }),
  });
}

/** Turns raw systeminformation output into a schema-valid device record. Pure: no I/O. */
export function buildRecord(raw: RawSpecs, ctx: RunContext): DeviceRecord {
  const messages: string[] = [];
  let status: RunStatus = "pass";

  const manufacturer = clean(raw.system.manufacturer) ?? clean(raw.baseboard.manufacturer);
  const serialNumber = clean(raw.system.serial) ?? clean(raw.chassis.serial) ?? clean(raw.baseboard.serial);
  const systemUuid = clean(raw.system.uuid)?.toLowerCase();
  const payload = mapSpecs(raw);
  const internalDisk = payload.disks?.find((d) => d.interface !== "usb");

  const identity = deviceId({
    manufacturer,
    serialNumber,
    systemUuid,
    fallbackDiskSerial: internalDisk?.serial,
    osMachineId: clean(raw.osInfo.serial),
  });

  let id: string;
  if (!identity) {
    status = "error";
    messages.push("No serial number, UUID, disk serial or machine ID found; device cannot be identified.");
    id = `unidentified-${ctx.recordId}`;
  } else {
    id = identity.id;
    if (identity.source !== "system") {
      status = "warning";
      messages.push(`Firmware reports no serial number or UUID; device ID taken from ${identity.source === "disk" ? "the first internal disk serial" : "the OS machine ID"}.`);
    }
  }

  if (raw.system.virtual) messages.push(`Running in a virtual machine (${raw.system.virtualHost ?? "unknown host"}).`);

  return {
    schemaVersion: "1.0",
    recordId: ctx.recordId,
    device: compact({
      id,
      serialNumber,
      systemUuid,
      manufacturer,
      model: clean(raw.system.model),
      sku: clean(raw.system.sku),
      chassisType: clean(raw.chassis.type),
      assetTag: clean(ctx.assetTag) ?? clean(raw.chassis.assetTag),
    }),
    tool: compact({ name: "specs", version: ctx.toolVersion, os: ctx.os, arch: ctx.arch, bootEnv: ctx.bootEnv }),
    run: compact({
      startedAt: ctx.startedAt,
      finishedAt: ctx.finishedAt,
      status,
      operator: clean(ctx.operator),
      station: clean(ctx.station),
      messages: messages.length ? messages : undefined,
    }),
    kind: "specs",
    payload,
  };
}
