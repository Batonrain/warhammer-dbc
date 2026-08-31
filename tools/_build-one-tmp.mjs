import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { mkdirSync, rmSync } from "node:fs";
import { abs, isPacksBusy, reportBusy } from "./packs.mjs";

const name = "weapon-properties";
const src = abs(`packs-src/${name}`);
const dir = abs(`packs/${name}`);

try {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let docs = 0;
  await compilePack(src, dir, { recursive: true, transformEntry: () => { docs++; } });
  console.log(`OK: ${name} — ${docs} документов`);
} catch (e) {
  if (isPacksBusy(e)) { reportBusy(e, "собрать"); process.exit(1); }
  throw e;
}
