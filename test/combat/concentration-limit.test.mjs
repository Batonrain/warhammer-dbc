// test/combat/concentration-limit.test.mjs
//
// Стр. 12, wdbc-x1nz.2.33: «Персонаж может совершать только одну
// Концентрацию в свой Ход». Пока ни одна способность пака не помечена этим
// типом действия — здесь проверяется только сам счётчик/лимит, готовый к
// подключению будущими способностями (см. заголовок combat/concentration-
// limit.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { concentrationActionLimit, canTakeConcentrationAction, takeConcentrationAction }
  from "../../module/combat/concentration-limit.mjs";

function actorFor({ type = "character" } = {}) {
  const store = {};
  const doc = { type, system: {} };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return doc;
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("concentrationActionLimit", () => {
  it("всегда 1 — книга не даёт способа его поднять", () => {
    expect(concentrationActionLimit()).toBe(1);
  });
});

describe("canTakeConcentrationAction / takeConcentrationAction", () => {
  it("вне Encounter лимит не считается — всегда можно", async () => {
    const actor = actorFor();
    await takeConcentrationAction(actor);
    await takeConcentrationAction(actor);
    expect(canTakeConcentrationAction(actor)).toBe(true);
  });

  it("в бою — первая Концентрация разрешена, вторая — нет", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor();
    expect(canTakeConcentrationAction(actor)).toBe(true);
    await takeConcentrationAction(actor);
    expect(canTakeConcentrationAction(actor)).toBe(false);
  });

  it("Орда/техника (нет экономики действий) — лимит не считается", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ type: "vehicle" });
    await takeConcentrationAction(actor);
    expect(canTakeConcentrationAction(actor)).toBe(true);
  });
});
