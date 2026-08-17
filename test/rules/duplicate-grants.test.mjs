// test/rules/duplicate-grants.test.mjs
//
// Один и тот же Навык или Талант из разных источников при создании персонажа.
//
// Раньше второй источник пропадал впустую: Навык брал лучший из двух рангов, а
// Талант просто не задваивался. По правилу стола совпадение должно что-то
// давать: Навыку — ступень выше, а на потолке возврат опыта; Таланту — возврат
// его цены.

import { describe, it, expect } from "vitest";
import {
  RANK_ORDER, SKILL_REFUND_STEP, nextRank, higherOf, rankIndex,
  skillGrantOutcome, isSameTalent, findSameTalent
} from "../../module/rules/duplicate-grants.mjs";

const talent = (name, specialization = "") => ({ type: "talent", name, system: { specialization } });

describe("ступени Навыка", () => {
  it("порядок роста — от нетренированного до +30", () => {
    expect(RANK_ORDER).toEqual(["untrained", "knows", "trained", "veteran", "expert"]);
  });

  it("следующая ступень, а на потолке её нет", () => {
    expect(nextRank("knows")).toBe("trained");
    expect(nextRank("veteran")).toBe("expert");
    expect(nextRank("expert")).toBeNull();
  });

  it("сравнение рангов не зависит от порядка аргументов", () => {
    expect(higherOf("knows", "veteran")).toBe("veteran");
    expect(higherOf("veteran", "knows")).toBe("veteran");
    expect(rankIndex("нет-такого")).toBe(0);
  });
});

describe("Навык из второго источника", () => {
  it("первая выдача ничего не поднимает — подниматься не с чего", () => {
    const res = skillGrantOutcome("untrained", "knows");
    expect(res).toEqual({ rank: "knows", refundStep: null, duplicate: false });
  });

  it("источник даёт больше — просто берётся больший ранг", () => {
    const res = skillGrantOutcome("knows", "veteran");
    expect(res).toEqual({ rank: "veteran", refundStep: null, duplicate: false });
  });

  // Главное правило: два источника с одним и тем же Навыком дают ступень.
  it("совпадение поднимает на ступень", () => {
    expect(skillGrantOutcome("knows", "knows").rank).toBe("trained");
    expect(skillGrantOutcome("trained", "knows").rank).toBe("veteran");
    expect(skillGrantOutcome("veteran", "trained").rank).toBe("expert");
    expect(skillGrantOutcome("knows", "knows").duplicate).toBe(true);
  });

  it("на потолке ступени нет — возвращается цена третьей покупки", () => {
    const res = skillGrantOutcome("expert", "trained");
    expect(res.rank).toBe("expert");
    expect(res.refundStep).toBe(SKILL_REFUND_STEP);
    expect(res.duplicate).toBe(true);
    // Третья покупка — ступень +30, индекс 3 в таблице цен Навыков.
    expect(SKILL_REFUND_STEP).toBe(3);
  });

  it("возврата нет, пока Навык растёт", () => {
    expect(skillGrantOutcome("knows", "knows").refundStep).toBeNull();
    expect(skillGrantOutcome("veteran", "veteran").refundStep).toBeNull();
  });
});

describe("Талант из второго источника", () => {
  it("тот же Талант узнаётся по имени", () => {
    expect(isSameTalent(talent("Дуэлист"), talent("дуэлист"))).toBe(true);
    expect(isSameTalent(talent("Дуэлист"), talent("Меткий выстрел"))).toBe(false);
  });

  // Специализация делает Талант другим: обучение болтерам и лазганам — разные
  // покупки, и совпадением они не считаются.
  it("специализация различает Таланты", () => {
    expect(isSameTalent(talent("Weapon Training", "Bolt"), talent("Weapon Training", "Las"))).toBe(false);
    expect(isSameTalent(talent("Weapon Training", "Bolt"), talent("Weapon Training", "bolt"))).toBe(true);
  });

  it("совпадение ищется только среди Талантов", () => {
    const items = [
      { type: "trait", name: "Дуэлист", system: {} },
      talent("Дуэлист")
    ];
    expect(findSameTalent(items, talent("Дуэлист"))?.type).toBe("talent");
    expect(findSameTalent([], talent("Дуэлист"))).toBeNull();
    expect(findSameTalent(items, talent("Меткий выстрел"))).toBeNull();
  });

  it("безымянный Талант ни с чем не совпадает", () => {
    expect(isSameTalent(talent(""), talent(""))).toBe(false);
  });
});
