// test/rules/beyond-human.test.mjs
//
// За Гранью Человека (Общие Таланты, стр. 62): «Трейт Unnatural Characteristic
// (+1) для соответствующей Характеристики», требование «Характеристика 70»,
// специализации WS, BS, S, T, A, I, P, W, F. Чистая логика без Foundry.

import { describe, it, expect } from "vitest";
import {
  BEYOND_HUMAN_CHARS, isBeyondHuman, beyondHumanCharKey, beyondHumanChars,
  beyondHumanRating, canKeepFirstResult, firstResultOutcome
} from "../../module/rules/beyond-human.mjs";
import { unnaturalRating, hasUnnaturalCharacteristic } from "../../module/rules/unnatural-characteristic.mjs";
import { checkRequirement, checkBeyondHumanChar, parseRequirement } from "../../module/constants/talent-requirements.mjs";

const bh = (aptSource, specialization = "") => ({
  type: "talent", name: "Beyond Human / За Гранью Человека", system: { aptSource, specialization }
});

describe("За Гранью Человека: привязка", () => {
  it("опознаётся по любой половине имени", () => {
    expect(isBeyondHuman(bh("s"))).toBe(true);
    expect(isBeyondHuman({ type: "talent", name: "За Гранью Человека", system: {} })).toBe(true);
    expect(isBeyondHuman({ type: "trait", name: "Beyond Human", system: {} })).toBe(false);
    expect(isBeyondHuman({ type: "talent", name: "Mastery / Мастерство", system: {} })).toBe(false);
  });

  it("девять специализаций книги, без Влияния", () => {
    expect(BEYOND_HUMAN_CHARS).toEqual(["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"]);
    expect(BEYOND_HUMAN_CHARS).not.toContain("inf");
  });

  it("ключ берётся из aptSource", () => {
    expect(beyondHumanCharKey(bh("wp"))).toBe("wp");
  });

  it("нет aptSource — восстанавливается по подписи", () => {
    expect(beyondHumanCharKey(bh("", "Сила"))).toBe("s");
    expect(beyondHumanCharKey(bh("", "Ag"))).toBe("ag");
    expect(beyondHumanCharKey(bh("", "Воля"))).toBe("wp");
  });

  it("Влияние не принимается: привязки нет", () => {
    expect(beyondHumanCharKey(bh("inf"))).toBe("");
  });

  it("без привязки Талант ничего не усиливает", () => {
    expect(beyondHumanChars([bh("")]).size).toBe(0);
  });
});

describe("За Гранью Человека: Unnatural (+1)", () => {
  it("даёт рейтинг 1 привязанной Характеристике и больше никакой", () => {
    const actor = { items: [bh("s")] };
    expect(beyondHumanRating(actor, "s")).toBe(1);
    expect(beyondHumanRating(actor, "t")).toBe(0);
  });

  it("две копии на одну Характеристику не складываются", () => {
    const actor = { items: [bh("s"), bh("s")] };
    expect(beyondHumanRating(actor, "s")).toBe(1);
  });

  it("разные Характеристики — каждая получает своё +1", () => {
    const actor = { items: [bh("s"), bh("t")] };
    expect(beyondHumanRating(actor, "s")).toBe(1);
    expect(beyondHumanRating(actor, "t")).toBe(1);
  });

  it("складывается с обычным трейтом Unnatural в рейтинг Сверхъестественного", () => {
    const trait = { type: "trait", name: "Unnatural S (+3) / Сверхъест. Сила",
      system: { effects: { charBonuses: [{ stat: "s", value: 3 }] } } };
    const actor = { items: [trait, bh("s")] };
    expect(unnaturalRating(actor, "s")).toBe(4);
    expect(hasUnnaturalCharacteristic(actor, "s")).toBe(true);
  });

  it("один Талант без других источников: рейтинг 1 (степеней за него пока нет, ⌊1/2⌋ = 0)", () => {
    const actor = { items: [bh("ag")] };
    expect(unnaturalRating(actor, "ag")).toBe(1);
    expect(hasUnnaturalCharacteristic(actor, "ag")).toBe(true);
  });
});

describe("За Гранью Человека: оставить первый результат", () => {
  it("можно только на ту Характеристику, к которой привязан Талант", () => {
    const actor = { items: [bh("bs")] };
    expect(canKeepFirstResult(actor, "bs")).toBe(true);
    expect(canKeepFirstResult(actor, "ws")).toBe(false);
    expect(canKeepFirstResult(actor, "")).toBe(false);
    expect(canKeepFirstResult({ items: [] }, "bs")).toBe(false);
  });

  it("исход первого результата считается по тем же правилам, что у теста", () => {
    expect(firstResultOutcome({ rv: 30, threshold: 50 })).toEqual({ success: true, deg: 3 });
    expect(firstResultOutcome({ rv: 80, threshold: 50 })).toEqual({ success: false, deg: 4 });
    expect(firstResultOutcome({ rv: 30, threshold: null })).toEqual({ success: null, deg: null });
  });
});

describe("За Гранью Человека: Требование «Характеристика 70»", () => {
  const actorWith = chars => ({ system: { characteristics: Object.fromEntries(
    Object.entries(chars).map(([k, total]) => [k, { total }])) } });

  it("строка разбирается как «любая Характеристика не ниже 70»", () => {
    const [part] = parseRequirement("Характеристика 70");
    expect(part.alts[0]).toMatchObject({ kind: "anyChar", value: 70 });
  });

  it("выполнено, если хоть одна из девяти Характеристик ≥ 70", () => {
    expect(checkRequirement(actorWith({ ws: 40, s: 70 }), "Характеристика 70").state).toBe("ok");
    expect(checkRequirement(actorWith({ ws: 40, s: 69 }), "Характеристика 70").state).toBe("fail");
  });

  it("Влияние в счёт не идёт: у книги его нет среди специализаций", () => {
    expect(checkRequirement(actorWith({ ws: 40, inf: 90 }), "Характеристика 70").state).toBe("fail");
  });

  it("по выбранной привязке: ровно 70 проходит, 69 — нет", () => {
    expect(checkBeyondHumanChar(actorWith({ s: 70 }), "s")).toBe(true);
    expect(checkBeyondHumanChar(actorWith({ s: 69 }), "s")).toBe(false);
    expect(checkBeyondHumanChar(actorWith({}), "s")).toBe(null);
  });
});
