// test/rules/astartes-archetype-traits.test.mjs
//
// Черты Архетипов Космодесанта — чистые части механики (module/rules/):
// Огневая Точка (Хавок), Хирургия Легиона (Апотекарий), Экстренное
// Обслуживание (Технодесантник), Наскрести (Изгой), Чародей. Фикстуры Черт —
// настоящие JSON из packs-src: зелёный тест должен доказывать, что
// возможность действительно едет с Чертой, а не с выдуманным предметом.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  FIRE_POINT_FLAG, hasFirePoint, firePointActive, firePointFreeReroll,
  firePointActivatesOnPaidReroll, firePointAfterMove, firePointBreaksOnProne
} from "../../module/rules/fire-point.mjs";
import {
  SUS_AN_ACTIVE_FLAG, hasLegionSurgery, legionSurgeryTestEligible,
  legionSurgeryCanRescue, susAnWakeEligible
} from "../../module/rules/legion-surgery.mjs";
import {
  emergencyRepairCandidates, emergencyRepairPatch, EMERGENCY_MAINTENANCE_AP
} from "../../module/rules/emergency-maintenance.mjs";
import {
  SCROUNGE_DICE, SCROUNGE_MAX_AVAILABILITY, SCROUNGE_CATEGORIES, scroungeRemaining, scroungeFilters
} from "../../module/rules/scrounge.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const TRAITS = "packs-src/traits";
const FIRE_POINT_DOC = packDocById(TRAITS, "TGEdkKpPOKT6NizT");
const LEGION_SURGERY_DOC = packDocById(TRAITS, "jD1tJ0ugyhBQTWFI");
const EMERGENCY_DOC = packDocById(TRAITS, "X7zrXQAgffpBBMB4");
const SCROUNGE_DOC = packDocById(TRAITS, "BxTXrLnoq8pejHWI");
const SORCERER_DOC = packDocById(TRAITS, "UaBIF5zGdLShyKVX");

const asItem = (doc, id = "t1") => ({ id, name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });

function actor({ traits = [], flags = {}, conditions = {}, wounds = {}, items = [], system = {} } = {}) {
  const all = [...traits.map((d, i) => asItem(d, `t${i}`)), ...items];
  return {
    id: "a1", type: "character",
    system: { conditions, wounds, ...system },
    flags: { "warhammer-dbc": flags },
    items: Object.assign([...all], { contents: all, get: id => all.find(i => i.id === id) })
  };
}

const entries = doc => (doc.flags?.["warhammer-dbc"]?.mechanics || []).flatMap(g => g.entries);

describe("Огневая Точка (Хавок)", () => {
  const withTrait = (o = {}) => actor({ traits: [FIRE_POINT_DOC], ...o });

  it("Черта из пака несёт возможность; без Черты — нет", () => {
    expect(hasFirePoint(withTrait())).toBe(true);
    expect(hasFirePoint(actor())).toBe(false);
  });

  it("точка занята только при включённом состоянии и не Повален", () => {
    expect(firePointActive(withTrait())).toBe(false);
    expect(firePointActive(withTrait({ flags: { [FIRE_POINT_FLAG]: { active: true } } }))).toBe(true);
    expect(firePointActive(withTrait({ flags: { [FIRE_POINT_FLAG]: { active: true } }, conditions: { prone: true } }))).toBe(false);
    // Состояние без Черты (Черту сняли) — не действует.
    expect(firePointActive(actor({ flags: { [FIRE_POINT_FLAG]: { active: true } } }))).toBe(false);
  });

  it("бесплатный переброс — только стрелковая и ещё не переброшенная атака", () => {
    const a = withTrait({ flags: { [FIRE_POINT_FLAG]: { active: true } } });
    expect(firePointFreeReroll(a, { isMelee: false, rerolled: false })).toBe(true);
    expect(firePointFreeReroll(a, { isMelee: true, rerolled: false })).toBe(false);
    expect(firePointFreeReroll(a, { isMelee: false, rerolled: true })).toBe(false);
    expect(firePointFreeReroll(withTrait(), { isMelee: false })).toBe(false);
  });

  it("переброс стрелковой атаки за Очко занимает точку; рукопашной — нет", () => {
    expect(firePointActivatesOnPaidReroll(withTrait(), { isMelee: false })).toBe(true);
    expect(firePointActivatesOnPaidReroll(withTrait(), { isMelee: true })).toBe(false);
    expect(firePointActivatesOnPaidReroll(actor(), { isMelee: false })).toBe(false);
  });

  it("сдвиг гасит точку, Отскок — нет, без сдвига ничего не меняется", () => {
    expect(firePointAfterMove({ active: true }, true)).toBe("break");
    expect(firePointAfterMove({ active: true, recoil: true }, true)).toBe("reanchor");
    expect(firePointAfterMove({ active: true }, false)).toBe("keep");
    expect(firePointAfterMove(null, true)).toBe("keep");
  });

  it("залёг или сбит с ног — точка потеряна", () => {
    expect(firePointBreaksOnProne({ active: true }, true)).toBe(true);
    expect(firePointBreaksOnProne({ active: true }, false)).toBe(false);
    expect(firePointBreaksOnProne(null, true)).toBe(false);
  });
});

