// test/rules/weapon-training.test.mjs
//
// Таланты «Арсенал» (стр. 62): Melee Training ограничивает выбор Приёма/
// Стойки/Хвата (здесь — только сам факт владения, attack-dialog.mjs решает,
// что с этим делать), Weapon Training даёт числовой штраф −20 без владения.

import { describe, it, expect } from "vitest";
import { meleeTrainingStatus, weaponTrainingPenalty } from "../../module/rules/weapon-training.mjs";

const talent = (name, specialization) => ({
  type: "talent", name, system: { specialization }
});

const actor = (items = []) => ({ system: { race: "human" }, items });

describe("meleeTrainingStatus", () => {
  it("Булава/Когти/Кулаки/Щит/Крюк/Укус не требуют Таланта вовсе", () => {
    for (const c of ["Булава", "Когти", "Кулаки", "Щит", "Крюк", "Укус"]) {
      expect(meleeTrainingStatus(actor(), c).trained).toBe(true);
    }
  });

  it("Меч без Талантов — не владеет", () => {
    expect(meleeTrainingStatus(actor(), "Меч").trained).toBe(false);
  });

  it("Melee Training (Меч) даёт владение именно Мечом, не Топором", () => {
    const a = actor([talent("Melee Training / Рукопашная Тренировка", "Меч")]);
    expect(meleeTrainingStatus(a, "Меч").trained).toBe(true);
    expect(meleeTrainingStatus(a, "Топор").trained).toBe(false);
  });

  it("сравнение специализации не зависит от регистра/пробелов", () => {
    const a = actor([talent("Melee Training / Рукопашная Тренировка", "  меч ")]);
    expect(meleeTrainingStatus(a, "Меч").trained).toBe(true);
  });

  it("пустая категория (нет meleeCategory на предмете) считается владением", () => {
    expect(meleeTrainingStatus(actor(), "").trained).toBe(true);
  });
});

describe("meleeTrainingStatus — блочные обходы (kind:capability на Талантах)", () => {
  const cap = key => ({
    type: "talent", name: "Legion Weapon Training / Тренировка Легиона",
    system: { specialization: "" },
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { kind: "capability", capabilityKey: key }
    ] }] } }
  });

  it("Legion Weapon Training даёт владение ЛЮБОЙ категорией", () => {
    const a = actor([cap("weapon.trained.legion")]);
    expect(meleeTrainingStatus(a, "Меч").trained).toBe(true);
    expect(meleeTrainingStatus(a, "Копьё").trained).toBe(true);
  });

  it("Arms Master (weapon.trained.allMelee) — то же самое", () => {
    const a = actor([cap("weapon.trained.allMelee")]);
    expect(meleeTrainingStatus(a, "Штык").trained).toBe(true);
  });
});

describe("weaponTrainingPenalty", () => {
  it("гранаты никогда не штрафуются", () => {
    expect(weaponTrainingPenalty({ actor: actor(), weaponType: "bolt", isGrenade: true }).total).toBe(0);
  });

  it("категория без соответствия weaponType («настоящая» экзотика) не проверяется — 0", () => {
    expect(weaponTrainingPenalty({ actor: actor(), weaponType: "exotic" }).total).toBe(0);
  });

  it("грав-оружие без Weapon Training (Grav) — штраф −20", () => {
    const out = weaponTrainingPenalty({ actor: actor(), weaponType: "grav" });
    expect(out.total).toBe(-20);
    expect(out.parts[0].label).toContain("Grav");
  });

  it("Weapon Training (Grav) снимает штраф грав-оружия", () => {
    const a = actor([talent("Weapon Training / Оружейная Тренировка", "Grav")]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "grav" }).total).toBe(0);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "bolt" }).total).toBe(-20);
  });

  it("лук (lowtech, дальнобойное) без Primary/Bow — штраф −20", () => {
    const out = weaponTrainingPenalty({ actor: actor(), weaponType: "lowtech", weaponClass: "basic" });
    expect(out.total).toBe(-20);
    expect(out.parts[0].label).toContain("Primary");
  });

  it("Weapon Training (Primary) снимает штраф лука; Bow — тот же эффект (алиас Primary)", () => {
    const a = actor([talent("Weapon Training / Оружейная Тренировка", "Primary")]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "lowtech", weaponClass: "basic" }).total).toBe(0);
    const b = actor([talent("Weapon Training / Оружейная Тренировка", "Bow")]);
    expect(weaponTrainingPenalty({ actor: b, weaponType: "lowtech", weaponClass: "basic" }).total).toBe(0);
  });

  it("рукопашный lowtech-шаблон (Меч/Топор/Булава) НЕ проверяется этой функцией — 0 всегда", () => {
    expect(weaponTrainingPenalty({ actor: actor(), weaponType: "lowtech", weaponClass: "melee" }).total).toBe(0);
  });

  it("болтган без Weapon Training (Bolt) — штраф −20", () => {
    const out = weaponTrainingPenalty({ actor: actor(), weaponType: "bolt" });
    expect(out.total).toBe(-20);
    expect(out.parts).toHaveLength(1);
  });

  it("Weapon Training (Bolt) снимает штраф именно для bolt-оружия", () => {
    const a = actor([talent("Weapon Training / Оружейная Тренировка", "Bolt")]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "bolt" }).total).toBe(0);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "chain" }).total).toBe(-20);
  });

  it("Las (Талант) соответствует weaponType laser", () => {
    const a = actor([talent("Weapon Training / Оружейная Тренировка", "Las")]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "laser" }).total).toBe(0);
  });

  it("Solid Projectile (Талант) соответствует weaponType solid", () => {
    const a = actor([talent("Weapon Training / Оружейная Тренировка", "Solid Projectile")]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "solid" }).total).toBe(0);
  });

  it("weapon.trained.allRanged (Оракул Стали) снимает штраф для любой категории, кроме настоящей экзотики", () => {
    const a = actor([{
      type: "mutation", name: "Оракул Стали",
      system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { kind: "capability", capabilityKey: "weapon.trained.allRanged" }
      ] }] } }
    }]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "plasma" }).total).toBe(0);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "grav" }).total).toBe(0);
    // «Настоящая» экзотика системой вообще не проверяется — уже 0 и без флага.
    expect(weaponTrainingPenalty({ actor: a, weaponType: "exotic" }).total).toBe(0);
  });

  it("блочный обход (Legion) снимает штраф для любой покрытой категории", () => {
    const a = actor([{
      type: "talent", name: "Legion Weapon Training / Тренировка Легиона",
      system: { specialization: "" },
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { kind: "capability", capabilityKey: "weapon.trained.legion" }
      ] }] } }
    }]);
    expect(weaponTrainingPenalty({ actor: a, weaponType: "plasma" }).total).toBe(0);
  });
});
