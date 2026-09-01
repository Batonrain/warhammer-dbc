// test/combat/deadly-effectiveness.test.mjs
//
// Deadly Effectiveness / Смертоносная Эффективность (wdbc-1rno,
// actionPoint.bonusOnFeintKill.extraMeleeAttack): «раз в Раунд» кнопка,
// +2 ОД, триггер подтверждает игрок. module/combat/deadly-effectiveness.mjs.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hasDeadlyEffectiveness, deadlyEffectivenessGate, triggerDeadlyEffectiveness
} from "../../module/combat/deadly-effectiveness.mjs";

const setActiveCombat = combat => { globalThis.game.combat = combat ? { started: true, ...combat } : undefined; };

function actorWith({ names = [], ap = 0, type = "character" } = {}) {
  const flags = {};
  const a = {
    type,
    items: names.map(name => ({ type: "talent", name })),
    system: { actionPoints: { value: ap, max: 2 } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    update: async data => {
      if (data["system.actionPoints.value"] !== undefined) a.system.actionPoints.value = data["system.actionPoints.value"];
    }
  };
  return a;
}

beforeEach(() => { resetCaptured(); setActiveCombat(null); });
afterEach(() => { globalThis.game.combat = undefined; });

describe("hasDeadlyEffectiveness", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasDeadlyEffectiveness(actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"] }))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasDeadlyEffectiveness(actorWith({ names: ["Dodge"] }))).toBe(false);
  });
});

describe("triggerDeadlyEffectiveness", () => {
  it("в бою, есть Талант, ещё не использовано — +2 ОД, помечает раунд использованным", async () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"], ap: 0 });
    const ok = await triggerDeadlyEffectiveness(actor);
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("повторный клик в том же Раунде — false, ОД не добавляется снова", async () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"], ap: 0 });
    await triggerDeadlyEffectiveness(actor);
    const ok = await triggerDeadlyEffectiveness(actor);
    expect(ok).toBe(false);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("новый Раунд — снова доступно", async () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"], ap: 0 });
    await triggerDeadlyEffectiveness(actor);
    setActiveCombat({ round: 3, id: "c1" });
    const ok = await triggerDeadlyEffectiveness(actor);
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(4);
  });

  it("нет Таланта — false", async () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Dodge"], ap: 0 });
    expect(await triggerDeadlyEffectiveness(actor)).toBe(false);
  });

  it("вне активного боя — false", async () => {
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"], ap: 0 });
    expect(await triggerDeadlyEffectiveness(actor)).toBe(false);
    expect(actor.system.actionPoints.value).toBe(0);
  });

  it("тип актора без экономики действий — false", async () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"], ap: 0, type: "npc" });
    expect(await triggerDeadlyEffectiveness(actor)).toBe(false);
  });
});

describe("deadlyEffectivenessGate", () => {
  it("доступно — disabled:false", () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"] });
    expect(deadlyEffectivenessGate(actor).disabled).toBe(false);
  });

  it("уже использовано в этом Раунде — disabled:true", async () => {
    setActiveCombat({ round: 2, id: "c1" });
    const actor = actorWith({ names: ["Deadly Effectiveness / Смертоносная Эффективность"] });
    await triggerDeadlyEffectiveness(actor);
    expect(deadlyEffectivenessGate(actor).disabled).toBe(true);
  });
});
