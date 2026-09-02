import { describe, it, expect } from "vitest";
import { entryWhenOk, whenConditions, whenSubmutations, whenTalentSpec, whenWoundTier, whenPatronGod } from "../../module/rules/mech-when.mjs";

const actorWithItems = (items = [], geneSeed = {}) => ({
  system: { geneSeed, bio: { age: 0 } },
  items
});

const actorWith = ({ wounds = {}, inRage = false, patronGod = "" } = {}) => ({
  system: { geneSeed: {}, bio: { age: 0 }, wounds: { tier: "healthy", ...wounds }, inRage, patronGod },
  items: []
});

describe("entryWhenOk: без условий — всегда true", () => {
  it("entry.when отсутствует", () => {
    expect(entryWhenOk(actorWithItems(), {})).toBe(true);
  });
});

describe("entryWhenOk: Геносемя (регресс, не должен был измениться)", () => {
  const entry = { when: { negate: false, conditions: [{ legion: "I" }] } };
  it("подходящий легион — true", () => {
    expect(entryWhenOk(actorWithItems([], { legion: "I" }), entry)).toBe(true);
  });
  it("другой легион — false", () => {
    expect(entryWhenOk(actorWithItems([], { legion: "II" }), entry)).toBe(false);
  });
});

describe("entryWhenOk: Талант+специализация (wdbc-ta4y)", () => {
  // itemHasName сравнивает wanted с КАЖДОЙ билингвальной половиной имени
  // предмета по отдельности (rules/predicates.mjs) — значит и в when.talentSpec.name
  // должна лежать ОДНА половина ("Мастерство"), а не полная строка со слэшем.
  const entry = { when: { talentSpec: { name: "Мастерство", specialization: "Психонаука" } } };

  it("нет актора (превью) — условие пройдено", () => {
    expect(entryWhenOk(null, entry)).toBe(true);
  });

  it("нет такого Таланта вовсе — false", () => {
    expect(entryWhenOk(actorWithItems([]), entry)).toBe(false);
  });

  it("Талант есть, но специализация другая — false", () => {
    const actor = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "Уклонение" } }
    ]);
    expect(entryWhenOk(actor, entry)).toBe(false);
  });

  it("Талант с нужной специализацией — true", () => {
    const actor = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "Психонаука" } }
    ]);
    expect(entryWhenOk(actor, entry)).toBe(true);
  });

  it("сравнение по любой билингвальной половине имени, без учёта регистра/пробелов", () => {
    const actor = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "  психонаука  " } }
    ]);
    expect(entryWhenOk(actor, { when: { talentSpec: { name: "мастерство", specialization: "Психонаука" } } }))
      .toBe(true);
  });

  it("годится и Черта (trait), не только Талант", () => {
    const actor = actorWithItems([
      { type: "trait", name: "Mastery / Мастерство", system: { specialization: "Психонаука" } }
    ]);
    expect(entryWhenOk(actor, entry)).toBe(true);
  });

  it("negateTalent переворачивает результат", () => {
    const withTalent = actorWithItems([
      { type: "talent", name: "Mastery / Мастерство", system: { specialization: "Психонаука" } }
    ]);
    const without = actorWithItems([]);
    const negated = { when: { talentSpec: entry.when.talentSpec, negateTalent: true } };
    expect(entryWhenOk(withTalent, negated)).toBe(false);
    expect(entryWhenOk(without, negated)).toBe(true);
  });
});

describe("entryWhenOk: гейты независимы и складываются через И", () => {
  it("Геносемя проходит, Талант — нет: итог false", () => {
    const actor = actorWithItems([], { legion: "I" });
    const entry = {
      when: {
        negate: false, conditions: [{ legion: "I" }],
        talentSpec: { name: "Mastery / Мастерство", specialization: "Психонаука" }
      }
    };
    expect(entryWhenOk(actor, entry)).toBe(false);
  });
});

describe("entryWhenOk: Тир Ран (wdbc-wyr3)", () => {
  const heavyOrDying = { when: { woundTier: ["heavy", "dying"] } };

  it("Здоров — вне списка, false", () => {
    expect(entryWhenOk(actorWith({ wounds: { tier: "healthy" } }), heavyOrDying)).toBe(false);
  });

  it("Тяжело ранен — в списке, true", () => {
    expect(entryWhenOk(actorWith({ wounds: { tier: "heavy" } }), heavyOrDying)).toBe(true);
  });

  it("При смерти — тоже в списке (ИЛИ между вариантами), true", () => {
    expect(entryWhenOk(actorWith({ wounds: { tier: "dying" } }), heavyOrDying)).toBe(true);
  });

  it("negateWoundTier переворачивает результат: «Здоров/Легко ранен» = НЕ Тяжело/При смерти", () => {
    const healthyOrLight = { when: { woundTier: ["heavy", "dying"], negateWoundTier: true } };
    expect(entryWhenOk(actorWith({ wounds: { tier: "healthy" } }), healthyOrLight)).toBe(true);
    expect(entryWhenOk(actorWith({ wounds: { tier: "light" } }), healthyOrLight)).toBe(true);
    expect(entryWhenOk(actorWith({ wounds: { tier: "heavy" } }), healthyOrLight)).toBe(false);
  });

  it("нет актора (превью) — условие пройдено", () => {
    expect(entryWhenOk(null, heavyOrDying)).toBe(true);
  });

  it("whenWoundTier: пустой список без woundTier", () => {
    expect(whenWoundTier({})).toEqual([]);
  });
});

