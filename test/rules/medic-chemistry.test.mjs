// Таланты Медика поверх химии (остаток Талантов, 20.11.2026).
import { describe, it, expect } from "vitest";
import { stockAdd, medicStock, cookBatch, deepDetoxStunMinutes, antivenomImmune, placeboActive, placeboFlag,
         triageCap, groupSkillValue, CHYMISTRY_RE,
         stockUpdateData, isChemSupply } from "../../module/rules/medic-chemistry.mjs";
import { checkTargetWrite } from "../../module/combat/gm-relay.mjs";

const T = name => ({ type: "talent", name });

describe("запас заготовок", () => {
  it("пополнение и расход до нуля убирает запись", () => {
    let s = medicStock({});
    s = stockAdd(s, "cook", "Обскура", 3);
    expect(s.cook["Обскура"]).toBe(3);
    s = stockAdd(s, "cook", "Обскура", -3);
    expect(s.cook).toEqual({});
  });
  it("точка в названии не ломает путь флага", () => {
    expect(Object.keys(stockAdd(medicStock({}), "antivenom", "Яд v.2", 1).antivenom)).toEqual(["Яд v·2"]);
  });
  it("Повар: I.b смесей", () => expect(cookBatch({ system: { characteristics: { int: { bonus: 4 } } } })).toBe(4));
});

describe("Глубокая Детоксикация", () => {
  it("1d5+1−Успехи, не меньше 0", () => {
    expect(deepDetoxStunMinutes(3, 2)).toBe(2);
    expect(deepDetoxStunMinutes(1, 4)).toBe(0);
  });
});

describe("Противоядие", () => {
  const a = { flags: { "warhammer-dbc": { antivenomImmunity: { "Чёрная Смерть": 1000 } } } };
  it("иммунитет к своему яду до срока", () => {
    expect(antivenomImmune(a, "Чёрная Смерть", 500)).toBe(true);
    expect(antivenomImmune(a, "Чёрная Смерть", 1000)).toBe(false);
    expect(antivenomImmune(a, "Другой", 500)).toBe(false);
  });
});

describe("Плацебо", () => {
  it("в бою — по Раундам того же боя", () => {
    const combat = { id: "c1", round: 3 };
    const flag = placeboFlag(2, { combat });
    expect(flag).toEqual({ combatId: "c1", round: 4 });
    const a = { flags: { "warhammer-dbc": { placebo: flag } } };
    expect(placeboActive(a, { combat: { id: "c1", round: 4 } })).toBe(true);
    expect(placeboActive(a, { combat: { id: "c1", round: 5 } })).toBe(false);
    expect(placeboActive(a, { combat: null })).toBe(false);
  });
  it("вне боя — по времени", () => {
    const a = { flags: { "warhammer-dbc": { placebo: placeboFlag(3, { now: 100 }) } } };
    expect(placeboActive(a, { now: 117 })).toBe(true);
    expect(placeboActive(a, { now: 118 })).toBe(false);
  });
});

describe("Триаж", () => {
  it("10×I.b, без Таланта — нет потолка", () => {
    expect(triageCap({ items: [T("Triage / Триаж")], system: { characteristics: { int: { bonus: 3 } } } })).toBe(30);
    expect(triageCap({ items: [] })).toBeNull();
  });
});

describe("групповой Навык химии", () => {
  it("специализация находится, иначе нетренированный I−20", () => {
    const a = { system: { characteristics: { int: { total: 40 } }, groupSkills: { trade: [{ specialty: "Chymist", total: 55 }] } } };
    expect(groupSkillValue(a, "trade", CHYMISTRY_RE)).toEqual({ value: 55, trained: true });
    expect(groupSkillValue(a, "scholasticLore", CHYMISTRY_RE)).toEqual({ value: 20, trained: false });
  });
});

describe("запись через ГМа", () => {
  const medic = { items: [T("Placebo / Плацебо"), T("Cook / Повар")] };
  it("пропускает Плацебо в пределах и отказывает без Таланта", () => {
    expect(checkTargetWrite({ kind: "medicChem", action: "placebo", rounds: 3 }, { initiatorOwned: true, initiator: medic }).ok).toBe(true);
    expect(checkTargetWrite({ kind: "medicChem", action: "antivenom", poison: "X" }, { initiatorOwned: true, initiator: medic }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "medicChem", action: "placebo", rounds: 99 }, { initiatorOwned: true, initiator: medic }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "medicChem", action: "cook", drug: "Обскура", extra: 1 }, { initiatorOwned: true, initiator: medic }).ok).toBe(false);
  });
});

describe("живая проверка #585: запас и поиск расходников", () => {
  it("последняя доза снимается с флага оператором -=", () => {
    const prev = { cook: { Обскура: 1 }, antivenom: {}, deepDetox: { Слот: 2 } };
    const next = stockAdd(prev, "cook", "Обскура", -1);
    const d = stockUpdateData(prev, next);
    expect(d["flags.warhammer-dbc.medicStock.cook.-=Обскура"]).toBeNull();
    expect(d["flags.warhammer-dbc.medicStock.deepDetox.Слот"]).toBe(2);
  });
  it("Талант «Глубокая Детоксикация» не принимается за препарат Детокс", () => {
    const re = /detox|детокс/i;
    expect(isChemSupply({ type: "talent", name: "Deep Detox / Глубокая Детоксикация" }, re)).toBe(false);
    expect(isChemSupply({ type: "drug", name: "Detox / Детокс" }, re)).toBe(true);
  });
});
