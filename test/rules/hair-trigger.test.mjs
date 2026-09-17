// test/rules/hair-trigger.test.mjs
//
// wdbc-1rno.27/.37: пометка «следующий выстрел из Караула — Незримый»
// (тот же примитив, что hidden-threat.mjs) + гейт допустимого оружия.

import { describe, it, expect } from "vitest";
import {
  isHairTriggerUnseenPending, markHairTriggerUnseenPending, consumeHairTriggerUnseenPending,
  hairTriggerAllowedWeapon
} from "../../module/rules/hair-trigger.mjs";

function fakeActor() {
  const flags = {};
  return {
    getFlag: (ns, key) => flags[key],
    setFlag: async (ns, key, value) => { flags[key] = value; },
    unsetFlag: async (ns, key) => { delete flags[key]; }
  };
}

describe("isHairTriggerUnseenPending", () => {
  it("без пометки — false", () => {
    expect(isHairTriggerUnseenPending(fakeActor())).toBe(false);
  });
  it("null актор — false, не бросает", () => {
    expect(isHairTriggerUnseenPending(null)).toBe(false);
  });
});

describe("markHairTriggerUnseenPending / consumeHairTriggerUnseenPending", () => {
  it("после метки — pending true, consume снимает и возвращает true", async () => {
    const actor = fakeActor();
    await markHairTriggerUnseenPending(actor);
    expect(isHairTriggerUnseenPending(actor)).toBe(true);
    expect(await consumeHairTriggerUnseenPending(actor)).toBe(true);
    expect(isHairTriggerUnseenPending(actor)).toBe(false);
  });

  it("consume без пометки — false, ничего не трогает", async () => {
    const actor = fakeActor();
    expect(await consumeHairTriggerUnseenPending(actor)).toBe(false);
  });

  it("consume дважды подряд — второй раз false (одноразовая пометка)", async () => {
    const actor = fakeActor();
    await markHairTriggerUnseenPending(actor);
    expect(await consumeHairTriggerUnseenPending(actor)).toBe(true);
    expect(await consumeHairTriggerUnseenPending(actor)).toBe(false);
  });
});

describe("hairTriggerAllowedWeapon", () => {
  it("обычное дальнобойное — разрешено", () => {
    expect(hairTriggerAllowedWeapon({ weaponClass: "ranged" }, {})).toBe(true);
  });
  it("метательное — запрещено", () => {
    expect(hairTriggerAllowedWeapon({ weaponClass: "thrown" }, {})).toBe(false);
  });
  it("Распыление (wp.spray) — запрещено", () => {
    expect(hairTriggerAllowedWeapon({ weaponClass: "ranged" }, { spray: true })).toBe(false);
  });
  it("нет weaponSys — запрещено, не бросает", () => {
    expect(hairTriggerAllowedWeapon(null, {})).toBe(false);
  });
});
