// test/rules/black-eyes.test.mjs
//
// wdbc-1rno.1: hasBlackEyesDarknessImmunity — без Foundry.
// Опознание самого Дара по ключу — tools/item-markers-table.mjs
// (test/rules/item-markers-in-packs.test.mjs).

import { describe, it, expect } from "vitest";
import { hasBlackEyesDarknessImmunity } from "../../module/rules/black-eyes.mjs";

const blackEyesItem = () => ({
  type: "mutation", name: "Black Eyes / Чёрные Глаза",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
    { id: "e1", kind: "capability", capabilityKey: "gift.slaanesh.blackEyes" }
  ] }] } }
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