describe("Хирургия Легиона (Апотекарий)", () => {
  it("Черта из пака несёт возможность", () => {
    expect(hasLegionSurgery(actor({ traits: [LEGION_SURGERY_DOC] }))).toBe(true);
    expect(hasLegionSurgery(actor())).toBe(false);
  });

  it("тест «на лечение или геносемя»: Medicae и For.Lore (Astartes Implants)", () => {
    expect(legionSurgeryTestEligible({ skill: "medicae" })).toBe(true);
    expect(legionSurgeryTestEligible({ group: "forbiddenLore", specialty: "Astartes Implants" })).toBe(true);
    expect(legionSurgeryTestEligible({ group: "forbiddenLore", specialty: "Импланты Астартес" })).toBe(true);
    expect(legionSurgeryTestEligible({ group: "forbiddenLore", specialty: "Daemons" })).toBe(false);
    expect(legionSurgeryTestEligible({ skill: "techUse" })).toBe(false);
    expect(legionSurgeryTestEligible()).toBe(false);
  });

  it("предлагается только при провале и с Чертой", () => {
    const medic = actor({ traits: [LEGION_SURGERY_DOC] });
    expect(legionSurgeryCanRescue(medic, false)).toBe(true);
    expect(legionSurgeryCanRescue(medic, true)).toBe(false);
    expect(legionSurgeryCanRescue(actor(), false)).toBe(false);
  });

  it("пробуждение: Замедленная Анимация и Раны не ниже −7", () => {
    const patient = crit => actor({ flags: { [SUS_AN_ACTIVE_FLAG]: true }, conditions: { unconscious: true }, wounds: { critical: crit } });
    expect(susAnWakeEligible(patient(7))).toBe(true);
    expect(susAnWakeEligible(patient(0))).toBe(true);
    expect(susAnWakeEligible(patient(8))).toBe(false);
    // Без метки Анимации (обычный обморок) — нет; очнулся сам — нет.
    expect(susAnWakeEligible(actor({ conditions: { unconscious: true }, wounds: { critical: 3 } }))).toBe(false);
    expect(susAnWakeEligible(actor({ flags: { [SUS_AN_ACTIVE_FLAG]: true }, wounds: { critical: 3 } }))).toBe(false);
  });
});

