// test/rules/training-advantage.test.mjs
//
// Teacher/Учитель и вторая половина Clear Mind/Чистый Разум поверх базового
// курса Обучения (module/rules/training.mjs). Klaivex/Interpreter — отдельные
// находки (см. заголовок module/rules/training-advantage.mjs), не здесь.

import { describe, it, expect } from "vitest";
import { hasTeacherTalent, hasClearMind, sharePath, clearMindTeachBonus } from "../../module/rules/training-advantage.mjs";

const actorWith = (type, ...names) => ({ items: names.map(name => ({ type, name })) });

describe("hasTeacherTalent / hasClearMind", () => {
  it("находит по билингвальному имени, по правильному типу предмета", () => {
    expect(hasTeacherTalent(actorWith("talent", "Teacher / Учитель"))).toBe(true);
    expect(hasClearMind(actorWith("trait", "Clear Mind / Чистый Разум"))).toBe(true);
  });
  it("Талант с тем же именем не считается Трейтом и наоборот", () => {
    expect(hasClearMind(actorWith("talent", "Clear Mind / Чистый Разум"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasTeacherTalent(null)).toBe(false);
    expect(hasClearMind(undefined)).toBe(false);
  });
});

describe("sharePath", () => {
  const withPaths = (...keys) => ({ system: { paths: keys.map(key => ({ key, grade: "novice" })) } });
  it("общий ключ Пути — true", () => {
    expect(sharePath(withPaths("warrior", "artisan"), withPaths("seer", "warrior"))).toBe(true);
  });
  it("нет общих — false", () => {
    expect(sharePath(withPaths("warrior"), withPaths("seer"))).toBe(false);
  });
  it("у учителя нет Путей вовсе — false, не падает", () => {
    expect(sharePath(withPaths(), withPaths("seer"))).toBe(false);
    expect(sharePath({}, withPaths("seer"))).toBe(false);
  });
});

describe("clearMindTeachBonus", () => {
  const withPaths = (...keys) => ({ items: [], system: { paths: keys.map(key => ({ key })) } });
  const teacher = { items: [{ type: "trait", name: "Clear Mind / Чистый Разум" }], system: { paths: [{ key: "warrior" }] } };

  it("нет Трейта — 0", () => {
    expect(clearMindTeachBonus({ items: [] }, withPaths("warrior"))).toBe(0);
  });
  it("общий Путь с учеником — +60", () => {
    expect(clearMindTeachBonus(teacher, withPaths("warrior"))).toBe(60);
  });
  it("разные Пути — +30 (÷2)", () => {
    expect(clearMindTeachBonus(teacher, withPaths("seer"))).toBe(30);
  });
});
