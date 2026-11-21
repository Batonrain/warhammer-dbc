// Моритат: Ленточное Питание, Молниеносные Пальцы, Пролётом (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  beltFeedEligible, beltFeedTransfer, lightningFingersIgnoresRig, flyByRoundKey, flyByBlockReason, flyByAfterShot
} from "../../module/rules/moritat-talents.mjs";

const gun = (cls, cur, max) => ({ type: "weapon", id: "g1", system: { weaponClass: cls, magazineCur: cur, magazineMax: max } });
const talent = name => ({ type: "talent", name });

describe("Ленточное Питание", () => {
  it("только стрелковое с магазином", () => {
    expect(beltFeedEligible(gun("basic", 0, 30))).toBe(true);
    expect(beltFeedEligible(gun("melee", 0, 0))).toBe(false);
    expect(beltFeedEligible(gun("pistol", 0, 0))).toBe(false);
  });
  it("подаёт недостающее, не больше ранца", () => {
    expect(beltFeedTransfer(gun("basic", 10, 30), 200)).toBe(20);
    expect(beltFeedTransfer(gun("basic", 10, 30), 5)).toBe(5);
    expect(beltFeedTransfer(gun("basic", 30, 30), 200)).toBe(0);
  });
});

describe("Молниеносные Пальцы", () => {
  it("пистолет — да; винтовка — только с Огневой Мощью", () => {
    const a = { items: [talent("Lightning Fingers / Молниеносные Пальцы")] };
    expect(lightningFingersIgnoresRig(a, gun("pistol", 0, 6))).toBe(true);
    expect(lightningFingersIgnoresRig(a, gun("basic", 0, 6))).toBe(false);
    const b = { items: [...a.items, talent("Outgun / Огневая Мощь")] };
    expect(lightningFingersIgnoresRig(b, gun("basic", 0, 6))).toBe(true);
    expect(lightningFingersIgnoresRig({ items: [] }, gun("pistol", 0, 6))).toBe(false);
  });
});

describe("Пролётом", () => {
  const combat = { started: true, id: "c1", round: 3 };
  it("по выстрелу из каждого оружия в Раунде объявления", () => {
    const key = flyByRoundKey(combat);
    let flag = `${key}|`;
    expect(flyByBlockReason(flag, "g1", key)).toBe("");
    flag = flyByAfterShot(flag, "g1");
    expect(flyByBlockReason(flag, "g1", key)).toMatch(/уже/);
    expect(flyByBlockReason(flag, "g2", key)).toBe("");
    expect(flyByBlockReason(flag, "g2", flyByRoundKey({ ...combat, round: 4 }))).toMatch(/не объявлен/);
    expect(flyByBlockReason("", "g1", key)).toMatch(/не объявлен/);
  });
});