describe("Экстренное Обслуживание (Технодесантник)", () => {
  const damaged = () => actor({
    system: { armorCorrosion: { head: 0, body: 3, leftArm: 0, rightArm: 1, leftLeg: 0, rightLeg: 0 } },
    items: [
      { id: "w1", name: "Болтер", type: "weapon", system: { jammed: true, destroyed: false } },
      { id: "w2", name: "Цепной меч", type: "weapon", system: { jammed: false, destroyed: true } },
      { id: "w3", name: "Целый", type: "weapon", system: {} },
      { id: "f1", name: "Щит", type: "forcefield", system: { status: "overloaded" } },
      { id: "f2", name: "Рабочий щит", type: "forcefield", system: { status: "active" } },
      { id: "i1", name: "Латы", type: "implant", system: { shield: { enabled: true, status: "damaged" } } }
    ]
  });

  it("полное действие — 2 ОД", () => {
    expect(EMERGENCY_MAINTENANCE_AP).toBe(2);
  });

  it("находит всё, что система ведёт как повреждение", () => {
    const keys = emergencyRepairCandidates(damaged()).map(c => c.key);
    expect(keys).toEqual(["corrosion:body", "corrosion:rightArm", "jam:w1", "destroyed:w2", "shield:f1", "shield:i1"]);
    expect(emergencyRepairCandidates(actor())).toEqual([]);
  });

  it("каждое повреждение чинится своей правкой", () => {
    const a = damaged();
    const byKey = Object.fromEntries(emergencyRepairCandidates(a).map(c => [c.key, emergencyRepairPatch(a, c)]));
    expect(byKey["corrosion:body"]).toEqual({ target: "actor", update: { "system.armorCorrosion.body": 0 } });
    expect(byKey["jam:w1"]).toEqual({ target: "item", itemId: "w1", update: { "system.jammed": false, "system.jamLockedRound": 0 } });
    expect(byKey["destroyed:w2"]).toEqual({ target: "item", itemId: "w2", update: { "system.destroyed": false } });
    expect(byKey["shield:f1"].update).toEqual({ "system.status": "inactive", "system.equipped": false, "system.currentRating": 0 });
    expect(byKey["shield:i1"].update).toEqual({ "system.shield.status": "inactive", "system.shield.equipped": false, "system.shield.currentRating": 0 });
    expect(emergencyRepairPatch(a, { kind: "???" })).toBe(null);
  });

  it("Черта из пака несёт кнопку за 1 Очко Бесчестия", () => {
    const script = entries(EMERGENCY_DOC).find(e => e.kind === "script");
    expect(script?.capabilityCostPool).toBe("infamy");
    expect(Number(script?.capabilityCostAmount)).toBe(1);
    expect(script.code).toMatch(/emergencyMaintenance\(/);
  });
});

describe("Наскрести (Изгой)", () => {
  it("2d10 расходников до R2 из трёх книжных категорий", () => {
    expect(SCROUNGE_DICE).toBe("2d10");
    expect(SCROUNGE_MAX_AVAILABILITY).toBe(2);
    expect(SCROUNGE_CATEGORIES.map(c => c.pack)).toEqual(["ammunition", "weapons", "chemistry"]);
  });

  it("остаток не уходит ниже нуля; фильтр гранат — по папкам", () => {
    expect(scroungeRemaining(12, 5)).toBe(7);
    expect(scroungeRemaining(3, 5)).toBe(0);
    expect(scroungeFilters(SCROUNGE_CATEGORIES[1])).toEqual({ maxAvailability: 2, folderId: ["CiKyTXQv7N6C3J3A", "1F41DWSJB405tFwp"] });
    expect(scroungeFilters(SCROUNGE_CATEGORIES[0])).toEqual({ maxAvailability: 2 });
  });

  it("Черта из пака несёт кнопку за 1 Очко Бесчестия", () => {
    const script = entries(SCROUNGE_DOC).find(e => e.kind === "script");
    expect(script?.capabilityCostPool).toBe("infamy");
    expect(Number(script?.capabilityCostAmount)).toBe(1);
    expect(script.code).toMatch(/scroungeSupplies\(/);
  });
});

describe("Чародей", () => {
  it("Черта сама делает псайкера Связанным (psyker.alwaysBound)", () => {
    expect(hasRuleFlag(actor({ traits: [SORCERER_DOC] }), "psyker.alwaysBound")).toBe(true);
  });
});
