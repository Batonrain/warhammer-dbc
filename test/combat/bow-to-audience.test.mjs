// test/combat/bow-to-audience.test.mjs
//
// Bow to the Audience / Поклон Публике (wdbc-1rno,
// harlequin.solitaire.bowToTheAudience): 3 ОД, Awareness(P)−20 против до
// P.b видимых целей, при успехе метит АТАКУЮЩЕГО (не цели) степенью×3 до
// начала его следующего Хода. module/combat/bow-to-audience.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hasBowToAudience, bowToAudienceGate, triggerBowToAudience, clearBowToAudienceMark
} from "../../module/combat/bow-to-audience.mjs";

function actorWith({ names = [], ap = 3, perBonus = 3, awareness = 60, type = "character" } = {}) {
  const flags = {};
  const a = {
    type,
    items: names.map(name => ({ type: "talent", name })),
    system: {
      actionPoints: { value: ap, max: 2 },
      characteristics: { per: { bonus: perBonus } },
      skills: { awareness: { total: awareness } }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    update: async data => {
      if (data["system.actionPoints.value"] !== undefined) a.system.actionPoints.value = data["system.actionPoints.value"];
    }
  };
  return a;
}

const targetToken = id => ({ actor: { id, name: `Цель-${id}` } });
const setTargets = (...tokens) => { globalThis.game.user.targets = new Set(tokens); };

beforeEach(() => { resetCaptured(); globalThis.game.user.targets = new Set(); globalThis.game.combat = { started: true }; });
afterEach(() => { globalThis.game.user.targets = new Set(); globalThis.game.combat = undefined; });

describe("hasBowToAudience", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasBowToAudience(actorWith({ names: ["Bow to the Audience / Поклон Публике"] }))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasBowToAudience(actorWith({ names: ["Dodge"] }))).toBe(false);
  });
});

describe("triggerBowToAudience", () => {
  it("нет Таланта — null, ничего не тратит", async () => {
    setTargets(targetToken("t1"));
    const actor = actorWith({ names: ["Dodge"] });
    expect(await triggerBowToAudience(actor)).toBeNull();
    expect(actor.system.actionPoints.value).toBe(3);
  });

  it("нет выбранных целей — null, предупреждение, ОД не тратятся", async () => {
    const actor = actorWith({ names: ["Bow to the Audience / Поклон Публике"] });
    expect(await triggerBowToAudience(actor)).toBeNull();
    expect(actor.system.actionPoints.value).toBe(3);
    expect(captured.warnings.some(w => w.includes("целей"))).toBe(true);
  });

  it("не хватает ОД — null, предупреждение, метка не ставится", async () => {
    setTargets(targetToken("t1"));
    const actor = actorWith({ names: ["Bow to the Audience / Поклон Публике"], ap: 2 });
    expect(await triggerBowToAudience(actor)).toBeNull();
    expect(actor.getFlag("warhammer-dbc", "bowToAudienceMark")).toBeUndefined();
  });

  it("успех: тратит 3 ОД, метит цель степенью×3", async () => {
    setTargets(targetToken("t1"));
    const actor = actorWith({ names: ["Bow to the Audience / Поклон Публике"], ap: 3, awareness: 60 });
    captured.nextRoll = 20; // порог 60−20=40; успех, deg = floor((40-20)/10)+1 = 3
    const result = await triggerBowToAudience(actor);
    expect(result.success).toBe(true);
    expect(result.deg).toBe(3);
    expect(result.bonus).toBe(9);
    expect(actor.system.actionPoints.value).toBe(0);
    const mark = actor.getFlag("warhammer-dbc", "bowToAudienceMark");
    expect(mark).toEqual({ targetIds: ["t1"], bonus: 9 });
  });

  it("провал: ОД потрачены, метка не ставится", async () => {
    setTargets(targetToken("t1"));
    const actor = actorWith({ names: ["Bow to the Audience / Поклон Публике"], ap: 3, awareness: 30 });
    captured.nextRoll = 90; // порог 30−20=10; явный провал
    const result = await triggerBowToAudience(actor);
    expect(result.success).toBe(false);
    expect(result.bonus).toBe(0);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(actor.getFlag("warhammer-dbc", "bowToAudienceMark")).toBeUndefined();
  });

  it("целей выбрано больше P.b — метит только первые P.b", async () => {
    setTargets(targetToken("t1"), targetToken("t2"), targetToken("t3"));
    const actor = actorWith({ names: ["Bow to the Audience / Поклон Публике"], perBonus: 2, ap: 3, awareness: 60 });
    captured.nextRoll = 20;
    await triggerBowToAudience(actor);
    const mark = actor.getFlag("warhammer-dbc", "bowToAudienceMark");
    expect(mark.targetIds).toHaveLength(2);
  });

  it("P.b = 0 — нет доступных целей, null", async () => {
    setTargets(targetToken("t1"));
    const actor = actorWith({ names: ["Bow to the Audience / Поклон Публике"], perBonus: 0 });
    expect(await triggerBowToAudience(actor)).toBeNull();
  });
});

describe("bowToAudienceGate", () => {
  it("P.b = 0 — disabled", () => {
    expect(bowToAudienceGate(actorWith({ perBonus: 0 })).disabled).toBe(true);
  });
  it("нет целей — disabled", () => {
    const actor = actorWith({});
    expect(bowToAudienceGate(actor).disabled).toBe(true);
  });
  it("не хватает ОД — disabled", () => {
    setTargets(targetToken("t1"));
    expect(bowToAudienceGate(actorWith({ ap: 1 })).disabled).toBe(true);
  });
  it("всё в порядке — disabled:false", () => {
    setTargets(targetToken("t1"));
    expect(bowToAudienceGate(actorWith({ ap: 3, perBonus: 2 })).disabled).toBe(false);
  });
});

describe("clearBowToAudienceMark", () => {
  it("снимает метку, если она есть", async () => {
    const actor = actorWith({});
    await actor.setFlag("warhammer-dbc", "bowToAudienceMark", { targetIds: ["t1"], bonus: 6 });
    await clearBowToAudienceMark(actor);
    expect(actor.getFlag("warhammer-dbc", "bowToAudienceMark")).toBeUndefined();
  });
  it("нет метки — не падает", async () => {
    await expect(clearBowToAudienceMark(actorWith({}))).resolves.toBeUndefined();
  });
  it("нет актора — не падает", async () => {
    await expect(clearBowToAudienceMark(null)).resolves.toBeUndefined();
  });
});
