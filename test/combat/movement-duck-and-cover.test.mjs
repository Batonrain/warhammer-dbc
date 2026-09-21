// test/combat/movement-duck-and-cover.test.mjs
//
// Стр. 30, wdbc-x1nz.2.38: Перебежка — Полное действие, начинать/заканчивать
// в укрытии (само укрытие/LOS система не считает — игрок подтверждает
// диалогом), даёт переброс Избегания/Подавления до конца Раунда
// (flags.warhammer-dbc.duckAndCoverActive, читают defense.mjs/suppression.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { declareDuckAndCover } from "../../module/combat/movement-actions.mjs";
import { duckAndCoverAdvantage } from "../../module/rules/duck-and-cover.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 }, grappling = false } = {}) {
  const store = {};
  const doc = {
    name: "Подставной", type: "character",
    system: { actionPoints, conditions: { grappling }, movement: { move: 8 } }
  };
  doc.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return doc;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; captured.confirmAnswer = undefined; });

describe("declareDuckAndCover", () => {
  it("подтверждено, хватает ОД — списывает 2 ОД, ставит duckAndCoverActive", async () => {
    globalThis.game.combat = { started: true };
    captured.confirmAnswer = true;
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await declareDuckAndCover(actor);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(duckAndCoverAdvantage(actor)).toBe(true);
    expect(captured.chat).toHaveLength(1);
  });

  it("отменено в диалоге подтверждения — ничего не происходит", async () => {
    globalThis.game.combat = { started: true };
    captured.confirmAnswer = false;
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await declareDuckAndCover(actor);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(duckAndCoverAdvantage(actor)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("подтверждено, но не хватает ОД — блокируется, флаг не ставится", async () => {
    globalThis.game.combat = { started: true };
    captured.confirmAnswer = true;
    const actor = actorFor({ actionPoints: { value: 1, max: 2 } });
    await declareDuckAndCover(actor);
    expect(duckAndCoverAdvantage(actor)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("в Захвате — блокируется до диалога подтверждения", async () => {
    globalThis.game.combat = { started: true };
    captured.confirmAnswer = true;
    const actor = actorFor({ grappling: true });
    await declareDuckAndCover(actor);
    expect(captured.dialog).toBeNull();
    expect(duckAndCoverAdvantage(actor)).toBe(false);
  });
});

describe("duckAndCoverAdvantage", () => {
  it("нет флага — false", () => {
    expect(duckAndCoverAdvantage(actorFor())).toBe(false);
  });
});
