import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tmp = mkdtempSync(join(tmpdir(), "probe-"));
await extractPack("D:/Foundry VTT/Foundry User Data/Data/worlds/iz-pepla/data/actors", tmp, {});
const files = readdirSync(tmp).filter(f => f.endsWith(".json"));
const outDir = "tools/_world-vehicles";
mkdirSync(outDir, { recursive: true });
const ids = ["FuseMRZ5pH7dTNRl","lohphDdEf4ssvnCL","DShyVrIWXbnetvgG","PmVQldPUqmwkYQ8I","9fGYTzKP47IDrVpK","JRr0bUsGJgefwgkh","CEPZbRLuAQVE79og","BqP8YgB1hI4eSq8I","SBdOVLjQieG6iiRg","2mVVxkj1NWtG0uxc"];
for (const f of files) {
  const doc = JSON.parse(readFileSync(join(tmp, f), "utf8"));
  if (ids.includes(doc._id)) {
    writeFileSync(join(outDir, `${doc._id}.json`), JSON.stringify(doc, null, 1) + "\n", "utf8");
  }
}
console.log("done");
