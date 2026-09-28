// test/data/archetypes-human-1-vs-book.test.mjs
//
// Архетипы Людей против книги (корбук, глава I, сверка 28.09.2026):
// Отступник, Демонолог (ключ heresiarch), Ренегат, Пират. Строки книги
// выписаны литералами рядом с проверкой — расхождение пака с книгой должно
// падать здесь, а не всплывать за столом (wdbc-dzzr: число и книжная строка
// заводятся вместе).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ARCHETYPES } from "../../module/constants/archetypes.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR = path.join(ROOT, "packs-src/archetypes/Люди");
const TRAITS = path.join(ROOT, "packs-src/traits");

const byKey = key => {
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith(".json") || f === "_Folder.json") continue;
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    if (d.system?.key === key) return d;
  }
  throw new Error(`нет архетипа ${key}`);
};
const traitById = id => {
  const f = fs.readdirSync(TRAITS).find(n => n.endsWith(`_${id}.json`));
  return JSON.parse(fs.readFileSync(path.join(TRAITS, f), "utf8"));
};
const groups = d => d.flags["warhammer-dbc"].mechanics;
const entries = d => groups(d).flatMap(g => g.entries);
const talentNames = g => g.entries.filter(e => e.kind === "talent").map(e => e.sourceName.split(" / ")[0]);
const orTalentSets = d => groups(d).filter(g => g.operator === "OR" && g.entries.every(e => e.kind === "talent"))
  .map(g => talentNames(g).join(" | "));
const capKeys = d => entries(d).filter(e => e.kind === "capability").map(e => e.capabilityKey);

const KEYS = ["apostate", "heresiarch", "renegade", "pirate"];

describe("Архетипы Людей (глава I) — данные пака против книги", () => {
  it("Ренегат: Melee Training (любые 2), Weapon Training (любые 5)", () => {
    const d = byKey("renegade");
    const spec = n => entries(d).find(e => e.kind === "talent" && e.sourceName.startsWith(n))?.specialization;
    expect(spec("Melee Training")).toBe("любые 2");
    expect(spec("Weapon Training")).toBe("любые 5");
  });

  it("Ренегат: группы «или» Талантов — как в книге", () => {
    expect(orTalentSets(byKey("renegade"))).toEqual([
      "Catfall | Combat Sense",
      "Chamber In | Double Tap | Trick Shooter",
      "Sure Strike | Deadeye Shot | Marksman",
      "Double Team | Disarm | Takedown",
      "Two Weapon Wielder | Hip Shooting",
      "Bayonet Charge | Covering Fire",
      "Dragoon | Tracking Aim"
    ]);
  });

  it("Отступник: «Full Flak Armour или Mesh Armour» — без Качества", () => {
    const flak = entries(byKey("apostate")).find(e => e.kind === "equipment" && /Full Flak/.test(e.equipSourceName));
    expect(flak.equipQuality).toBe("common");
  });

  it("Демонолог: имя по книге, ключ прежний, Черта — Ведун Тьмы, цели Hatred/Peer", () => {
    const d = byKey("heresiarch");
    expect(d.name).toBe("Heresiarch / Демонолог");
    expect(d.system.trait.name).toBe("Dark Seer / Ведун Тьмы");
    const hat = entries(d).find(e => e.kind === "talent" && e.sourceName.startsWith("Hatred"));
    expect(hat.specialization).toBe("Ecclesiarchy");
    expect(hat.targets.map(t => t.ref)).toEqual(["ecclesiarchy"]);
    const peer = entries(d).find(e => e.kind === "talent" && e.sourceName.startsWith("Peer"));
    expect(peer.targets.map(t => t.value)).toContain("daemon");
    const daemons = entries(d).find(e => e.kind === "skill" && e.specKey === "daemons");
    expect(daemons.rank).toBe("veteran"); // For. Lore (Daemons)+20
  });

  it("Черта Архетипа: запись Конструктора ведёт на документ с тем же именем и книжным текстом", () => {
    for (const key of KEYS) {
      const d = byKey(key);
      const tr = entries(d).find(e => e.kind === "trait");
      const doc = traitById(tr.sourceUuid.split(".").pop());
      expect(doc.name, key).toBe(d.system.trait.name);
      expect(tr.sourceName, key).toBe(doc.name);
      expect(doc.system.benefit, key).toBe(d.system.trait.benefit);
    }
  });

  it("Черты несут свои возможности (иначе механика молчит)", () => {
    const traitOf = key => {
      const tr = entries(byKey(key)).find(e => e.kind === "trait");
      return traitById(tr.sourceUuid.split(".").pop());
    };
    expect(capKeys(traitOf("apostate"))).toEqual(["trait.serpentSTongue", "minion.ignoreInfamy.human"]);
    expect(capKeys(traitOf("heresiarch"))).toEqual(["trait.darkSeer", "minion.ignoreInfamy.daemon"]);
    expect(capKeys(traitOf("renegade"))).toEqual(["trait.adroit"]);
    expect(capKeys(traitOf("pirate"))).toEqual(["trait.takeEverything"]);
  });

  it("резерв-константы совпадают с паком (имя, снаряжение, Черта, Раны, бонусы)", () => {
    for (const key of KEYS) {
      const d = byKey(key), c = ARCHETYPES[key];
      expect(d.name.split(" / ")[1], key).toBe(c.name);
      expect(d.system.gear, key).toBe(c.gear);
      expect(d.system.trait, key).toEqual(c.trait);
      expect(d.system.wounds, key).toBe(c.wounds);
      expect(d.system.charBonus, key).toEqual(c.charBonus);
      expect(d.system.description, key).toBe(c.desc);
    }
  });

  it("снаряжение — строки книги через запятую, выбор словом «или»", () => {
    const rows = key => byKey(key).system.gear.split(/,\s(?![^(]*\))/);
    expect(rows("apostate")).toHaveLength(5);
    expect(rows("heresiarch")).toHaveLength(6);
    expect(rows("renegade")).toHaveLength(9);
    expect(rows("pirate")).toHaveLength(8);
    for (const key of KEYS) expect(byKey(key).system.gear, key).not.toMatch(/\//);
  });
});
