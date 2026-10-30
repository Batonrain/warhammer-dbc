// test/rules/occultist-talents.test.mjs
//
// Таланты Оккультиста (перепроверка Sahara 3-2a39, 19.10.2026): Glorious
// Purpose и половина Infernal Master через rollBonus-приём разницы итогов,
// тот же, что Living Legend (test/rules/leadership-talents.test.mjs). Rite
// Puzzler — только число теста (ritePuzzlerLearnMod), система не привязывает
// предмет-ритуал к «следам» на месте; capabilities.mjs честно помечает его
// заглушкой (reader: ""), тесты ниже — только арифметика функции.
//
// [фикс 19.10.2026, независимое ревью] gloriousPurposeBonus/
// infernalMasterCommandBonus теперь не опускаются ниже 0 («может
// использовать вместо» — выбор, не обязательная замена). Подмена
// Командования у Infernal Master больше не входит в occultistTalentRules —
// она конкурирует с той же подменой у Living Legend за один навык, и выбор
// лучшей считает отдельный источник, test/rules/command-substitution.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  gloriousPurposeBonus, infernalMasterCommandBonus, ritePuzzlerLearnMod,
  occultistTalentRules, hasFallbacks, hasInstructor
} from "../../module/rules/occultist-talents.mjs";

const talentOf = (name) => ({ type: "talent", name, system: {} });
const weaponOf = (equipped, bound) => ({
  type: "weapon", system: { equipped, daemonWeapon: { bound } }
});
const daemonTarget = { type: "daemon", system: {} };
const humanTarget = { type: "character", system: {} };

describe("gloriousPurposeBonus: Inf вместо W/F против демона в демоническом оружии", () => {
  const actor = (inf, wp, fel, items) => ({
    items, system: { characteristics: { inf: { total: inf }, wp: { total: wp }, fel: { total: fel } } }
  });

  it("0 без Таланта, даже с оружием и целью-демоном", () => {
    const a = actor(60, 30, 20, [weaponOf(true, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: daemonTarget }, "wp")).toBe(0);
  });

  it("0 с Талантом, но без снаряжённого демонического оружия", () => {
    const a = actor(60, 30, 20, [talentOf("Glorious Purpose"), weaponOf(false, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: daemonTarget }, "wp")).toBe(0);
  });

  it("0 с Талантом и оружием, но цель — не демон", () => {
    const a = actor(60, 30, 20, [talentOf("Glorious Purpose"), weaponOf(true, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: humanTarget }, "wp")).toBe(0);
  });

  it("разница Inf−W, когда выполнены все условия", () => {
    const a = actor(60, 30, 20, [talentOf("Glorious Purpose"), weaponOf(true, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: daemonTarget }, "wp")).toBe(30);
  });

  it("разница Inf−F для char:fel, той же парой условий", () => {
    const a = actor(60, 30, 20, [talentOf("Славное Назначение"), weaponOf(true, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: daemonTarget }, "fel")).toBe(40);
  });

  it("char не wp/fel — не применяется", () => {
    const a = actor(60, 30, 20, [talentOf("Glorious Purpose"), weaponOf(true, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: daemonTarget }, "int")).toBe(0);
  });

  it("0, а не отрицательное число, если своя характеристика выше Inf (выбор, не замена)", () => {
    const a = actor(20, 60, 50, [talentOf("Glorious Purpose"), weaponOf(true, true)]);
    expect(gloriousPurposeBonus(a, { targetActor: daemonTarget }, "wp")).toBe(0);
  });
});

describe("infernalMasterCommandBonus: Forbidden Lore(Daemons)(W) вместо Command против демона", () => {
  const actor = (wp, int, commandTotal, flEntry, items) => ({
    items,
    system: {
      characteristics: { wp: { total: wp }, int: { total: int } },
      skills: { command: { total: commandTotal } },
      groupSkills: { forbiddenLore: flEntry ? [flEntry] : [] }
    }
  });

  it("0 без Таланта", () => {
    const a = actor(50, 30, 20, { specialty: "Daemons", char: "int", total: 50 }, []);
    expect(infernalMasterCommandBonus(a, { targetActor: daemonTarget })).toBe(0);
  });

  it("0 с Талантом, но цель — не демон", () => {
    const a = actor(50, 30, 20, { specialty: "Daemons", char: "int", total: 50 },
      [talentOf("Infernal Master")]);
    expect(infernalMasterCommandBonus(a, { targetActor: humanTarget })).toBe(0);
  });

  it("0 — нет специализации Forbidden Lore (Daemons) на листе", () => {
    const a = actor(50, 30, 20, null, [talentOf("Infernal Master")]);
    expect(infernalMasterCommandBonus(a, { targetActor: daemonTarget })).toBe(0);
  });

  it("разница (FL(Daemons) пересчитан от W) − Command", () => {
    // FL(Daemons) на Int даёт total 50 (int 30 + ранг+мод 20). На W (50) тот
    // же ранг+мод даёт 50+20=70. Command 20 → разница 70-20=50.
    const a = actor(50, 30, 20, { specialty: "Daemons", char: "int", total: 50 },
      [talentOf("Инфернальный Владыка")]);
    expect(infernalMasterCommandBonus(a, { targetActor: daemonTarget })).toBe(50);
  });

  it("0, а не отрицательное число, если свой Command выше подмены (выбор, не замена)", () => {
    // FL(Daemons) на Int даёт total 30 (int 10 + ранг+мод 20). На W (10) тот
    // же ранг+мод даёт 10+20=30. Command 90 — выше подмены.
    const a = actor(10, 10, 90, { specialty: "Daemons", char: "int", total: 30 },
      [talentOf("Infernal Master")]);
    expect(infernalMasterCommandBonus(a, { targetActor: daemonTarget })).toBe(0);
  });
});

