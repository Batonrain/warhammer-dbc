// test/rules/egomania.test.mjs
//
// Egomania / Эгомания (wdbc-1rno, Слаанеш): автопобеда во встречном тесте
// социального Навыка (apt2:"social", resolve-test.mjs::isSocialSkill).

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { egomaniaAutoWins, egomaniaOverrideResult } from "../../module/rules/egomania.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function grantEgomaniaTo(bearer) {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.egomania", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.egomania" }] }]
    : []);
}

describe("egomaniaAutoWins", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("Дар + социальный Навык (charm, apt2:social) — true", () => {
    const bearer = {};
    grantEgomaniaTo(bearer);
    expect(egomaniaAutoWins(bearer, "charm")).toBe(true);
  });

  it("Дар, но НЕсоциальный Навык (scrutiny — «общая», не social) — false", () => {
    const bearer = {};
    grantEgomaniaTo(bearer);
    expect(egomaniaAutoWins(bearer, "scrutiny")).toBe(false);
  });

  it("без Дара — false, даже на социальном Навыке", () => {
    clearRuleSources();
    expect(egomaniaAutoWins({}, "charm")).toBe(false);
  });

  it("Навык не задан (тест Характеристики) — false", () => {
    const bearer = {};
    grantEgomaniaTo(bearer);
    expect(egomaniaAutoWins(bearer, null)).toBe(false);
    expect(egomaniaAutoWins(bearer, "")).toBe(false);
  });
});

describe("egomaniaOverrideResult", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("применимо — подменяет победителя на заявленную сторону, margin по модулю не меньше 1", () => {
    const bearer = {};
    grantEgomaniaTo(bearer);
    expect(egomaniaOverrideResult(bearer, "charm", "mine", { winner: "theirs", margin: 4 }))
      .toEqual({ winner: "mine", margin: 4 });
    expect(egomaniaOverrideResult(bearer, "charm", "theirs", { winner: null, margin: 0 }))
      .toEqual({ winner: "theirs", margin: 1 });
  });

  it("не применимо (нет Дара / не социальный Навык) — результат не тронут", () => {
    clearRuleSources();
    const result = { winner: "theirs", margin: 4 };
    expect(egomaniaOverrideResult({}, "charm", "mine", result)).toBe(result);

    const bearer = {};
    grantEgomaniaTo(bearer);
    expect(egomaniaOverrideResult(bearer, "scrutiny", "mine", result)).toBe(result);
  });
});
