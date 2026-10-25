// test/combat/movement-false-advance.test.mjs
//
// Ложный Натиск / False Advance (Рукопашные, Sahara 3-8dc5): закончив Полудвижение
// или Полное движение в контакте с врагом, персонаж проводит один Финт или Давление
// за свободное действие. Здесь — кнопки на карточке Движения; обработчик клика
// (hooks.mjs, раз на карточку) в юнит-тесте не поднимается.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { declareHalfMove, declareFullMove, declareCharge } from "../../module/combat/movement-actions.mjs";

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

function fakeActor(items = []) {
  const flagStore = {};
  const actor = {
    name: "Подставной", uuid: "Actor.fa", items,
    system: { movement: { halfMove: 4, move: 8, charge: 12, run: 24 } },
    getFlag: (scope, key) => flagStore[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flagStore[`${scope}.${key}`] = value; },
    update: async () => {}
  };
  return actor;
}

const card = () => captured.chat.at(-1)?.content ?? "";
const KEY = "meleeCore.core.falseAdvance";

beforeEach(resetCaptured);

describe("Ложный Натиск: кнопки Финта и Давления на карточке Движения", () => {
  it("Полудвижение с Талантом (ключ): обе кнопки, uuid носителя", async () => {
    await declareHalfMove(fakeActor([talentByKey(KEY)]));
    expect(card()).toContain('class="wh-false-advance-btn"');
    expect(card()).toContain('data-kind="feint"');
    expect(card()).toContain('data-kind="press"');
    expect(card()).toContain('data-actor-uuid="Actor.fa"');
  });

  it("Полное движение с Талантом (по имени, снимок без записи Конструктора)", async () => {
    await declareFullMove(fakeActor([talentByName("False Advance / Ложный Натиск")]));
    expect(card()).toContain("wh-false-advance-btn");
  });

  it("без Таланта кнопок нет", async () => {
    await declareHalfMove(fakeActor());
    expect(card()).not.toContain("wh-false-advance-btn");
    await declareFullMove(fakeActor());
    expect(card()).not.toContain("wh-false-advance-btn");
  });

  it("Натиск (не Полудвижение и не Полное) Талант не затрагивает", async () => {
    await declareCharge(fakeActor([talentByKey(KEY)]));
    expect(card()).not.toContain("wh-false-advance-btn");
  });
});
