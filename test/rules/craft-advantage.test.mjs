// test/rules/craft-advantage.test.mjs
//
// Преимущество на тестах Крафта (wdbc-u0by): Cyberpreacher (пассивно, только
// категория "bionics") и Slow Shift (+30 и Преимущество за выбранную
// галочку) — оба поверх уже готового Кубика смены (craft-workshop.mjs).

import { describe, it, expect } from "vitest";
import {
  hasCyberpreacher, hasSlowShiftTalent, cyberpreacherApplies,
  effectiveDiceMode, slowShiftBonus, hasPolymath, polymathBonus,
  hasJourneyman, hasDarkMuse, darkMuseAssistBonus, haemonculusLabBonus
} from "../../module/rules/craft-advantage.mjs";

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
