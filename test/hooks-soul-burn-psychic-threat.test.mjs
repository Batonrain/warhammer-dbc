// test/hooks-soul-burn-psychic-threat.test.mjs
//
// wdbc-1rno.35/.46 (Наследие Крови, третья часть, стр. 427): «+10 на все
// встречные тесты против ... выжигания души» — _executeSoulBurn (module/
// hooks.mjs) — единственное место в системе, где реально катается встречный
// тест Выжигания Души. Проверяет, что ctx.psychicThreat уходит ТОЛЬКО с
// тестом цели (защищающейся стороны), не с тестом псайкера (атакующего).

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../module/rules/sources.mjs";

const { _executeSoulBurn } = await import("../module/hooks.mjs");

const DEFAULT_SOURCES = getRuleSources();

beforeEach(() => resetCaptured());
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

/** Оба «Порога» карточки по порядку: [псайкер, цель]. */
function thresholds(html) {
  return [...html.matchAll(/<label>Порог<\/label><b>(-?\d+)<\/b>/g)].map(m => Number(m[1]));
}

function participant(wp = 40) {
  return {
    name: "Подставной", uuid: "Actor.p1",
    system: { characteristics: { wp: { total: wp } }, psyker: { currentRating: 0 }, wounds: { value: 10, max: 10, critical: 0 } },
    update: async () => {}
  };
}

describe("_executeSoulBurn: psychicThreat на встречном тесте цели", () => {
  it("правило target:psychicThreat сдвигает Порог ТОЛЬКО у цели, не у псайкера", async () => {
    clearRuleSources();
    registerRuleSource("test.blood", () => [{
      id: "test.blood", label: "Наследие Крови", when: {},
      effects: [{ kind: "rollBonus", target: "psychicThreat", value: 10 }]
    }]);

    const attacker = participant(40); // pEff без бонуса: 40
    const target   = participant(30); // tEff с бонусом: 30+10=40
    captured.dice = [50, 35]; // псайкер: 50>40 провал; цель: 35<=40 успех (был бы провал без +10)

    await _executeSoulBurn(attacker, target);

    const card = captured.chat.at(-1).content;
    expect(thresholds(card)).toEqual([40, 40]); // псайкер 40 (без бонуса), цель 30+10=40
    expect(card).toContain("Цель устояла"); // псайкер провалил тест — душа не выжжена
  });

  it("без правила — Порог цели остаётся голым (без +10)", async () => {
    const attacker = participant(40);
    const target   = participant(30);
    captured.dice = [50, 35];

    await _executeSoulBurn(attacker, target);

    expect(thresholds(captured.chat.at(-1).content)).toEqual([40, 30]);
  });
});
