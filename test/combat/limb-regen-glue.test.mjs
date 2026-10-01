// test/combat/limb-regen-glue.test.mjs
//
// wdbc-yffxj: обвязка — preUpdateActor дописывает таймер носителю регенерации
// (и только ему), часы Состояний возвращают отросшую часть тела.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { regenOnPreUpdate, limbRegenClock } from "../../module/combat/limb-regen.mjs";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";
import { NEW_MEN } from "../../module/rules/new-men.mjs";
import { SECONDS_PER_DAY } from "../../module/constants/imperial-calendar.mjs";

const NOW = 5_000_000;
const yigori = { name: "Йигори", items: [], system: { lostLimbs: {} }, updates: [], update: async function (d) { this.updates.push(d); } };
const human = { name: "Человек", items: [], system: { lostLimbs: {} } };

// Заглушка Foundry держит setProperty/getProperty пустыми — здесь нужны настоящие.
const realSet = (o, path, v) => {
  const k = path.split(".");
  let c = o;
  for (const x of k.slice(0, -1)) c = (c[x] ??= {});
  c[k.at(-1)] = v;
  return true;
};
const realGet = (o, path) => path.split(".").reduce((c, x) => c?.[x], o);
const saved = { set: foundry.utils.setProperty, get: foundry.utils.getProperty };

beforeEach(() => {
  foundry.utils.setProperty = realSet;
  foundry.utils.getProperty = realGet;
  resetCaptured();
  globalThis.game.time = { worldTime: NOW };
  clearRuleSources();
  registerRuleSource("test", a => a === yigori
    ? [{ id: "test.regen", when: {}, effects: [{ kind: "grantFlag", target: NEW_MEN.regeneration }] }] : []);
});
afterEach(() => {
  clearRuleSources();
  foundry.utils.setProperty = saved.set;
  foundry.utils.getProperty = saved.get;
});

describe("preUpdateActor: таймер отрастания", () => {
  it("носитель теряет глаз — в тот же update дописан regenAt", () => {
    const changes = { system: { lostLimbs: { leftEye: { lost: true } } } };
    regenOnPreUpdate(yigori, changes);
    expect(changes.system.lostLimbs.leftEye.regenAt).toBe(NOW + 7 * SECONDS_PER_DAY);
  });
  it("плоские ключи (actor.update с точками) тоже понимаются", () => {
    const changes = { "system.lostLimbs.rightLeg.lost": true };
    regenOnPreUpdate(yigori, changes);
    expect(foundry.utils.getProperty(changes, "system.lostLimbs.rightLeg.regenAt")).toBe(NOW + 60 * SECONDS_PER_DAY);
  });
  it("не носитель — без таймера", () => {
    const changes = { system: { lostLimbs: { leftEye: { lost: true } } } };
    regenOnPreUpdate(human, changes);
    expect(changes.system.lostLimbs.leftEye.regenAt).toBeUndefined();
  });
});

describe("часы Состояний: отросла", () => {
  it("срок вышел — часть тела возвращена, таймер снят, карточка в чате", async () => {
    yigori.system = { lostLimbs: { leftEye: { lost: true, regenAt: NOW } } };
    yigori.updates.length = 0;
    await limbRegenClock(yigori, { to: NOW });
    expect(yigori.updates).toHaveLength(1);
    expect(yigori.updates[0]["system.lostLimbs.leftEye.lost"]).toBe(false);
    expect(yigori.updates[0]["system.lostLimbs.leftEye.regenAt"]).toBe(0);
    expect(captured.chat.at(-1).content).toContain("отросла");
  });
  it("рано — ничего не меняется", async () => {
    yigori.system = { lostLimbs: { leftEye: { lost: true, regenAt: NOW + 10 } } };
    yigori.updates.length = 0;
    await limbRegenClock(yigori, { to: NOW });
    expect(yigori.updates).toHaveLength(0);
  });
});
