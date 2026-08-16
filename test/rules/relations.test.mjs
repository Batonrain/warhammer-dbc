// test/rules/relations.test.mjs
//
// Таблица «Отношения по Умениям»: один и тот же модификатор называется
// по-разному в зависимости от Навыка. +20 — это Нежность для Обаяния,
// Преданность для Командования, Доверие для Обмана и Напуган для Запугивания.

import { describe, it, expect } from "vitest";
import { RELATION_SKILLS, RELATION_STEPS, RELATION_LABELS,
         relationStep, relationLabel, emptyRelationMods } from "../../module/constants/relations.mjs";

describe("таблица Отношений", () => {
  it("четыре Навыка и семь ступеней от +30 до −30", () => {
    expect(RELATION_SKILLS.map(s => s.key)).toEqual(["charm", "command", "deceive", "intimidate"]);
    expect(RELATION_STEPS).toEqual([30, 20, 10, 0, -10, -20, -30]);
  });

  it("у каждой ступени подписан каждый Навык", () => {
    for (const step of RELATION_STEPS)
      for (const skill of RELATION_SKILLS)
        expect(RELATION_LABELS[String(step)][skill.key]).toBeTruthy();
  });

  it("названия совпадают с книгой", () => {
    expect(relationLabel("charm", 30)).toBe("Безрассудство");
    expect(relationLabel("command", 20)).toBe("Преданность");
    expect(relationLabel("deceive", -10)).toBe("Подозрение");
    expect(relationLabel("intimidate", -30)).toBe("Безбашенность");
    expect(relationLabel("charm", 0)).toBe("Безразличие");
  });
});

describe("relationStep", () => {
  it("значение между строками округляется к ближайшей", () => {
    expect(relationStep(14)).toBe(10);
    expect(relationStep(16)).toBe(20);
    expect(relationStep(-27)).toBe(-30);
  });

  it("за краями таблицы — крайние ступени", () => {
    expect(relationStep(999)).toBe(30);
    expect(relationStep(-999)).toBe(-30);
    expect(relationStep(undefined)).toBe(0);
  });
});

describe("emptyRelationMods", () => {
  it("новое отношение — Безразличие по всем Навыкам", () => {
    const mods = emptyRelationMods();
    expect(Object.keys(mods).sort()).toEqual(["charm", "command", "deceive", "intimidate"]);
    expect(Object.values(mods).every(v => v === 0)).toBe(true);
    for (const skill of RELATION_SKILLS)
      expect(relationLabel(skill.key, mods[skill.key])).toBe("Безразличие");
  });
});
