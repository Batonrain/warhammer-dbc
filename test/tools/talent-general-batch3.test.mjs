// test/tools/talent-general-batch3.test.mjs
//
// Шаг 3, общие Таланты, пачка 3 (19.11.2026):
//  • Пути Силы Инкантация/Медитация/Телесная Конверсия/Жертва открываются
//    только своим Талантом (sheets/tabs/psychic.mjs::pathAvailable);
//  • Дар «Завеса Тьмы» даёт −20 атакам по Одержимому, пока демон проявлен;
//  • записи Конструктора пачки — каждая даёт правило с областью или
//    возможность из реестра.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PSY_PATHS } from "../../module/constants/psyker.mjs";
import { pathAvailable } from "../../module/sheets/tabs/psychic.mjs";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";
import { manifestedGift } from "../../module/rules/predicates.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const talent = name => ({ id: name, name, type: "talent", system: {} });

describe("Пути Силы за Талантом", () => {
  const cases = [
    ["incantation", "Blasphemous Incantation / Богохульная Инкантация"],
    ["meditation",  "Meditation / Медитация"],
    ["corpus",      "Corpus Conversion / Телесная Конверсия"],
    ["sacrifice",   "Sacrifice / Жертва"]
  ];
  for (const [key, name] of cases) {
    it(`${PSY_PATHS[key].label}: без Таланта закрыт, с Талантом открыт`, () => {
      expect(pathAvailable({ items: [] }, PSY_PATHS[key])).toBe(false);
      expect(pathAvailable({ items: [talent(name)] }, PSY_PATHS[key])).toBe(true);
    });
  }
  it("Пути без Таланта-ключа видны всем, как прежде", () => {
    for (const key of ["", "psychofocus", "unholy", "familiar", "personal", "choir"]) {
      expect(pathAvailable({ items: [] }, PSY_PATHS[key])).toBe(true);
    }
  });
});

describe("Дар «Завеса Тьмы»", () => {
  const veil = { id: "v", name: "Veil of Darkness / Дар: Завеса Тьмы", type: "talent", system: {} };
  const possessed = manifested => ({ items: [veil], system: { possessed: true, possession: { manifested } } });
  const row = tgt => situationalMods({
    actor: { items: [], system: {} }, attackCtx: { targetActor: tgt }, attackerToken: null, gripRange: 100,
    hasFatigue: false, hasLostEyes: false, isBlinded: false, isMelee: false, measured: { edgeM: 10 },
    targetHelpless: false, targetToken: null, weapon: null, wProps: [], wp: {}
  }).commonMods.find(m => /Завеса Тьмы/.test(m.label));

  it("действует только в Проявлении", () => {
    expect(manifestedGift(possessed(true), "Завеса Тьмы")).toBe(true);
    expect(manifestedGift(possessed(false), "Завеса Тьмы")).toBe(false);
    expect(manifestedGift({ items: [veil], system: { possession: { manifested: true } } }, "Завеса Тьмы")).toBe(false);
  });
  it("окно атаки само ставит −20", () => {
    expect(row(possessed(true))).toMatchObject({ value: -20, autoCheck: true });
    expect(row(possessed(false))).toBeUndefined();
  });
});

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []);
}
const docs = walk(path.join(ROOT, "packs-src", "talents"))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8")))
  .filter(d => /^(Частично реализовано|Реализовано) \(19\.11\.2026\)/.test(d.system?.notes ?? ""));
const asItem = d => ({ id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags });

describe("пачка 3: записи Конструктора", () => {
  it("записи нашлись", () => expect(docs.length).toBeGreaterThanOrEqual(10));
  for (const d of docs) {
    const entries = (d.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);
    if (!entries.length) continue;
    it(`${d.name}: запись работает`, () => {
      for (const e of entries) {
        if (e.kind === "capability") expect(CAPABILITIES[e.capabilityKey]?.reader).toBeTruthy();
        if (e.kind === "poolMax") expect(Number(e.value)).not.toBeNaN();
      }
      const rolls = entries.filter(e => e.kind === "testMod" || e.kind === "reroll");
      if (!rolls.length) return;
      const effects = rulesFromItemMechanics([asItem(d)]).flatMap(r => r.effects ?? [])
        .filter(fx => fx.kind === "rollBonus" || fx.kind === "rollMode");
      expect(effects.length).toBe(rolls.length);
      for (const fx of effects) {
        expect(fx.target).toBeTruthy();
        expect(fx.auto).not.toBe(true);
      }
    });
  }
});

describe("Дар «Крылья»: Flyer (A.b×2) в Проявлении", async () => {
  const { WarhammerActor } = await import("../../module/documents/actor.mjs");
  const { ACTOR_DATA_MODELS } = await import("../../module/data/index.mjs");
  const { actorCanFly, actorHasFlyer } = await import("../../module/combat/movement-actions.mjs");
  const wings = { id: "w", name: "Wings / Дар: Крылья", type: "talent", system: {}, flags: {}, getFlag: () => undefined };
  function prepared({ manifested, altitude }) {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.characteristics.ag.base = 35;
    system.possessed = true;
    system.possession = { ...(system.possession ?? {}), manifested };
    system.movement.altitude = altitude;
    const list = [wings];
    list.get = id => list.find(i => i.id === id) ?? null;
    const actor = { type: "character", name: "Одержимый", system, items: list, getFlag: () => undefined };
    WarhammerActor.prototype.prepareDerivedData.call(actor);
    return { actor, system };
  }

  it("в Проявлении летает (Flyer), без Проявления — нет", () => {
    expect(actorHasFlyer(prepared({ manifested: true, altitude: "landed" }).actor)).toBe(true);
    expect(actorCanFly(prepared({ manifested: false, altitude: "landed" }).actor)).toBe(false);
  });
  it("в воздухе SPD = A.b×2", () => {
    const { system } = prepared({ manifested: true, altitude: "low" });
    expect(system.movement.halfMove).toBe(6);
  });
});
