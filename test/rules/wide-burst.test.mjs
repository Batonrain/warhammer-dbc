import { describe, it, expect } from "vitest";
import { wideBurstSummary } from "../../module/rules/wide-burst.mjs";

describe("wideBurstSummary", () => {
  it("Короткая очередь RoF 3 даёт 1 попадание", () => {
    const s = wideBurstSummary({ mode: "semi", rofSemi: 3, rofFull: 6 });
    expect(s.applies).toBe(true);
    expect(s.base).toBe(3);
    expect(s.result).toBe(1);
    expect(s.text).toContain("RoF 3 → 1");
    expect(s.text).toContain("не больше 1 попадания");
  });

  it("Длинная очередь берёт RoF из своего поля", () => {
    const s = wideBurstSummary({ mode: "full", rofSemi: 3, rofFull: 6 });
    expect(s.result).toBe(4);
    expect(s.text).toContain("RoF 6 → 4");
    expect(s.text).toContain("не больше 4 попаданий");
  });

  it("Огневая Клеть режет ещё на 3", () => {
    const s = wideBurstSummary({ mode: "full", rofFull: 10, cageFiring: true });
    expect(s.result).toBe(5);
    expect(s.text).toContain("5 попаданий");
  });

  it("Огневая Клеть не уводит ниже нуля", () => {
    expect(wideBurstSummary({ mode: "full", rofFull: 4, cageFiring: true }).result).toBe(0);
  });

  it("у режима с RoF меньше 3 галочка не срабатывает", () => {
    const s = wideBurstSummary({ mode: "semi", rofSemi: 2, rofFull: 6 });
    expect(s.applies).toBe(false);
    expect(s.text).toContain("не сработает");
  });

  it("на одиночный выстрел и подавление не действует", () => {
    for (const mode of ["single", "suppression", "melee", undefined]) {
      const s = wideBurstSummary({ mode, rofSemi: 3, rofFull: 6 });
      expect(s.applies).toBe(false);
      expect(s.text).toContain("только на Короткую и Длинную");
    }
  });
});
