// test/rules/death-save.test.mjs
//
// Смерть (стр. 232-233): Чудесное Спасение / Божественная Защита / Замедленная
// Анимация — доступность и стоимость. Чистые функции, никакого броска здесь.

import { describe, it, expect } from "vitest";
import {
  fatePoolLabel, hasSusAnMembrane, susAnEligible,
  fateSaveFails, toyOfGodsApplies, SUS_AN_MIN_CRITICAL,
  saveCostSource, dieMax, corMayReach100, toyOfGodsForcedOptions, conditionsEndedBySave,
  rollbackWounds, susAnCriticalLimit, rollsTwiceKeepLow, LETHAL_CONDITIONS
} from "../../module/rules/death-save.mjs";

describe("fatePoolLabel", () => {
  it("лоялист платит Судьбой", () => {
    expect(fatePoolLabel({ system: { alignment: "loyalist" } })).toBe("Судьбы");
  });
  it("хаосит платит Бесчестьем", () => {
    expect(fatePoolLabel({ system: { alignment: "heretic" } })).toBe("Бесчестья");
  });
});

describe("hasSusAnMembrane", () => {
  it("требует и имя, и флаг installed", () => {
    const installed = { type: "implant", name: "Сус-ан Мембрана", getFlag: () => true };
    const notInstalled = { type: "implant", name: "Сус-ан Мембрана", getFlag: () => false };
    expect(hasSusAnMembrane({ items: [installed] })).toBe(true);
    expect(hasSusAnMembrane({ items: [notInstalled] })).toBe(false);
  });
});

describe("susAnEligible", () => {
  it("доступна ровно на границе −15", () => {
    expect(susAnEligible({ system: { wounds: { critical: SUS_AN_MIN_CRITICAL } } })).toBe(true);
    expect(susAnEligible({ system: { wounds: { critical: SUS_AN_MIN_CRITICAL + 1 } } })).toBe(false);
  });
});

describe("fateSaveFails", () => {
  it("проваливается, если пул опустится до 0 или ниже", () => {
    expect(fateSaveFails(20, 20)).toBe(true);
    expect(fateSaveFails(20, 25)).toBe(true);
    expect(fateSaveFails(20, 19)).toBe(false);
  });
});

// Цена хаосита — характеристика Inf, не пул Очков (сверка wdbc-x1nz.2,
// 24.09.2026: «опускает Inf до 0», «Inf 50 или выше после потери»).
describe("saveCostSource", () => {
  it("хаосит платит постоянным Inf, пишется в inf.base", () => {
    const src = saveCostSource({ system: { alignment: "heretic", fate: { value: 4 },
      characteristics: { inf: { base: 30, total: 42, drugMod: 5 } } } });
    expect(src).toEqual({ kind: "inf", current: 37, path: "system.characteristics.inf.base", base: 30 });
  });
  it("лоялист — пул Судьбы, как раньше", () => {
    const src = saveCostSource({ system: { alignment: "loyalist", fate: { value: 4 } } });
    expect(src).toMatchObject({ kind: "pool", current: 4, path: "system.fate.value" });
  });
});

describe("dieMax / corMayReach100", () => {
  it("максимум кубика", () => {
    expect(dieMax("1d10")).toBe(10);
    expect(dieMax("1d5")).toBe(5);
    expect(dieMax("2d10")).toBe(20);
    expect(dieMax("")).toBe(0);
  });
  it("Cor 90 + 1d10 может дойти до 100, Cor 89 — нет", () => {
    expect(corMayReach100({ system: { corruption: { value: 90 } } }, "1d10")).toBe(true);
    expect(corMayReach100({ system: { corruption: { value: 89 } } }, "1d10")).toBe(false);
  });
});

describe("Игрушка Богов", () => {
  it("только Покровительство одного из четырёх Богов (решение владельца 24.09.2026)", () => {
    expect(toyOfGodsApplies({ system: { patronGod: "khorne" } })).toBe(true);
    expect(toyOfGodsApplies({ system: { patronGod: "slaanesh" } })).toBe(true);
    expect(toyOfGodsApplies({ system: { patronGod: "undivided" } })).toBe(false);
    expect(toyOfGodsApplies({ system: { patronGod: "", alignment: "heretic" } })).toBe(false);
  });
  it("обязывает только пути, которые не могут поднять Cor до 100", () => {
    const at = cor => ({ system: { corruption: { value: cor } } });
    expect(toyOfGodsForcedOptions(at(50))).toEqual(["miraculous", "divine"]);
    // 92+10=102 — Чудесное может, 92+5=97 — Защита не может
    expect(toyOfGodsForcedOptions(at(92))).toEqual(["divine"]);
    expect(toyOfGodsForcedOptions(at(95))).toEqual([]);
    // Прах Феникса сужает кубик Порчи Чудесного до 1d5
    expect(toyOfGodsForcedOptions(at(92), { miraculousCorDie: "1d5" })).toEqual(["miraculous", "divine"]);
  });
});

describe("conditionsEndedBySave", () => {
  it("Божественная Защита — все смертельные Состояния", () => {
    expect(conditionsEndedBySave("divine", null)).toEqual(LETHAL_CONDITIONS);
  });
  it("Чудесное Спасение — только причина смерти", () => {
    expect(conditionsEndedBySave("miraculous", "bleeding")).toEqual(["bleeding", "haemorrhaging"]);
    expect(conditionsEndedBySave("miraculous", "suffocating")).toEqual(["suffocating"]);
    expect(conditionsEndedBySave("miraculous", "gangrene")).toEqual(["gangrene"]);
    expect(conditionsEndedBySave("miraculous", "toughness")).toEqual([]);
    expect(conditionsEndedBySave("miraculous", null)).toEqual(["burning"]);
  });
});

describe("rollbackWounds", () => {
  const withFlags = flags => ({ getFlag: (s, k) => flags[k] });
  it("отдаёт снимок до удара", () => {
    expect(rollbackWounds(withFlags({ preHitWounds: { value: 7, critical: 0 } }))).toEqual({ value: 7, critical: 0 });
  });
  it("смерть от Состояния — откатывать нечего", () => {
    expect(rollbackWounds(withFlags({ preHitWounds: { value: 7, critical: 0 }, deathCause: "bleeding" }))).toBeNull();
  });
  it("снимка нет — null", () => {
    expect(rollbackWounds(withFlags({}))).toBeNull();
  });
});

describe("Замедленная Анимация: Сон Героя и одна попытка", () => {
  const heroSleep = { type: "talent", name: "Hero's Sleep / Сон Героя" };
  it("порог 15 без Таланта, 10+T.b со Сном Героя", () => {
    expect(susAnCriticalLimit({ items: [], system: { characteristics: { t: { bonus: 7 } } } })).toBe(15);
    expect(susAnCriticalLimit({ items: [heroSleep], system: { characteristics: { t: { bonus: 7 } } } })).toBe(17);
  });
  it("потраченная попытка закрывает путь", () => {
    const actor = { system: { wounds: { critical: 3 } }, getFlag: (s, k) => k === "susAnAttempted" };
    expect(susAnEligible(actor)).toBe(false);
  });
});

describe("rollsTwiceKeepLow", () => {
  it("только Наследник", () => {
    expect(rollsTwiceKeepLow({ system: { subrace: "inheritor" } })).toBe(true);
    expect(rollsTwiceKeepLow({ system: { subrace: "" } })).toBe(false);
  });
});
