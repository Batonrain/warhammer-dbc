// dbc-114 (14.11.2026), пачка 4: расовые Черты на готовых способностях. Фикстуры — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const caps = prefix => docs.find(j => (j.name || "").startsWith(prefix))
  .flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey).filter(Boolean);

const CASES = {
  "Sslyth Physiology / ": ["poison.immune", "drugs.afterEffectAddictionImmune", "healing.astartes", "healing.extraWoundDaily", "bleeding.selfStanchTurnStart", "defence.tortureImmune"],
  "Distorted Body / ": ["defence.diseaseEffectsImmune", "healing.astartes"],
  "Drasii / ": ["fear.immune"],
  "The Reborn / ": ["fear.immune", "suppression.immune", "defence.tortureImmune"]
};

describe("расовые Черты выдают способности, у каждой есть читатель", () => {
  for (const [prefix, keys] of Object.entries(CASES)) {
    it(prefix, () => {
      const have = caps(prefix);
      for (const k of keys) {
        expect(have, k).toContain(k);
        expect(CAPABILITIES[k]?.reader, k).toBeTruthy();
      }
    });
  }
  it("Физиология Сслита сохранила +15 к максимуму Ран", () => {
    const d = docs.find(j => (j.name || "").startsWith("Sslyth Physiology / "));
    const w = d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "wounds");
    expect(Number(w.woundsValue)).toBe(15);
  });
});
