// test/combat/boneless.test.mjs
//
// Бескостный (wdbc-1rno.9): ½ I(Cr), переломы, «устоять на ногах», аморфная форма.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { wearsFullRigidArmour, bonelessDamage, isFractureCrit, BONELESS_GRANT_FLAG } from "../../module/rules/boneless.mjs";
import { BONELESS_RULES } from "../../module/rules/library/boneless.mjs";
import { bonelessStand } from "../../module/combat/boneless.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { ELITE_SCRIPT_API } from "../../module/combat/elite-api/index.mjs";
import { getCriticalEffect } from "../../critical-tables.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const BONELESS = packDocById("packs-src/mutations/Общие_мутации", "fNLAmI7mDoN2snia");
const AMORPHOUS = packDocById("packs-src/traits", "VhKtLT6d0Ar2js73");

const armour = (type, locs) => ({ type: "armor", system: { equipped: true, armorType: type,
  ...Object.fromEntries(["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"].map(l => [l, locs.includes(l) ? 5 : 0])) } });
const ALL = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

function mkActor(items = []) {
  const list = [...items];
  return {
    id: "A", uuid: "Actor.A", name: "Мягкий", type: "character",
    system: { characteristics: { s: { total: 40 }, ag: { total: 40 } }, skills: { athletics: { total: 40 } } },
    items: Object.assign(list, { contents: list }),
    getFlag: () => undefined,
    createEmbeddedDocuments: async (_t, docs) => { for (const d of docs) list.push({ id: `n${list.length}`, ...d }); return docs; },
    deleteEmbeddedDocuments: async (_t, ids) => { for (const id of ids) list.splice(list.findIndex(i => i.id === id), 1); }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.packs = { get: () => ({ getDocuments: async () => [
    { name: "Amorphous / Аморфный", toObject: () => ({ name: "Amorphous / Аморфный", type: "trait", system: {} }) },
    { name: "Crawler / Ползун", toObject: () => ({ name: "Crawler / Ползун", type: "trait", system: {} }) }
  ] }) };
});

describe("правила", () => {
  it("полный жёсткий доспех — все 6 мест жёсткой бронёй", () => {
    expect(wearsFullRigidArmour({ items: [armour("power", ALL)] })).toBe(true);
    expect(wearsFullRigidArmour({ items: [armour("carapace", ["body", "head"]), armour("carapace", ["leftArm", "rightArm", "leftLeg", "rightLeg"])] })).toBe(true);
    expect(wearsFullRigidArmour({ items: [armour("flak", ALL)] })).toBe(false);
    expect(wearsFullRigidArmour({ items: [armour("carapace", ["body"])] })).toBe(false);
  });
  it("½ I(Cr) окр. вверх, прочее — как есть", () => {
    expect(bonelessDamage(11, "impact", "crushing")).toEqual({ raw: 6, halved: true });
    expect(bonelessDamage(11, "impact", "")).toEqual({ raw: 11, halved: false });
    expect(bonelessDamage(11, "rending", "crushing").halved).toBe(false);
  });
  it("переломы в настоящей таблице Критических Эффектов", () => {
    // Impact, Торс 4 — «несколько ребер… сломаны».
    expect(isFractureCrit(getCriticalEffect("impact", "Торс", 4))).toBe(true);
    expect(isFractureCrit("Цель Оглушена на 1 Раунд.")).toBe(false);
  });
  it("аморфная форма: −20 S и +50 к Карабканью только при Amorphous", () => {
    const withAm = { items: [BONELESS, AMORPHOUS] };
    const without = { items: [BONELESS] };
    for (const r of BONELESS_RULES) {
      expect(PREDICATES.hasTrait(withAm, {}, r.when.hasTrait)).toBe(true);
      expect(PREDICATES.hasTrait(without, {}, r.when.hasTrait)).toBe(false);
    }
    expect(BONELESS_RULES.map(r => r.effects[0].value)).toEqual([-20, 50]);
  });
});

describe("Устоять на ногах", () => {
  it("в полном жёстком доспехе — без теста", async () => {
    expect(await bonelessStand(mkActor([armour("power", ALL)]))).toBe("armour");
  });
  it("провал — Amorphous и Crawler, успех — встаёт", async () => {
    const a = mkActor();
    captured.nextRoll = 90;
    expect(await bonelessStand(a)).toBe("collapsed");
    expect(a.items.filter(i => i.flags?.["warhammer-dbc"]?.[BONELESS_GRANT_FLAG] === "collapse").length).toBe(2);
    captured.nextRoll = 5;
    expect(await bonelessStand(a)).toBe("stood");
    expect(a.items.length).toBe(0);
  });
});

describe("пак", () => {
  it("кнопки на мутации", () => {
    const codes = BONELESS.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "script").map(e => e.code).join("\n");
    expect(codes).toContain("bonelessStand(actor)");
    expect(codes).toContain("toggleBonelessQuadruped(actor)");
    expect(typeof ELITE_SCRIPT_API.bonelessStand).toBe("function");
  });
});

describe("урон", () => {
  function target(items) {
    const list = [...items];
    const actor = {
      id: "t", name: "Мягкий", type: "character",
      system: { absorption: { body: 4, toughnessBonus: 4, propFlags: {} }, wounds: { value: 20, critical: 0, max: 20 } },
      items: Object.assign(list, { contents: list }),
      getFlag: () => undefined, async unsetFlag() {},
      async update(d) { if (d["system.wounds.value"] !== undefined) actor.system.wounds.value = d["system.wounds.value"]; }
    };
    return actor;
  }
  it("I(Cr) 15 бескостному: 8 до Поглощения T.b 4 → 4 Раны", async () => {
    const a = target([BONELESS]);
    await applyDamageToActor(a, { rawDamage: 15, penetration: 0, damageType: "impact", damageSubtype: "crushing",
      hitLocation: "Торс", attackerName: "Молот", weaponName: "Молот" });
    expect(a.system.wounds.value).toBe(16);
    expect(captured.chat.at(-1).content).toContain("Бескостный");
  });
  it("контроль: без мутации — 11 Ран", async () => {
    const a = target([]);
    await applyDamageToActor(a, { rawDamage: 15, penetration: 0, damageType: "impact", damageSubtype: "crushing",
      hitLocation: "Торс", attackerName: "Молот", weaponName: "Молот" });
    expect(a.system.wounds.value).toBe(9);
  });
});
