// test/rules/craft-advantage.test.mjs
//
// Преимущество на тестах Крафта (wdbc-u0by): Cyberpreacher (пассивно, только
// категория "bionics") и Slow Shift (+30 и Преимущество за выбранную
// галочку) — оба поверх уже готового Кубика смены (craft-workshop.mjs).

import { describe, it, expect } from "vitest";
import {
  hasCyberpreacher, hasSlowShiftTalent, cyberpreacherApplies,
  effectiveDiceMode, slowShiftBonus, hasPolymath, polymathBonus,
  hasJourneyman, hasDarkMuse, darkMuseAssistBonus, haemonculusLabBonus, researchBonus,
  hasWorkaholic, monotonyPenalty, fabricatorToolMod, masterEngineseerBonus, polymathCrit
} from "../../module/rules/craft-advantage.mjs";
import { POLYMATH_CHAIN_MAX } from "../../module/constants/craft.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

const actorWithMutation = (...mutationNames) => ({
  items: mutationNames.map(name => ({ type: "mutation", name }))
});

describe("hasCyberpreacher / hasSlowShiftTalent", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasCyberpreacher(actorWith("Cyberpreacher / Киберпроповедник"))).toBe(true);
    expect(hasSlowShiftTalent(actorWith("Slow Shift / Медленная Смена"))).toBe(true);
  });

  it("нет Таланта — false", () => {
    expect(hasCyberpreacher(actorWith("Dodge"))).toBe(false);
    expect(hasSlowShiftTalent(actorWith("Dodge"))).toBe(false);
  });

  it("нет актора — false, не падает", () => {
    expect(hasCyberpreacher(null)).toBe(false);
    expect(hasSlowShiftTalent(undefined)).toBe(false);
  });
});

describe("cyberpreacherApplies", () => {
  const crafter = actorWith("Cyberpreacher / Киберпроповедник");

  it("Талант + категория bionics — применяется", () => {
    expect(cyberpreacherApplies(crafter, "bionics")).toBe(true);
  });

  it("Талант, но другая категория — не применяется", () => {
    expect(cyberpreacherApplies(crafter, "weapons")).toBe(false);
  });

  it("категория bionics, но нет Таланта — не применяется", () => {
    expect(cyberpreacherApplies(actorWith("Dodge"), "bionics")).toBe(false);
  });
});

describe("effectiveDiceMode", () => {
  it("Cyberpreacher поднимает до advantage независимо от ручного выбора", () => {
    const crafter = actorWith("Cyberpreacher / Киберпроповедник");
    expect(effectiveDiceMode("normal", crafter, "bionics", false)).toBe("advantage");
    expect(effectiveDiceMode("disadvantage", crafter, "bionics", false)).toBe("advantage");
  });

  it("Slow Shift выбран и Талант есть — advantage", () => {
    const crafter = actorWith("Slow Shift / Медленная Смена");
    expect(effectiveDiceMode("normal", crafter, "weapons", true)).toBe("advantage");
  });

  it("Slow Shift выбран, но Таланта нет — ручной выбор не трогается (защита от подмены данных)", () => {
    const crafter = actorWith("Dodge");
    expect(effectiveDiceMode("normal", crafter, "weapons", true)).toBe("normal");
  });

  it("ничего не применяется — ручной выбор как есть", () => {
    const crafter = actorWith("Dodge");
    expect(effectiveDiceMode("disadvantage", crafter, "weapons", false)).toBe("disadvantage");
  });

  it("именованный ассистент реально владеет Подмастерьем (wdbc-1rno — раньше был честный флаг, теперь проверяется по инвентарю) — advantage", () => {
    const crafter = actorWith("Dodge"); // никакого отношения к Подмастерью
    const assistant = actorWith("Journeyman / Подмастерье");
    expect(effectiveDiceMode("normal", crafter, "weapons", false, assistant)).toBe("advantage");
  });

  it("именованный ассистент БЕЗ Подмастерья — не влияет (раньше эта проверка была невозможна)", () => {
    const crafter = actorWith("Dodge");
    const assistant = actorWith("Dodge");
    expect(effectiveDiceMode("normal", crafter, "weapons", false, assistant)).toBe("normal");
  });

  it("нет именованного ассистента вовсе — не влияет, не падает", () => {
    const crafter = actorWith("Dodge");
    expect(effectiveDiceMode("normal", crafter, "weapons", false, null)).toBe("normal");
  });
});

describe("slowShiftBonus", () => {
  it("выбран и Талант есть — +30", () => {
    expect(slowShiftBonus(actorWith("Slow Shift / Медленная Смена"), true)).toBe(30);
  });

  it("не выбран — 0 даже с Талантом", () => {
    expect(slowShiftBonus(actorWith("Slow Shift / Медленная Смена"), false)).toBe(0);
  });

  it("выбран, но Таланта нет — 0", () => {
    expect(slowShiftBonus(actorWith("Dodge"), true)).toBe(0);
  });
});

