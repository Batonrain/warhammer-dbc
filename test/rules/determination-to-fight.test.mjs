// test/rules/determination-to-fight.test.mjs

import { describe, it, expect } from "vitest";
import {
  hasDeterminationToFight, determinationToFightReduction,
  snapshotStanceForRoundStart, determinationToFightWsReduction, determinationToFightParryBonus,
  determinationToFightApBonus
} from "../../module/rules/determination-to-fight.mjs";

const actorWith = (tier, wpBonus, ...talentNames) => ({
  system: { wounds: { tier }, characteristics: { wp: { bonus: wpBonus } } },
  items: talentNames.map(name => ({ type: "talent", name }))
});

function flaggedActor({ tier = "dying", wpBonus = 4, wsBonus = 3, meleeStance = "standard", stanceLastRound, hasTalent = true } = {}) {
  const flags = {};
  if (stanceLastRound !== undefined) flags["warhammer-dbc.stanceLastRound"] = stanceLastRound;
  return {
    system: {
      wounds: { tier },
      characteristics: { wp: { bonus: wpBonus }, ws: { bonus: wsBonus } },
      meleeStance
    },
    items: hasTalent ? [{ type: "talent", name: "Determination To Fight / Решительность Сражаться" }] : [],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

describe("hasDeterminationToFight", () => {
  it("находит по билингвальному имени", () => {
    expect(hasDeterminationToFight(actorWith("dying", 4, "Determination To Fight / Решительность Сражаться"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasDeterminationToFight(actorWith("dying", 4, "Dodge"))).toBe(false);
  });
});

describe("determinationToFightReduction", () => {
  it("Талант + dying — WP.b", () => {
    expect(determinationToFightReduction(actorWith("dying", 4, "Determination To Fight / Решительность Сражаться"))).toBe(4);
  });
  it("минимум 1, даже при WP.b=0", () => {
    expect(determinationToFightReduction(actorWith("dying", 0, "Determination To Fight / Решительность Сражаться"))).toBe(1);
  });
  it("не dying — 0", () => {
    expect(determinationToFightReduction(actorWith("heavy", 4, "Determination To Fight / Решительность Сражаться"))).toBe(0);
  });
  it("нет Таланта — 0", () => {
    expect(determinationToFightReduction(actorWith("dying", 4))).toBe(0);
  });
  it("нет актора — 0, не падает", () => {
    expect(determinationToFightReduction(null)).toBe(0);
  });
});

describe("snapshotStanceForRoundStart", () => {
  it("снимает текущую Стойку актора во флаг stanceLastRound", async () => {
    const actor = flaggedActor({ meleeStance: "defensive" });
    await snapshotStanceForRoundStart({ combatants: [{ actor }] });
    expect(actor.getFlag("warhammer-dbc", "stanceLastRound")).toBe("defensive");
  });

  it("перезаписывает предыдущий снимок новым раундом", async () => {
    const actor = flaggedActor({ meleeStance: "standard", stanceLastRound: "defensive" });
    await snapshotStanceForRoundStart({ combatants: [{ actor }] });
    expect(actor.getFlag("warhammer-dbc", "stanceLastRound")).toBe("standard");
  });

  it("комбатант без актора/без meleeStance — пропускается, не падает", async () => {
    await expect(snapshotStanceForRoundStart({ combatants: [{ actor: null }, { actor: { system: {} } }] })).resolves.toBeUndefined();
  });

  it("нет combat — не падает", async () => {
    await expect(snapshotStanceForRoundStart(null)).resolves.toBeUndefined();
  });
});

describe("determinationToFightWsReduction", () => {
  it("Талант + dying + прошлый раунд Защитная Стойка — WS.b", () => {
    expect(determinationToFightWsReduction(flaggedActor({ wsBonus: 3, stanceLastRound: "defensive" }))).toBe(3);
  });
  it("минимум 1, даже при WS.b=0", () => {
    expect(determinationToFightWsReduction(flaggedActor({ wsBonus: 0, stanceLastRound: "defensive" }))).toBe(1);
  });
  it("прошлый раунд НЕ Защитная — 0", () => {
    expect(determinationToFightWsReduction(flaggedActor({ stanceLastRound: "aggressive" }))).toBe(0);
  });
  it("нет снимка вовсе (флаг не ставился) — 0", () => {
    expect(determinationToFightWsReduction(flaggedActor({ stanceLastRound: undefined }))).toBe(0);
  });
  it("не dying, даже с Защитной Стойкой в прошлом раунде — 0", () => {
    expect(determinationToFightWsReduction(flaggedActor({ tier: "heavy", stanceLastRound: "defensive" }))).toBe(0);
  });
  it("нет Таланта — 0", () => {
    expect(determinationToFightWsReduction(flaggedActor({ hasTalent: false, stanceLastRound: "defensive" }))).toBe(0);
  });
  it("нет актора — 0, не падает", () => {
    expect(determinationToFightWsReduction(null)).toBe(0);
  });
});

describe("determinationToFightParryBonus", () => {
  it("Талант + dying + прошлый раунд Защитная Стойка — +30", () => {
    expect(determinationToFightParryBonus(flaggedActor({ stanceLastRound: "defensive" }))).toBe(30);
  });
  it("прошлый раунд НЕ Защитная — 0", () => {
    expect(determinationToFightParryBonus(flaggedActor({ stanceLastRound: "standard" }))).toBe(0);
  });
  it("не dying — 0", () => {
    expect(determinationToFightParryBonus(flaggedActor({ tier: "heavy", stanceLastRound: "defensive" }))).toBe(0);
  });
  it("нет Таланта — 0", () => {
    expect(determinationToFightParryBonus(flaggedActor({ hasTalent: false, stanceLastRound: "defensive" }))).toBe(0);
  });
});

describe("determinationToFightApBonus", () => {
  it("Талант + dying — +1, независимо от Стойки прошлого раунда", () => {
    expect(determinationToFightApBonus(actorWith("dying", 4, "Determination To Fight / Решительность Сражаться"))).toBe(1);
  });
  it("не dying — 0", () => {
    expect(determinationToFightApBonus(actorWith("heavy", 4, "Determination To Fight / Решительность Сражаться"))).toBe(0);
  });
  it("нет Таланта — 0", () => {
    expect(determinationToFightApBonus(actorWith("dying", 4))).toBe(0);
  });
  it("нет актора — 0, не падает", () => {
    expect(determinationToFightApBonus(null)).toBe(0);
  });
});