describe("ritePuzzlerLearnMod: I−20, или I+0 если присутствовал", () => {
  it("null без Таланта", () => {
    expect(ritePuzzlerLearnMod({ items: [] }, false)).toBeNull();
  });

  it("−20, если не присутствовал", () => {
    expect(ritePuzzlerLearnMod({ items: [talentOf("Rite Puzzler")] }, false)).toBe(-20);
  });

  it("+0 (0), если присутствовал", () => {
    expect(ritePuzzlerLearnMod({ items: [talentOf("Разгадыватель Ритуалов")] }, true)).toBe(0);
  });
});

// Fallbacks / Instructor (Sahara fallbacks-instructor): включатели ассистентов
// ритуала — список ассистентов и бейджи годности живут в
// rules/ritual-assistants.mjs, сюда только «есть ли Талант».
describe("hasFallbacks / hasInstructor: опознаются по имени Таланта", () => {
  it("по английской и русской половине имени", () => {
    expect(hasFallbacks({ items: [talentOf("Fallbacks / Запасные Планы")] })).toBe(true);
    expect(hasFallbacks({ items: [talentOf("Запасные Планы")] })).toBe(true);
    expect(hasInstructor({ items: [talentOf("Instructor / Инструктор")] })).toBe(true);
    expect(hasInstructor({ items: [talentOf("Инструктор")] })).toBe(true);
  });

  it("один Талант не включает другой, пустой актор — нет", () => {
    expect(hasFallbacks({ items: [talentOf("Instructor / Инструктор")] })).toBe(false);
    expect(hasInstructor({ items: [talentOf("Fallbacks / Запасные Планы")] })).toBe(false);
    expect(hasFallbacks({ items: [] })).toBe(false);
    expect(hasInstructor(null)).toBe(false);
  });

  // Trade (Instructor) — Навык, не Талант: предмет другого типа с тем же
  // словом в имени Талантом Инструктор не считается.
  it("предмет не-Талант с таким именем не считается", () => {
    expect(hasInstructor({ items: [{ type: "gear", name: "Instructor", system: {} }] })).toBe(false);
  });
});

describe("occultistTalentRules: правила реестра (rules/sources.mjs)", () => {
  it("пустой список без Талантов/условий", () => {
    const a = { items: [], system: { characteristics: {}, skills: { command: { total: 0 } }, groupSkills: {} } };
    expect(occultistTalentRules(a, {})).toEqual([]);
  });

  it("собирает оба char-правила Glorious Purpose (char:wp/char:fel) разом", () => {
    const a = {
      items: [talentOf("Glorious Purpose"), weaponOf(true, true)],
      system: {
        characteristics: { inf: { total: 60 }, wp: { total: 30 }, fel: { total: 20 }, int: { total: 30 } },
        skills: { command: { total: 20 } },
        groupSkills: { forbiddenLore: [] }
      }
    };
    const rules = occultistTalentRules(a, { targetActor: daemonTarget });
    const byTarget = Object.fromEntries(rules.map(r => [r.effects[0].target, r.effects[0].value]));
    // Inf 60: W 30 → +30, Fel 20 → +40 — оба char-правила ненулевые и оба в списке.
    expect(byTarget["char:wp"]).toBe(30);
    expect(byTarget["char:fel"]).toBe(40);
    expect(rules.length).toBe(2);
  });

  it("не отдаёт skill:command сама — подмену Командования считает command-substitution.mjs", () => {
    const a = {
      items: [talentOf("Infernal Master")],
      system: {
        characteristics: { wp: { total: 30 }, int: { total: 30 } },
        skills: { command: { total: 20 } },
        groupSkills: { forbiddenLore: [{ specialty: "Daemons", char: "int", total: 50 }] }
      }
    };
    expect(occultistTalentRules(a, { targetActor: daemonTarget })).toEqual([]);
  });
});
