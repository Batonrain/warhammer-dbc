import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { FEARLESS_CAP, JADED_CAP, IDOLATER_CAP } from "../../module/rules/courage-talents.mjs";

const DEFAULT_SOURCES = getRuleSources();

const grant = (...keys) => {
  clearRuleSources();
  registerRuleSource("test", () => keys.map((f, i) =>
    ({ id: `test.courage${i}`, when: {}, effects: [{ kind: "grantFlag", target: f }] })));
};

function person(name = "Боец", { idolNearby = false, inRage = false } = {}) {
  const flags = {};
  return {
    id: name, name, uuid: `Actor.${name}`, type: "character", items: [], effects: [],
    system: {
      inRage, idolNearby, characteristics: { wp: { total: 40 }, ag: { total: 40, bonus: 4 }, t: { total: 40, bonus: 4 } },
      fatigue: { value: 0, max: 0 }, fate: { value: 0 }, actionPoints: { value: 3, max: 3 }, conditions: {}
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    createEmbeddedDocuments: async () => [],
    update: async () => ({})
  };
}

const card = () => captured.chat.at(-1).content;

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "publicroll" };
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("Страх с автоуспехом и выпавшей 100: нет заголовка «Критический Провал!»", () => {
  it("Бесстрашный", async () => {
    grant(FEARLESS_CAP);
    captured.nextRoll = 100;
    await _executeFearRoll(person(), 1, "normal", 0, 0);
    expect(card()).toContain("выстоял");
    expect(card()).not.toContain("Критический Провал");
  });

  it("Пресыщенный с «Земным ужасом»", async () => {
    grant(JADED_CAP);
    captured.nextRoll = 100;
    await _executeFearRoll(person(), 1, "normal", 0, 0, { mundaneHorror: true });
    expect(card()).toContain("выстоял");
    expect(card()).not.toContain("Критический Провал");
  });

  it("Идолопоклонник с кумиром рядом", async () => {
    grant(IDOLATER_CAP);
    captured.nextRoll = 100;
    await _executeFearRoll(person("И", { idolNearby: true }), 1, "normal", 0, 0);
    expect(card()).toContain("выстоял");
    expect(card()).not.toContain("Критический Провал");
  });

  it("Ярость (автопроход Морали)", async () => {
    grant(FEARLESS_CAP);
    captured.nextRoll = 100;
    await _executeFearRoll(person("Берсерк", { inRage: true }), 1, "normal", 0, 0);
    expect(card()).toContain("выстоял");
    expect(card()).not.toContain("Критический Провал");
  });

  it("контроль: без автоуспеха 100 по-прежнему Критический Провал", async () => {
    grant();
    captured.nextRoll = 100;
    await _executeFearRoll(person(), 1, "normal", 0, 0);
    expect(card()).toContain("Критический Провал");
  });

  it("контроль: Критический Успех на автоуспехе остаётся", async () => {
    grant(FEARLESS_CAP);
    captured.nextRoll = 3;
    await _executeFearRoll(person(), 1, "normal", 0, 0);
    expect(card()).toContain("Критический Успех");
  });
});
