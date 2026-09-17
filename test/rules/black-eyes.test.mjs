// test/rules/black-eyes.test.mjs
//
// wdbc-1rno.1: isBlackEyesItem/hasBlackEyesDarknessImmunity — без Foundry.

import { describe, it, expect } from "vitest";
import { isBlackEyesItem, hasBlackEyesDarknessImmunity } from "../../module/rules/black-eyes.mjs";

const blackEyesItem = () => ({
  type: "mutation", name: "Black Eyes / Чёрные Глаза",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
    { id: "e1", kind: "capability", capabilityKey: "gift.slaanesh.blackEyes" }
  ] }] } }
});

describe("isBlackEyesItem", () => {
  it("предмет с нужным capabilityKey — true", () => {
    expect(isBlackEyesItem(blackEyesItem())).toBe(true);
  });

  it("предмет с тем же именем, без ключа (опознание по имени) — true", () => {
    expect(isBlackEyesItem({ type: "mutation", name: "Black Eyes / Чёрные Глаза", flags: {} })).toBe(true);
  });

  it("другой тип предмета — false", () => {
    expect(isBlackEyesItem({ type: "trait", name: "Black Eyes / Чёрные Глаза", flags: {} })).toBe(false);
  });

  it("другая мутация — false", () => {
    expect(isBlackEyesItem({ type: "mutation", name: "Cyclops / Циклоп", flags: {} })).toBe(false);
  });
});

describe("hasBlackEyesDarknessImmunity", () => {
  const actorWith = (cor, items) => ({ system: { corruption: { value: cor } }, items });

  it("Cor 60, есть Дар — true", () => {
    expect(hasBlackEyesDarknessImmunity(actorWith(60, [blackEyesItem()]))).toBe(true);
  });

  it("Cor 65, есть Дар — true", () => {
    expect(hasBlackEyesDarknessImmunity(actorWith(65, [blackEyesItem()]))).toBe(true);
  });

  it("Cor 59 (ниже порога), есть Дар — false", () => {
    expect(hasBlackEyesDarknessImmunity(actorWith(59, [blackEyesItem()]))).toBe(false);
  });

  it("Cor 60, нет Дара — false", () => {
    expect(hasBlackEyesDarknessImmunity(actorWith(60, []))).toBe(false);
  });

  it("null/undefined актор — false, не бросает", () => {
    expect(hasBlackEyesDarknessImmunity(null)).toBe(false);
    expect(hasBlackEyesDarknessImmunity(undefined)).toBe(false);
  });
});
