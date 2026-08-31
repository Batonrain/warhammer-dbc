// test/combat/ship-node-damage.test.mjs
//
// Реакция на повреждение узла корабля (explosive/fragileEngine/robustDesign,
// wdbc-qhwb) — чистая функция resolveNodeDamage, без Foundry. rollFn
// инжектируется детерминированно вместо настоящего Roll.

import { describe, it, expect } from "vitest";
import { resolveNodeDamage } from "../../module/combat/ship-node-damage.mjs";

const fixedRoll = (n) => async () => n;

describe("resolveNodeDamage", () => {
  it("нет свойств, нет перехода — ничего не происходит", async () => {
    expect(await resolveNodeDamage([], "supplemental", "intact", "intact", fixedRoll(1))).toEqual({});
  });

  it("переход intact→damaged без свойств — ничего не происходит", async () => {
    expect(await resolveNodeDamage([], "weapon", "intact", "damaged", fixedRoll(1))).toEqual({});
  });

  it("fragileEngine: повреждение двигателя сразу считается разрушением", async () => {
    const props = [{ key: "fragileEngine" }];
    const r = await resolveNodeDamage(props, "drive", "intact", "damaged", fixedRoll(1));
    expect(r.forceStatus).toBe("destroyed");
  });

  it("fragileEngine на НЕ-двигателе (kind≠drive/warp) не срабатывает", async () => {
    const props = [{ key: "fragileEngine" }];
    const r = await resolveNodeDamage(props, "weapon", "intact", "damaged", fixedRoll(1));
    expect(r).toEqual({});
  });

  it("fragileEngine не трогает переход в destroyed напрямую (уже разрушен)", async () => {
    const props = [{ key: "fragileEngine" }];
    const r = await resolveNodeDamage(props, "warp", "intact", "destroyed", fixedRoll(1));
    expect(r.forceStatus).toBeUndefined();
  });

  it("explosive: 1d10 = 10 — детонация, узел уничтожен, 2d5 урона", async () => {
    const props = [{ key: "explosive" }];
    const r = await resolveNodeDamage(props, "supplemental", "intact", "damaged", fixedRoll(10));
    expect(r.forceStatus).toBe("destroyed");
    expect(r.explosionDamage).toBe("2d5");
  });

  it("explosive: 1d10 < 10 — обходится без детонации", async () => {
    const props = [{ key: "explosive" }];
    const r = await resolveNodeDamage(props, "supplemental", "intact", "damaged", fixedRoll(9));
    expect(r).toEqual({});
  });

  it("explosive не срабатывает на переходе unpowered→intact (не вход в повреждение)", async () => {
    const props = [{ key: "explosive" }];
    const r = await resolveNodeDamage(props, "supplemental", "unpowered", "intact", fixedRoll(10));
    expect(r).toEqual({});
  });

  it("robustDesign(X): спасбросок ≥ X — узел спасён, статус откатывается", async () => {
    const props = [{ key: "robustDesign", rating: 5 }];
    const r = await resolveNodeDamage(props, "supplemental", "intact", "damaged", fixedRoll(7));
    expect(r.revertStatus).toBe("intact");
  });

  it("robustDesign(X): спасбросок < X — эффект проходит (нет revert)", async () => {
    const props = [{ key: "robustDesign", rating: 5 }];
    const r = await resolveNodeDamage(props, "supplemental", "intact", "damaged", fixedRoll(3));
    expect(r.revertStatus).toBeUndefined();
  });

  it("robustDesign спасает и от explosive — если спас, детонация не проверяется", async () => {
    const props = [{ key: "robustDesign", rating: 5 }, { key: "explosive" }];
    const r = await resolveNodeDamage(props, "supplemental", "intact", "destroyed", fixedRoll(9));
    expect(r.revertStatus).toBe("intact");
    expect(r.explosionDamage).toBeUndefined();
  });

  it("robustDesign не спас — explosive всё равно проверяется отдельным броском", async () => {
    let calls = 0;
    const rolls = [3, 10]; // 1-й бросок (robustDesign) провален, 2-й (explosive) = детонация
    const rollFn = async () => rolls[calls++];
    const props = [{ key: "robustDesign", rating: 5 }, { key: "explosive" }];
    const r = await resolveNodeDamage(props, "supplemental", "intact", "damaged", rollFn);
    expect(r.revertStatus).toBeUndefined();
    expect(r.forceStatus).toBe("destroyed");
    expect(r.explosionDamage).toBe("2d5");
  });
});
