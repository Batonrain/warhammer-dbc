// test/combat/radiation-daemonic.test.mjs
//
// Задача Sahara «daemonic» (решение владельца 02.10.2026): Черта Daemonic (X)
// даёт иммунитет к радиации. Книга (core.json, Трейт Daemonic (X)): «Он
// иммунен к ядам, болезням, и радиации». Иммунитет выражен данными — записью
// Конструктора kind:"condition" condMode:"immunity" condKey:"radiation" на
// самой Черте; combat/radiation.mjs::radSkipReason читает его без правок кода.
//
// Предмет берётся из packs-src по id, а не литералом: зелёный тест на выдуманной
// фикстуре не доказывает, что запись реально лежит в паке.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";

import { packDocById } from "../support/pack-doc.mjs";
import { applyRadHit } from "../../module/combat/radiation.mjs";
import { isImmuneToCondition } from "../../module/rules/condition-guards.mjs";

const DAEMONIC_ID = "brwXUX5nKFR5tOjG";

/** Предмет пака в виде, в каком его видит код на акторе (getFlag как у Item). */
function asItem(doc) {
  return { ...doc, getFlag(scope, key) { return this.flags?.[scope]?.[key]; } };
}

function makeActor(items = []) {
  const flags = {};
  const actor = {
    uuid: "Actor.d1", name: "Одержимый", type: "character", isOwner: true, items,
    system: { characteristics: { t: { total: 40 } }, charLoss: { t: 0 }, charLossAt: {}, conditions: {} },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => {
      captured.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        if (path === "system.charLoss.t") actor.system.charLoss.t = value;
      }
    }
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 1000 };
  globalThis.game.combats = [];
});

describe("Черта Daemonic (X) из пака — иммунитет к радиации", () => {
  const daemonic = () => asItem(packDocById("packs-src/traits", DAEMONIC_ID));

  it("в данных Черты есть запись иммунитета к Состоянию «Радиация»", () => {
    const actor = makeActor([daemonic()]);
    expect(isImmuneToCondition(actor, "radiation")).toBe(true);
  });

  it("попадание Rad по носителю Черты: ни броска, ни урона в T, в чате — иммунитет", async () => {
    const actor = makeActor([daemonic()]);
    captured.dice = [4];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    expect(captured.rolls.length).toBe(0);
    expect(actor.system.charLoss.t).toBe(0);
    expect(captured.chat.some(c => String(c.content).includes("Иммунитет к радиации"))).toBe(true);
  });

  it("контроль: тот же актор без Черты получает урон в T", async () => {
    const actor = makeActor([]);
    captured.dice = [4];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    expect(actor.system.charLoss.t).toBe(4);
  });

  it("запись иммунитета не трогает перенесённый бонус +X к T.b (эффект Черты на месте)", () => {
    const doc = packDocById("packs-src/traits", DAEMONIC_ID);
    const changes = doc.effects.flatMap(e => e.system?.changes ?? []);
    expect(changes.some(c => c.key === "system.characteristics.t.bonusFx")).toBe(true);
  });
});
