// test/combat/discordant-field-tails.test.mjs
//
// Хвосты поля Дискорданта (task-be12): заклинивание механики через 1d5+1 Ходов,
// силовая броня гаснет и включается обратно, биоорганы, медицина, исключения.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  fieldJamTick, fieldJammableWeapons, isFieldExemptWeapon, weaponTechClass, fieldDisablesWeapon,
  hasFieldBioOrgans, fieldBioStep, FIELD_JAM_FLAG, FIELD_ARMOUR_OFF_FLAG
} from "../../module/rules/null-zones.mjs";
import { onFieldMarkCreated, onFieldMarkDeleted, fieldTurnStart } from "../../module/combat/discordant-field.mjs";
import { NULL_ZONE_RULES } from "../../module/rules/library/null-zones.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";

const FIELD = packDocById("packs-src/traits/Трейты_рас", "DiscordFieldZn01");

function makeActor({ items = [], inField = true } = {}) {
  const list = items.map(i => ({ ...i, system: { ...i.system } }));
  const all = inField ? [...list, { id: "mark", name: FIELD.name, type: "trait", system: FIELD.system, flags: FIELD.flags }] : list;
  const flags = {};
  const a = {
    id: "A", uuid: "Actor.A", name: "Боец", type: "character",
    system: { characteristics: { t: { total: 40, bonus: 4 } } },
    items: Object.assign(all, { get: id => all.find(i => i.id === id), contents: all }),
    flags: { "warhammer-dbc": flags },
    getFlag: (_s, k) => flags[k],
    update: async data => {
      for (const [p, v] of Object.entries(data)) {
        const m = p.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = v; }
      }
    },
    updateEmbeddedDocuments: async (_t, ups) => {
      for (const u of ups) {
        const it = all.find(i => i.id === u._id);
        for (const [k, v] of Object.entries(u)) if (k.startsWith("system.")) it.system[k.slice(7)] = v;
      }
    }
  };
  return a;
}

const bolter = { id: "w1", name: "Болтер", type: "weapon", system: { techClass: "mechanical" } };
const lasgun = { id: "w2", name: "Лазган", type: "weapon", system: { techClass: "electric" } };
const relic = { id: "w3", name: "Наследие", type: "weapon", system: { techClass: "electric", legacy: { active: true } } };
const daemonBolter = { id: "w4", name: "Демонболтер", type: "weapon", system: { techClass: "mechanical", daemonWeapon: { bound: true } } };
const pa = { id: "a1", name: "Силовая броня", type: "armor", system: { armorType: "power", equipped: true, active: true } };

beforeEach(() => resetCaptured());

describe("заклинивание механики", () => {
  it("счётчик: убывает и на нуле клинит", () => {
    expect(fieldJamTick(3)).toEqual({ remaining: 2, jamNow: false });
    expect(fieldJamTick(1)).toEqual({ remaining: null, jamNow: true });
    expect(fieldJamTick(null)).toEqual({ remaining: null, jamNow: false });
  });
  it("клинит только механика и не исключённая", () => {
    const a = makeActor({ items: [bolter, lasgun, daemonBolter] });
    expect(fieldJammableWeapons(a).map(i => i.id)).toEqual(["w1"]);
  });
  it("вход: бросок 1d5+1, Ход за Ходом — заклинило", async () => {
    const a = makeActor({ items: [bolter, pa] });
    captured.nextRoll = 2;
    await onFieldMarkCreated(a.items.find(i => i.id === "mark") && { ...a.items.find(i => i.id === "mark"), parent: a });
    expect(a.getFlag(null, FIELD_JAM_FLAG)).toBe(2);
    // Силовая броня отключена и запомнена
    expect(a.items.get("a1").system.active).toBe(false);
    expect(a.getFlag(null, FIELD_ARMOUR_OFF_FLAG)).toEqual(["a1"]);
    await fieldTurnStart(a);
    expect(a.getFlag(null, FIELD_JAM_FLAG)).toBe(1);
    expect(a.items.get("w1").system.jammed).toBeFalsy();
    await fieldTurnStart(a);
    expect(a.items.get("w1").system.jammed).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Заклинило");
  });
  it("выход: броня включается обратно, счётчик сброшен", async () => {
    const out = makeActor({ items: [bolter, { ...pa, system: { ...pa.system, active: false } }], inField: false });
    await out.update({ [`flags.warhammer-dbc.${FIELD_JAM_FLAG}`]: 3, [`flags.warhammer-dbc.${FIELD_ARMOUR_OFF_FLAG}`]: ["a1"] });
    await onFieldMarkDeleted({ id: "mark", name: FIELD.name, type: "trait", parent: out });
    expect(out.items.get("a1").system.active).toBe(true);
    expect(out.getFlag(null, FIELD_JAM_FLAG)).toBeUndefined();
  });
});

describe("исключения поля", () => {
  it("Наследие и демоническое оружие поле не берёт", () => {
    expect(isFieldExemptWeapon(relic)).toBe(true);
    expect(weaponTechClass(relic)).toBe("electric");   // класс не меняется — его читает и Саботаж
    expect(fieldDisablesWeapon(makeActor(), relic)).toBe(false);
    expect(fieldDisablesWeapon(makeActor(), lasgun)).toBe(true);
  });
});

describe("биоорганы", () => {
  it("носитель — орган Астартес или Геносемя", () => {
    expect(hasFieldBioOrgans({ items: [{ type: "implant", system: { category: "astartes" } }] })).toBe(true);
    expect(hasFieldBioOrgans({ items: [{ type: "trait", name: "Gene-Seed / Геносемя" }] })).toBe(true);
    expect(hasFieldBioOrgans({ items: [{ type: "implant", system: { category: "bionic" } }] })).toBe(false);
  });
  it("тест каждые 10 мин, отторжение за T.b×2 Провалов", () => {
    let s = fieldBioStep(null, { now: 0, inField: true, tBonus: 4, rollTest: () => 0 });
    expect(s.tests).toBe(0);
    s = fieldBioStep(s.state, { now: 6000, inField: true, tBonus: 4, rollTest: n => n });   // 10 тестов, 10 Провалов
    expect(s.tests).toBe(10);
    expect(s.rejected).toBe(1);
    expect(s.state.fails).toBe(2);
  });
  it("вне поля Провалы уходят по 1 в час", () => {
    const s = fieldBioStep({ fails: 3, decayAt: 0 }, { now: 7200, inField: false, tBonus: 4, rollTest: () => 0 });
    expect(s.state.fails).toBe(1);
    expect(fieldBioStep({ fails: 1, decayAt: 0 }, { now: 3600, inField: false, tBonus: 4, rollTest: () => 0 }).state).toBeNull();
  });
});

describe("медицина", () => {
  it("галочки −10…−60 в окне Медицины, только в поле", () => {
    const med = NULL_ZONE_RULES.filter(r => r.id.startsWith("discordant.field.medicae"));
    expect(med.map(r => r.effects[0].value)).toEqual([-10, -20, -30, -60]);
    expect(med.every(r => r.effects[0].askOnly && r.effects[0].target === "skill:medicae")).toBe(true);
    expect(PREDICATES.inDiscordantField(makeActor(), {}, true)).toBe(true);
    expect(PREDICATES.inDiscordantField(makeActor({ inField: false }), {}, true)).toBe(false);
  });
});
