// 3-dc87: чистая арифметика Талантов Медика (rules/medic-talents.mjs).
import { describe, it, expect } from "vitest";
import {
  fieldSurgery, radicalTreatment, fastStitchesIb, restitchingAllowed,
  healAssistMax, clampHealAssists, healAssistBonus, councilWounds,
  roundsSinceDeath, reanimateWindow
} from "../../module/rules/medic-talents.mjs";

describe("Полевой Хирург", () => {
  it("Гангрена, Пришивание, Бионика: в поле с Талантом — штраф −20, без Таланта блокируется (решение владельца 24.10.2026)", () => {
    for (const mode of ["gangreneSurgery", "reattach", "bionic"]) {
      expect(fieldSurgery({ mode, theatre: false, hasTalent: true })).toEqual({ penalty: -20, blocked: false, inField: true });
      expect(fieldSurgery({ mode, theatre: false, hasTalent: false })).toEqual({ penalty: 0, blocked: true, inField: false });
    }
  });
  it("со стационаром штрафа и блокировки нет — с Талантом и без", () => {
    for (const mode of ["gangreneSurgery", "reattach", "bionic"]) {
      for (const hasTalent of [true, false]) {
        expect(fieldSurgery({ mode, theatre: true, hasTalent })).toEqual({ penalty: 0, blocked: false, inField: false });
      }
    }
  });
  it("не операционные режимы не затронуты (решение владельца: только три режима)", () => {
    for (const mode of ["firstAid", "amputate", "stopBleeding", "coma", "disease", "stumpCare", "setLimb"]) {
      expect(fieldSurgery({ mode, theatre: false, hasTalent: true })).toEqual({ penalty: 0, blocked: false, inField: false });
    }
  });
  it("по умолчанию (стационара нет, Таланта нет) Пришивание и Бионика заблокированы", () => {
    expect(fieldSurgery({ mode: "reattach" }).blocked).toBe(true);
    expect(fieldSurgery({ mode: "bionic" }).blocked).toBe(true);
  });
});

describe("Радикальное Лечение", () => {
  it("−10/−20/−30 ↔ +1/+2/+3", () => {
    expect(radicalTreatment(1)).toEqual({ level: 1, mod: -10, bonus: 1 });
    expect(radicalTreatment("2")).toEqual({ level: 2, mod: -20, bonus: 2 });
    expect(radicalTreatment(3)).toEqual({ level: 3, mod: -30, bonus: 3 });
  });
  it("мусор и выход за пределы — ноль", () => {
    expect(radicalTreatment(4).level).toBe(0);
    expect(radicalTreatment(-1).level).toBe(0);
    expect(radicalTreatment(undefined).level).toBe(0);
  });
});

describe("Быстрые Стежки", () => {
  it("I.b вдвое ниже, округление вверх", () => {
    expect(fastStitchesIb(4)).toBe(2);
    expect(fastStitchesIb(5)).toBe(3);
    expect(fastStitchesIb(1)).toBe(1);
    expect(fastStitchesIb(0)).toBe(0);
  });
});

describe("Перешивание", () => {
  const base = { used: true, failed: true, at: 1000, now: 1000 + 4 * 60, ib: 4 };
  it("провал и в пределах I.b минут — можно", () => {
    expect(restitchingAllowed(base)).toBe(true);
    expect(restitchingAllowed({ ...base, now: 1000 + 4 * 60 + 1 })).toBe(false);
  });
  it("успешная или не использованная Первая Помощь — повтор не нужен", () => {
    expect(restitchingAllowed({ ...base, failed: false })).toBe(false);
    expect(restitchingAllowed({ ...base, used: false })).toBe(false);
  });
  it("без метки времени (старые акторы) — нельзя; время назад — нельзя", () => {
    expect(restitchingAllowed({ ...base, at: null })).toBe(false);
    expect(restitchingAllowed({ ...base, now: 500 })).toBe(false);
  });
});

describe("Консилиум", () => {
  it("максимум ассистентов 2, с Консилиумом 4", () => {
    expect(healAssistMax(false)).toBe(2);
    expect(healAssistMax(true)).toBe(4);
    expect(clampHealAssists(9, true)).toBe(4);
    expect(clampHealAssists(9, false)).toBe(2);
    expect(clampHealAssists(-3, true)).toBe(0);
  });
  it("+10 к Порогу за ассистента; +2 Раны за ассистента только у Консилиума", () => {
    expect(healAssistBonus(3)).toBe(30);
    expect(councilWounds(true, 3)).toBe(6);
    expect(councilWounds(false, 3)).toBe(0);
  });
});

describe("Реанимировать", () => {
  it("в бою — разница Раундов той же схватки", () => {
    expect(roundsSinceDeath({ worldTime: 0, combatId: "c1", round: 2 }, { worldTime: 999, combatId: "c1", round: 5 })).toBe(3);
  });
  it("вне боя — по мировому времени, Раунд = 6 с", () => {
    expect(roundsSinceDeath({ worldTime: 100, combatId: null, round: null }, { worldTime: 100 + 61, combatId: null })).toBe(10);
  });
  it("другая схватка — тоже по мировому времени", () => {
    expect(roundsSinceDeath({ worldTime: 0, combatId: "c1", round: 2 }, { worldTime: 12, combatId: "c2", round: 9 })).toBe(2);
  });
  it("метки нет — null; допуск не блокирует", () => {
    expect(roundsSinceDeath(null, {})).toBeNull();
    expect(reanimateWindow(null, 3).ok).toBe(true);
  });
  it("не более Cor.b Раундов — ок; дольше — не получается вовсе", () => {
    expect(reanimateWindow(3, 3).ok).toBe(true);
    expect(reanimateWindow(4, 3)).toEqual({ ok: false, rounds: 4, limit: 3 });
  });
});
