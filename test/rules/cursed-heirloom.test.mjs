// test/rules/cursed-heirloom.test.mjs
//
// Cursed Heirloom / Проклятое Наследство (Арсенал, стр. 62, wdbc-3-65ff):
// таблица d5 проклятий — чистая часть, Foundry-обвязка в apps/cursed-heirloom.mjs.

import { describe, it, expect } from "vitest";
import { CURSE_TABLE, curseForRoll, CURSED_HEIRLOOM_MAX_AVAILABILITY, notesWithCurse } from "../../module/rules/cursed-heirloom.mjs";

describe("CURSE_TABLE", () => {
  it("ровно пять проклятий, по одному на каждую грань d5", () => {
    expect(CURSE_TABLE).toHaveLength(5);
    expect(CURSE_TABLE.map(c => c.roll).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("у каждого проклятья есть уникальный ключ, имя и текст", () => {
    const keys = CURSE_TABLE.map(c => c.key);
    expect(new Set(keys).size).toBe(5);
    for (const c of CURSE_TABLE) {
      expect(c.name).toBeTruthy();
      expect(c.text).toBeTruthy();
    }
  });
});

describe("curseForRoll", () => {
  it("каждая грань d5 даёт своё проклятье", () => {
    expect(curseForRoll(1).key).toBe("bloodlust");
    expect(curseForRoll(2).key).toBe("repulsive");
    expect(curseForRoll(3).key).toBe("contagious");
    expect(curseForRoll(4).key).toBe("illFate");
    expect(curseForRoll(5).key).toBe("toxic");
  });

  it("вне диапазона d5 — null", () => {
    expect(curseForRoll(0)).toBe(null);
    expect(curseForRoll(6)).toBe(null);
  });
});

describe("CURSED_HEIRLOOM_MAX_AVAILABILITY", () => {
  it("потолок Редкости — 4, как в книге", () => {
    expect(CURSED_HEIRLOOM_MAX_AVAILABILITY).toBe(4);
  });
});

// Проклятье должно быть видно на листе предмета — флаг лист не показывает,
// поэтому текст дописывается в «Заметки» оружия (HTMLField).
describe("notesWithCurse", () => {
  const curse = curseForRoll(2);
  it("дописывает имя и текст проклятья к заметкам предмета", () => {
    const html = notesWithCurse("<p>Старые заметки</p>", curse);
    expect(html.startsWith("<p>Старые заметки</p>")).toBe(true);
    expect(html).toContain(curse.name);
    expect(html).toContain(curse.text);
  });
  it("пустые заметки — только проклятье", () => {
    expect(notesWithCurse("", curse)).toContain(curse.name);
  });
});
