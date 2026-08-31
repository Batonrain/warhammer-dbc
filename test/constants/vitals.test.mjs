// test/constants/vitals.test.mjs
//
// module/constants/vitals.mjs — автопрогресс стадий Голода/Жажды/Сна по
// game.time.worldTime (wdbc-jnqj): vitalNaturalStage (чистая функция «сутки
// прошло → стадия») и vitalEffectiveStage (max с сохранённой стадией).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { vitalNaturalStage, vitalEffectiveStage, VITAL_TIME_FIELD } from "../../module/constants/vitals.mjs";

const DAY = 86400;

describe("vitalNaturalStage", () => {
  it("null-метка — стадия 0 (ещё не инициализировано, без штрафа задним числом)", () => {
    expect(vitalNaturalStage("hunger", null, 999 * DAY)).toBe(0);
  });

  it("Голод: ½T.b суток без еды → стадия 1, дальше +3/+6 суток голодания → 2/3", () => {
    const ctx = { tb: 6 }; // ½T.b = 3 → пороги 3 / 6 / 9 суток
    expect(vitalNaturalStage("hunger", 0, 2 * DAY, ctx)).toBe(0);
    expect(vitalNaturalStage("hunger", 0, 3 * DAY, ctx)).toBe(1);
    expect(vitalNaturalStage("hunger", 0, 6 * DAY, ctx)).toBe(2);
    expect(vitalNaturalStage("hunger", 0, 9 * DAY, ctx)).toBe(3);
  });

  it("Голод: T.b 0-1 (или неизвестный вызывающему) — порог не ниже суток", () => {
    // Иначе ½T.b = 0 суток: персонаж «голоден» (−10 ко всем характеристикам)
    // ровно в тот момент, когда поел.
    expect(vitalNaturalStage("hunger", 0, 0, { tb: 0 })).toBe(0);
    expect(vitalNaturalStage("hunger", 0, 0.5 * DAY, { tb: 1 })).toBe(0);
    expect(vitalNaturalStage("hunger", 0, DAY, { tb: 0 })).toBe(1);
  });

  it("Жажда: порог 2 суток (человек) / 7 суток (космодесантник)", () => {
    expect(vitalNaturalStage("thirst", 0, 1.9 * DAY)).toBe(0);
    expect(vitalNaturalStage("thirst", 0, 2 * DAY)).toBe(1);
    expect(vitalNaturalStage("thirst", 0, 4 * DAY)).toBe(3);

    const sm = { isAstartes: true };
    expect(vitalNaturalStage("thirst", 0, 6.9 * DAY, sm)).toBe(0);
    expect(vitalNaturalStage("thirst", 0, 7 * DAY, sm)).toBe(1);
    expect(vitalNaturalStage("thirst", 0, 9 * DAY, sm)).toBe(3);
  });

  it("Сон: 1/2/3 бессонные сутки подряд", () => {
    expect(vitalNaturalStage("sleep", 0, 0.9 * DAY)).toBe(0);
    expect(vitalNaturalStage("sleep", 0, DAY)).toBe(1);
    expect(vitalNaturalStage("sleep", 0, 2 * DAY)).toBe(2);
    expect(vitalNaturalStage("sleep", 0, 3 * DAY)).toBe(3);
  });

  it("не превышает потолок 3 даже при огромном интервале", () => {
    expect(vitalNaturalStage("hunger", 0, 365 * DAY, { tb: 6 })).toBe(3);
  });
});

describe("vitalEffectiveStage", () => {
  it("берёт максимум сохранённой стадии и естественной по времени", () => {
    // Сохранено 1, но по времени давно должно быть 3 — автопрогресс побеждает.
    expect(vitalEffectiveStage("hunger", 1, 0, 9 * DAY, { tb: 6 })).toBe(3);
    // Сохранено 3 (например, ручной штраф ГМа), метка свежая — время ещё не подняло бы.
    expect(vitalEffectiveStage("hunger", 3, 9 * DAY, 9 * DAY, { tb: 6 })).toBe(3);
  });

  it("без метки времени (null) отдаёт ровно сохранённую стадию", () => {
    expect(vitalEffectiveStage("sleep", 2, null, 999 * DAY)).toBe(2);
  });
});

describe("VITAL_TIME_FIELD", () => {
  it("сопоставляет каждый Витал своему полю метки времени", () => {
    expect(VITAL_TIME_FIELD).toEqual({ hunger: "lastFed", thirst: "lastDrank", sleep: "lastSlept" });
  });
});