describe("entryWhenOk: Ярость", () => {
  const requireRage = { when: { requireRage: true } };

  it("не в Ярости — false", () => {
    expect(entryWhenOk(actorWith({ inRage: false }), requireRage)).toBe(false);
  });

  it("в Ярости — true", () => {
    expect(entryWhenOk(actorWith({ inRage: true }), requireRage)).toBe(true);
  });

  it("negateRage переворачивает результат", () => {
    const negated = { when: { requireRage: true, negateRage: true } };
    expect(entryWhenOk(actorWith({ inRage: true }), negated)).toBe(false);
    expect(entryWhenOk(actorWith({ inRage: false }), negated)).toBe(true);
  });

  it("нет актора (превью) — условие пройдено", () => {
    expect(entryWhenOk(null, requireRage)).toBe(true);
  });
});

describe("entryWhenOk: Герметичная броня (wdbc-1rno)", () => {
  const requireSealed = { when: { requireSealedArmour: true } };
  const armourItem = (properties, equipped = true) => ({
    type: "armor", system: { equipped, properties }
  });

  it("нет надетой Sealed-брони — false", () => {
    expect(entryWhenOk(actorWithItems([armourItem(["heavy"])]), requireSealed)).toBe(false);
  });

  it("надета Sealed-броня — true", () => {
    expect(entryWhenOk(actorWithItems([armourItem(["sealed", "heavy"])]), requireSealed)).toBe(true);
  });

  it("Sealed-броня есть, но НЕ надета — false (equipped:false не считается)", () => {
    expect(entryWhenOk(actorWithItems([armourItem(["sealed"], false)]), requireSealed)).toBe(false);
  });

  it("negateSealedArmour переворачивает результат: «без гермодоспеха»", () => {
    const negated = { when: { requireSealedArmour: true, negateSealedArmour: true } };
    expect(entryWhenOk(actorWithItems([armourItem(["sealed"])]), negated)).toBe(false);
    expect(entryWhenOk(actorWithItems([armourItem(["heavy"])]), negated)).toBe(true);
    expect(entryWhenOk(actorWithItems([]), negated)).toBe(true);
  });

  it("нет актора (превью) — условие пройдено", () => {
    expect(entryWhenOk(null, requireSealed)).toBe(true);
  });
});

describe("entryWhenOk: Тир Ран и Ярость складываются с остальными гейтами через И", () => {
  it("Тир Ран подходит, Ярость — нет: итог false", () => {
    const entry = { when: { woundTier: ["healthy", "light"], requireRage: true } };
    expect(entryWhenOk(actorWith({ wounds: { tier: "healthy" }, inRage: false }), entry)).toBe(false);
    expect(entryWhenOk(actorWith({ wounds: { tier: "healthy" }, inRage: true }), entry)).toBe(true);
  });
});

describe("entryWhenOk: Покровитель (wdbc-xxb7)", () => {
  const khorneOrNurgle = { when: { patronGod: ["khorne", "nurgle"] } };

  it("подходящий Покровитель — true", () => {
    expect(entryWhenOk(actorWith({ patronGod: "khorne" }), khorneOrNurgle)).toBe(true);
    expect(entryWhenOk(actorWith({ patronGod: "nurgle" }), khorneOrNurgle)).toBe(true);
  });

  it("другой Покровитель — false", () => {
    expect(entryWhenOk(actorWith({ patronGod: "tzeentch" }), khorneOrNurgle)).toBe(false);
  });

  it("без Покровителя вовсе — false (пустая строка не входит в список)", () => {
    expect(entryWhenOk(actorWith({ patronGod: "" }), khorneOrNurgle)).toBe(false);
  });

  it("«Неделимый» — свой отдельный ключ, не синоним пустой строки", () => {
    const undividedOnly = { when: { patronGod: ["undivided"] } };
    expect(entryWhenOk(actorWith({ patronGod: "undivided" }), undividedOnly)).toBe(true);
    expect(entryWhenOk(actorWith({ patronGod: "" }), undividedOnly)).toBe(false);
  });

  it("negatePatronGod переворачивает результат", () => {
    const negated = { when: { patronGod: ["khorne"], negatePatronGod: true } };
    expect(entryWhenOk(actorWith({ patronGod: "khorne" }), negated)).toBe(false);
    expect(entryWhenOk(actorWith({ patronGod: "nurgle" }), negated)).toBe(true);
  });

  it("нет актора (превью) — условие пройдено", () => {
    expect(entryWhenOk(null, khorneOrNurgle)).toBe(true);
  });

  it("whenPatronGod: пустой список без patronGod", () => {
    expect(whenPatronGod({})).toEqual([]);
  });
});

describe("entryWhenOk: Покровитель складывается с остальными гейтами через И", () => {
  it("Покровитель подходит, Ярость — нет: итог false", () => {
    const entry = { when: { patronGod: ["khorne"], requireRage: true } };
    expect(entryWhenOk(actorWith({ patronGod: "khorne", inRage: false }), entry)).toBe(false);
    expect(entryWhenOk(actorWith({ patronGod: "khorne", inRage: true }), entry)).toBe(true);
  });
});

describe("whenConditions/whenSubmutations/whenTalentSpec: геттеры не считают частично заполненные записи", () => {
  it("talentSpec без specialization не считается заполненным", () => {
    expect(whenTalentSpec({ talentSpec: { name: "X", specialization: "" } })).toBeNull();
    expect(whenTalentSpec({ talentSpec: { name: "", specialization: "Y" } })).toBeNull();
    expect(whenTalentSpec({})).toBeNull();
  });
  it("conditions/submutations — регресс на пустых значениях", () => {
    expect(whenConditions({})).toEqual([]);
    expect(whenSubmutations({})).toEqual([]);
  });
});