// Polymath / Полимат (wdbc-1rno): Мутация, не Талант — +10 безусловно на
// Крафт И Исследования (в отличие от Cyberpreacher, не завязан на категорию).
describe("hasPolymath / polymathBonus", () => {
  it("находит Мутацию по билингвальному имени", () => {
    expect(hasPolymath(actorWithMutation("Polymath / Полимат"))).toBe(true);
  });

  it("Талант с тем же именем НЕ считается — это Мутация", () => {
    expect(hasPolymath(actorWith("Polymath / Полимат"))).toBe(false);
  });

  it("нет Мутации — false/0", () => {
    expect(hasPolymath(actorWithMutation("Dullahan"))).toBe(false);
    expect(polymathBonus(actorWithMutation("Dullahan"))).toBe(0);
  });

  it("есть Мутация — +10, безусловно", () => {
    expect(polymathBonus(actorWithMutation("Polymath / Полимат"))).toBe(10);
  });

  it("нет актора — false/0, не падает", () => {
    expect(hasPolymath(null)).toBe(false);
    expect(polymathBonus(undefined)).toBe(0);
  });
});

// Лаборатория Гемункула (wdbc-6nl9, «Ковен Гемункулов» — благо стадии 0
// Элитного архетипа) — +60 безусловно на Крафт И Исследования, тем же
// приёмом, что и Полимат (isHaemonculus, не Талант/Мутация — сам архетип).
describe("haemonculusLabBonus", () => {
  it("Гемункул (архетип предметом) — +60, безусловно", () => {
    const actor = { items: [{ type: "eliteArchetype", name: "Haemonculus / Гемункул" }], system: {} };
    expect(haemonculusLabBonus(actor)).toBe(60);
  });

  it("Гемункул (архетип строкой в шапке) — тоже +60", () => {
    const actor = { items: [], system: { eliteArchetype: "Haemonculus / Гемункул" } };
    expect(haemonculusLabBonus(actor)).toBe(60);
  });

  it("не Гемункул (другой архетип/без архетипа) — 0", () => {
    expect(haemonculusLabBonus({ items: [], system: { eliteArchetype: "Felarch / Феларх" } })).toBe(0);
    expect(haemonculusLabBonus({ items: [], system: {} })).toBe(0);
  });

  it("нет актора — 0, не падает", () => {
    expect(haemonculusLabBonus(null)).toBe(0);
    expect(haemonculusLabBonus(undefined)).toBe(0);
  });
});

// hasJourneyman/hasDarkMuse/darkMuseAssistBonus (wdbc-1rno) — оба находки
// требуют знать личность КОНКРЕТНОГО ассистента, теперь module/apps/
// craft-workshop.mjs несёт assistantId (реальную ссылку на актора).
describe("hasJourneyman", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasJourneyman(actorWith("Journeyman / Подмастерье"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasJourneyman(actorWith("Dodge"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasJourneyman(null)).toBe(false);
  });
});

describe("hasDarkMuse / darkMuseAssistBonus", () => {
  it("Мутация есть — +30 (Мастерская всегда тест Крафта/Исследования)", () => {
    expect(hasDarkMuse(actorWithMutation("Dark Muse / Тёмная Муза"))).toBe(true);
    expect(darkMuseAssistBonus(actorWithMutation("Dark Muse / Тёмная Муза"))).toBe(30);
  });

  it("Талант с тем же именем НЕ считается — это Мутация", () => {
    expect(hasDarkMuse(actorWith("Dark Muse / Тёмная Муза"))).toBe(false);
  });

  it("нет Мутации — false/0", () => {
    expect(hasDarkMuse(actorWithMutation("Dodge"))).toBe(false);
    expect(darkMuseAssistBonus(actorWithMutation("Dodge"))).toBe(0);
  });

  it("нет актора — false/0, не падает", () => {
    expect(hasDarkMuse(null)).toBe(false);
    expect(darkMuseAssistBonus(undefined)).toBe(0);
  });
});

// Инновация (Стремление, стр. 22): «+10 на тесты Исследований». Читается
// записью Конструктора «Возможность» craft.researchBonus на предмете актора.
describe("researchBonus (Инновация)", () => {
  const innovation = {
    id: "innov", name: "Innovation / Инновация", type: "aspiration",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "craft.researchBonus", label: "" }] }] } }
  };
  const crafter = (...items) => ({ items });

  it("+10 только на проект-Исследование", () => {
    expect(researchBonus(crafter(innovation), "research")).toBe(10);
  });
  it("Крафт и Биолаборатория без бонуса — в отличие от Полимата", () => {
    expect(researchBonus(crafter(innovation), "craft")).toBe(0);
    expect(researchBonus(crafter(innovation), "bio")).toBe(0);
  });
  it("без Стремления — ноль", () => {
    expect(researchBonus(crafter(), "research")).toBe(0);
  });
});

