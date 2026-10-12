import si from "systeminformation";
import type { RawSpecs } from "./map";

/** Reads everything the specs tool needs. Each probe is independent, so one failure doesn't sink the rest. */
export async function collectRaw(): Promise<{ raw: RawSpecs; errors: string[] }> {
  const errors: string[] = [];
  const probe = async <T, F>(name: string, fn: () => Promise<T>, fallback: F): Promise<T | F> => {
    try {
      return await fn();
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  };

  const [system, bios, baseboard, chassis, cpu, mem, memLayout, diskLayout, graphics, battery, network, osInfo] =
    await Promise.all([
      probe("system", () => si.system(), {}),
      probe("bios", () => si.bios(), {}),
      probe("baseboard", () => si.baseboard(), {}),
      probe("chassis", () => si.chassis(), {}),
      probe("cpu", () => si.cpu(), {}),
      probe("mem", () => si.mem(), {}),
      probe("memLayout", () => si.memLayout(), []),
      probe("diskLayout", () => si.diskLayout(), []),
      probe("graphics", () => si.graphics(), {}),
      probe("battery", () => si.battery(), {}),
      probe("network", async () => {
        const n = await si.networkInterfaces();
        return Array.isArray(n) ? n : [n];
      }, []),
      probe("osInfo", () => si.osInfo(), {}),
    ]);

  return {
    raw: { system, bios, baseboard, chassis, cpu, mem, memLayout, diskLayout, graphics, battery, network, osInfo },
    errors,
  };
}
