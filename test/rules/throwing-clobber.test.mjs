// test/rules/throwing-clobber.test.mjs
// 3-8318, Clobber / Поколотить: «попав метательным оружием (в т.ч. импровизированным), весящим как минимум ¼ от
// цели, цель проходит S+0, или её сбивает с ног. Снаряд ≥½ цели — штраф −10 на тест, больше цели — −20».
import { describe, it, expect } from "vitest";
import { clobberPlan, hasClobber, CLOBBER_CAPABILITY } from "../../module/rules/throwing-talents.mjs";

describe("clobberPlan — вес снаряда относительно цели", () => {
  it("легче ¼ цели — Талант не действует", () => {
    expect(clobberPlan(17, 70)).toMatchObject({ status: "tooLight" });
  });
  it("ровно ¼ цели — действует, штрафа нет", () => {
    expect(clobberPlan(17.5, 70)).toMatchObject({ status: "ok", mod: 0 });
  });
  it("от ¼ до ½ — штрафа нет", () => {
    expect(clobberPlan(30, 70)).toMatchObject({ status: "ok", mod: 0 });
  });
  it("ровно ½ цели — −10", () => {
    expect(clobberPlan(35, 70)).toMatchObject({ status: "ok", mod: -10 });
  });
  it("от ½ до целого веса цели включительно — −10", () => {
    expect(clobberPlan(70, 70)).toMatchObject({ status: "ok", mod: -10 });
  });
  it("тяжелее цели — −20", () => {
    expect(clobberPlan(70.5, 70)).toMatchObject({ status: "ok", mod: -20 });
  });
  it("вес снаряда или цели не заполнен — нельзя сравнить", () => {
    expect(clobberPlan(0, 70)).toMatchObject({ status: "noProjectileWeight" });
    expect(clobberPlan(20, 0)).toMatchObject({ status: "noTargetWeight" });
    expect(clobberPlan(undefined, undefined)).toMatchObject({ status: "noProjectileWeight" });
  });
});

describe("hasClobber", () => {
  it("опознаёт Талант по имени и по ключу Возможности", () => {
    expect(hasClobber({ items: [{ type: "talent", name: "Clobber / Поколотить", system: {} }] })).toBe(true);
    expect(hasClobber({ items: [] })).toBe(false);
    expect(CLOBBER_CAPABILITY).toBe("throwing.core.clobber");
  });
});
