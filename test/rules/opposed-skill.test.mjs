// test/rules/opposed-skill.test.mjs — пары встречных тестов Навыков из книги
// (Основная книга, стр. 57-61; module/rules/opposed-skill.mjs).
import { describe, it, expect } from "vitest";
import { opposedSide } from "../../module/rules/opposed-skill.mjs";

describe("opposedSide", () => {
  it("Скрытность ↔ Внимательность", () => {
    expect(opposedSide("stealth", "ag")).toMatchObject({ testKind: "skill", skillKey: "awareness", charKey: "per", paired: true });
    expect(opposedSide("awareness", "per")).toMatchObject({ skillKey: "stealth", charKey: "ag" });
  });
  it("Обман — Пристальностью, маскировка (бросок с I) — Внимательностью", () => {
    expect(opposedSide("deceive", "fel")).toMatchObject({ skillKey: "scrutiny" });
    expect(opposedSide("deceive", "int")).toMatchObject({ skillKey: "awareness" });
    expect(opposedSide("scrutiny", "per")).toMatchObject({ skillKey: "deceive" });
  });
  it("Очарование, Допрос и Запугивание — тест Силы Воли", () => {
    for (const k of ["charm", "interrogate", "intimidate"]) {
      expect(opposedSide(k, "fel")).toMatchObject({ testKind: "characteristic", skillKey: null, charKey: "wp", paired: true });
    }
  });
  it("Навык без пары в книге — тот же Навык, тест Характеристики — та же Характеристика", () => {
    expect(opposedSide("athletics", "s")).toMatchObject({ testKind: "skill", skillKey: "athletics", charKey: "s", paired: false });
    expect(opposedSide(null, "ag")).toMatchObject({ testKind: "characteristic", skillKey: null, charKey: "ag", paired: false });
  });
  it("Торговля — Характеристика по выбору ГМа (I, P, W или F), по умолчанию I (wdbc-5abej)", () => {
    expect(opposedSide("commerce", "int")).toMatchObject({ testKind: "characteristic", skillKey: null, charKey: "int", paired: true });
    for (const c of ["per", "wp", "fel"]) {
      expect(opposedSide("commerce", "int", { counterChar: c })).toMatchObject({ testKind: "characteristic", charKey: c, paired: true });
    }
    expect(opposedSide("commerce", "int", { counterChar: "s" }).charKey).toBe("int");
  });
});
