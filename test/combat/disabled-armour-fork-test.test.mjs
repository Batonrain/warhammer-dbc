// test/combat/disabled-armour-fork-test.test.mjs
//
// «В начале Хода или при отключении брони — тест S+0 или Athletics(S)+10,
// по своему выбору, или Max.A брони уменьшается до 10» (стр. 233,
// «Выключенная Силовая Броня») — часть 3 wdbc-rdd.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  useDisabledArmourForkTest,
  promptDisabledArmourForkTest
} from "../../module/combat/armor-mods.mjs";

const FLAG = "warhammer-dbc";
const MAX_AGILITY_FORCED_FLAG = "disabledArmourMaxAgilityForced10";

// Вес 150 между Ношением 100 и Подъёмом 200 → тир 1 (moveAtkMod -10, testPenalty 0);
// disabledArmourPenalty(actor,{charKey:"s"}) пересчитает то же самое из items/encumbrance
// независимо от переданного actor.system.disabledArmourOverload — оба должны совпадать.
const TIER1 = { tier: 1, moveAtkMod: -10, spdMod: -1, fullActionOnly: false, helpless: false, testPenalty: 0 };
const TIER2 = { tier: 2, moveAtkMod: -10, spdMod: -1, fullActionOnly: true,  helpless: false, testPenalty: -20 };
const TIER3 = { tier: 3, moveAtkMod: -10, spdMod: -1, fullActionOnly: true,  helpless: true,  testPenalty: -20 };

function actorWith({ s = 40, athletics = 30, overload = TIER1, armourWeight = 150, forced10 } = {}) {
  const flags = {};
  if (forced10 !== undefined) flags[MAX_AGILITY_FORCED_FLAG] = forced10;
  const actor = {
    id: "actor-1", name: "Тестовый Астартес",
    system: {
      characteristics: { s: { total: s, bonus: 0 } },
      skills: { athletics: { total: athletics } },
      encumbrance: { carry: 100, lift: 200, push: 400 },
      disabledArmourOverload: overload
    },
    items: armourWeight > 0
      ? [{ type: "armor", system: { equipped: true, armorType: "power", active: false, weight: armourWeight } }]
      : [],
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; }
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 100000 };
  globalThis.game.user = { isGM: true };
});

describe("useDisabledArmourForkTest", () => {
  it("перевеса нет — предупреждает, кубы не бросает", async () => {
    const actor = actorWith({ overload: null, armourWeight: 0 });
    await useDisabledArmourForkTest(actor, { skillKey: "s" });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("тир 3 — уже безусловно Беспомощен, тест не нужен", async () => {
    const actor = actorWith({ overload: TIER3, armourWeight: 500 });
    await useDisabledArmourForkTest(actor, { skillKey: "s" });
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("тир 1, S+0, успех — флаг Max.A не ставится", async () => {
    // eff = 40 (S) + armourPenalty(-20) + testPenalty(0) = 20; бросок 10 ≤ 20 — успех.
    captured.nextRoll = 10;
    const actor = actorWith({ s: 40, overload: TIER1 });
    await useDisabledArmourForkTest(actor, { skillKey: "s" });
    expect(actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)).toBeUndefined();
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("тир 1, S+0, провал — Max.A брони падает до 10", async () => {
    // eff = 20; бросок 99 > 20 — провал.
    captured.nextRoll = 99;
    const actor = actorWith({ s: 40, overload: TIER1 });
    await useDisabledArmourForkTest(actor, { skillKey: "s" });
    expect(actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)).toBe(true);
    expect(captured.chat[0].content).toContain("Max.A брони падает до 10");
  });

  it("тир 1, Athletics(S)+10 — порог берёт навык +10, а не характеристику S", async () => {
    // eff = 30 (Athletics) + 10 + armourPenalty(-20) + testPenalty(0) = 20; те же 20, что и у S+0 в этом сетапе.
    captured.nextRoll = 15;
    const actor = actorWith({ s: 40, athletics: 30, overload: TIER1 });
    await useDisabledArmourForkTest(actor, { skillKey: "athletics" });
    expect(captured.chat[0].content).toContain("Athletics(S)+10");
    expect(captured.chat[0].content).toContain("Порог: <b>20</b>");
  });

  it("тир 2, успех — засчитан как провал тира 1: тоже роняет Max.A до 10", async () => {
    // eff = 100 (S) + armourPenalty(-20) + testPenalty(-20) = 60; бросок 1 ≤ 60 — успех.
    captured.nextRoll = 1;
    const actor = actorWith({ s: 100, overload: TIER2, armourWeight: 300 }); // вес 300: между Подъёмом 200 и Толканием 400 — тир 2
    await useDisabledArmourForkTest(actor, { skillKey: "s" });
    expect(actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)).toBe(true);
    expect(captured.chat[0].content).toContain("засчитан как Провал тира 1");
  });

  it("тир 2, провал — Беспомощен до начала следующего Хода, флаг Max.A НЕ ставится", async () => {
    captured.nextRoll = 99;
    const actor = actorWith({ s: 40, overload: TIER2, armourWeight: 300 });
    await useDisabledArmourForkTest(actor, { skillKey: "s" });
    expect(actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)).toBeUndefined();
    expect(captured.chat[0].content).toContain("Беспомощен до начала следующего Хода");
  });
});

describe("promptDisabledArmourForkTest", () => {
  it("перевеса нет — диалог не открывается", async () => {
    const actor = actorWith({ overload: null, armourWeight: 0 });
    await promptDisabledArmourForkTest(actor);
    expect(captured.dialog).toBeNull();
  });

  it("тир 3 — диалог не открывается", async () => {
    const actor = actorWith({ overload: TIER3, armourWeight: 500 });
    await promptDisabledArmourForkTest(actor);
    expect(captured.dialog).toBeNull();
  });

  it("тир 1: диалог открывается, выбор S+0 запускает тест", async () => {
    captured.nextRoll = 10;
    const actor = actorWith({ s: 40, overload: TIER1 });
    const p = promptDisabledArmourForkTest(actor);
    expect(captured.dialog).not.toBeNull();
    await captured.press("s");
    await p;
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("S+0");
  });

  it("закрыли диалог без выбора — тест не запускается", async () => {
    const actor = actorWith({ s: 40, overload: TIER1 });
    const p = promptDisabledArmourForkTest(actor);
    captured.dismiss();
    await p;
    expect(captured.chat).toEqual([]);
  });
});
