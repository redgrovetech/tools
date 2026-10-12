// Builds standalone `specs` executables. Usage: bun scripts/build.ts [target ...]
import { $ } from "bun";
import pkg from "../package.json";

const ALL = ["linux-x64", "linux-arm64", "windows-x64", "windows-arm64", "darwin-arm64"];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

for (const t of targets) {
  const ext = t.startsWith("windows") ? ".exe" : "";
  const out = `dist/specs-${pkg.version}-${t}${ext}`;
  console.log(`building ${out}`);
  await $`bun build src/cli.ts --compile --minify --target=bun-${t} --outfile ${out}`;
}