// Workaholic / Трудоголик (Таланты Крафта, глава 3, task 3-3a64): «не получает
// штрафы за занятие одним и тем же Крафтом несколько смен подряд» — штраф −30
// галочки «Монотонная работа» с него снимается.
describe("monotonyPenalty (Трудоголик)", () => {
  it("галочка стоит, Таланта нет — −30", () => {
    expect(monotonyPenalty(actorWith("Dodge"), true)).toBe(-30);
  });
  it("галочка стоит, Талант есть — штрафа нет", () => {
    expect(monotonyPenalty(actorWith("Workaholic / Трудоголик"), true)).toBe(0);
  });
  it("галочки нет — штрафа нет в любом случае", () => {
    expect(monotonyPenalty(actorWith("Dodge"), false)).toBe(0);
  });
  it("нет актора — штраф как у обычного (не падает)", () => {
    expect(monotonyPenalty(null, true)).toBe(-30);
  });
  it("hasWorkaholic: Мутация с тем же именем не считается", () => {
    expect(hasWorkaholic(actorWithMutation("Workaholic / Трудоголик"))).toBe(false);
  });
});

// Fabricator / Фабрикатор: «удваивает бонусы от инструментов на тесты Крафта».
// Бонусы — это положительные модификаторы; штраф за плохие инструменты не
// удваивается (книга говорит о бонусах).
describe("fabricatorToolMod (Фабрикатор)", () => {
  const fab = actorWith("Fabricator / Фабрикатор");
  it("положительный бонус инструментов удваивается", () => {
    expect(fabricatorToolMod(fab, 10)).toBe(20);
    expect(fabricatorToolMod(fab, 30)).toBe(60);
  });
  it("штраф и ноль не удваиваются", () => {
    expect(fabricatorToolMod(fab, -20)).toBe(-20);
    expect(fabricatorToolMod(fab, 0)).toBe(0);
  });
  it("без Таланта бонус как был", () => {
    expect(fabricatorToolMod(actorWith("Dodge"), 20)).toBe(20);
    expect(fabricatorToolMod(null, 20)).toBe(20);
  });
});

// Master Engineseer / Мастер-Технопровидец: «+10 к Tech-Use на Крафт и ремонт».
// Только когда Tech-Use — ведущий Навык теста (он задаёт Предел) и только
// Крафт (не Исследование). Автоуспех за Очко Бесчестия — отдельная часть.
describe("masterEngineseerBonus (Мастер-Технопровидец)", () => {
  const me = actorWith("Master Engineseer / Мастер-Технопровидец");
  it("Крафт, Tech-Use ведущий — +10", () => {
    expect(masterEngineseerBonus(me, "craft", "skill:techUse")).toBe(10);
  });
  it("ведущий Навык другой (Ремесло) — 0", () => {
    expect(masterEngineseerBonus(me, "craft", "group:trade:0")).toBe(0);
  });
  it("Исследование и Биолаборатория — 0", () => {
    expect(masterEngineseerBonus(me, "research", "skill:techUse")).toBe(0);
    expect(masterEngineseerBonus(me, "bio", "skill:techUse")).toBe(0);
  });
  it("без Таланта — 0; нет актора — 0", () => {
    expect(masterEngineseerBonus(actorWith("Dodge"), "craft", "skill:techUse")).toBe(0);
    expect(masterEngineseerBonus(null, "craft", "skill:techUse")).toBe(0);
  });
});

// Polymath, крит в Мастерской: 1d5 Усталости и ещё одна смена, цепочка
// ограничена POLYMATH_CHAIN_MAX.
describe("polymathCrit (крит Полимата)", () => {
  const poly = actorWithMutation("Polymath / Полимат");
  it("Полимат + Критический Успех — срабатывает", () => {
    expect(polymathCrit(poly, true, 1)).toEqual({ triggered: true, capped: false });
  });
  it("нет крита или нет Полимата — не срабатывает", () => {
    expect(polymathCrit(poly, false, 1).triggered).toBe(false);
    expect(polymathCrit(actorWith("Dodge"), true, 1).triggered).toBe(false);
    expect(polymathCrit(actorWithMutation(), true, 1).triggered).toBe(false);
  });
  it("Талант с тем же именем не считается — только Мутация", () => {
    expect(polymathCrit(actorWith("Polymath / Полимат"), true, 1).triggered).toBe(false);
  });
  it("последняя смена цепочки — срабатывает, но дальше нельзя (capped)", () => {
    expect(polymathCrit(poly, true, POLYMATH_CHAIN_MAX)).toEqual({ triggered: true, capped: true });
    expect(polymathCrit(poly, true, POLYMATH_CHAIN_MAX - 1).capped).toBe(false);
  });
});
