// dbc-10: условие «носит Терминаторскую броню» для Чемпиона-Терминатора.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PREDICATES, wearsTerminatorArmour } from "../../module/rules/predicates.mjs";

const armor = (name, equipped = true) => ({ type: "armor", name, system: { equipped } });
const actorWith = (...items) => ({ items });
const DIR = path.resolve(import.meta.dirname, "../../packs-src/armor/Астартес/Броня/Терминаторская");

describe("wearsTerminatorArmour", () => {
  it("все пять книжных образцов из папки пака распознаются", () => {
    const files = fs.readdirSync(DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));
    expect(files.length).toBe(5);
    for (const f of files) {
      const doc = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
      expect(wearsTerminatorArmour(actorWith(armor(doc.name))), doc.name).toBe(true);
    }
  });
  it("снятая, обычная и силовая не-терминаторская броня не считаются", () => {
    expect(wearsTerminatorArmour(actorWith(armor("Mk VII Aquila / Мк VII Аквила")))).toBe(false);
    expect(wearsTerminatorArmour(actorWith(armor("Mk IV Tartaros / Мк IV Тартарос", false)))).toBe(false);
    expect(wearsTerminatorArmour(actorWith())).toBe(false);
  });
  it("в реестре условий; false — «без Терминаторской брони»", () => {
    const a = actorWith(armor("Terminator Aegis / Терминатор Эгида"));
    expect(PREDICATES.wearsTerminatorArmour(a, {}, true)).toBe(true);
    expect(PREDICATES.wearsTerminatorArmour(a, {}, false)).toBe(false);
  });
});
