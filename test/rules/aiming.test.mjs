// test/rules/aiming.test.mjs
//
// wdbc-1rno.5: aimApCost/blackEyesFreeHalfAim — без Foundry.

import { describe, it, expect } from "vitest";
import { aimApCost, blackEyesFreeHalfAim, AIM_BASE_COST } from "../../module/rules/aiming.mjs";

const blackEyesItem = () => ({
  type: "mutation", name: "Black Eyes / Чёрные Глаза",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
    { id: "e1", kind: "capability", capabilityKey: "gift.slaanesh.blackEyes" }
  ] }] } }
});
const coldEyesItem = () => ({ type: "gear", name: "Cold Eyes / Холодные Глаза", flags: {} });
const blessingItem = (isSustained = true) => ({
  type: "psychicPower", name: "Blessing of Magnus / Благословение Магнуса", system: { isSustained }, flags: {}
});
const forceWeapon = () => ({ type: "weapon", name: "Психосиловой Клинок", system: { equipped: true, weaponProps: [{ key: "force" }] } });
const actorWith = (cor, items = [], woundTier = "healthy") => ({
  system: { corruption: { value: cor }, wounds: { tier: woundTier } }, items
});

describe("blackEyesFreeHalfAim", () => {
  it("Cor 80, есть Дар, видит цель — true", () => {
    expect(blackEyesFreeHalfAim(actorWith(80, [blackEyesItem()]), { seesTarget: true })).toBe(true);
  });

  it("Cor 79 (ниже порога) — false", () => {
    expect(blackEyesFreeHalfAim(actorWith(79, [blackEyesItem()]), { seesTarget: true })).toBe(false);
  });

  it("Cor 80, есть Дар, НЕ видит цель — false", () => {
    expect(blackEyesFreeHalfAim(actorWith(80, [blackEyesItem()]), { seesTarget: false })).toBe(false);
  });

  it("Cor 80, нет Дара — false", () => {
    expect(blackEyesFreeHalfAim(actorWith(80, []), { seesTarget: true })).toBe(false);
  });
});

describe("aimApCost", () => {
  it("Полу-прицеливание — 1 ОД по умолчанию", () => {
    expect(aimApCost(actorWith(0), "half")).toBe(AIM_BASE_COST.half);
    expect(aimApCost(actorWith(0), "half")).toBe(1);
  });

  it("Полное Прицеливание — 2 ОД по умолчанию, Чёрные Глаза его не трогают", () => {
    expect(aimApCost(actorWith(80, [blackEyesItem()]), "full", { seesTarget: true })).toBe(2);
  });

  it("Полу-прицеливание бесплатно при Cor 80+ Чёрных Глазах и видимой цели", () => {
    expect(aimApCost(actorWith(80, [blackEyesItem()]), "half", { seesTarget: true })).toBe(0);
  });

  it("Полу-прицеливание НЕ бесплатно без видимой цели, даже при Cor 80+", () => {
    expect(aimApCost(actorWith(80, [blackEyesItem()]), "half", { seesTarget: false })).toBe(1);
  });

  it("Cold Eyes/Холодные Глаза: Полу-прицеливание свободное действие (0 ОД), без видимой цели", () => {
    expect(aimApCost(actorWith(0, [coldEyesItem()]), "half", { seesTarget: false })).toBe(0);
  });

  it("Cold Eyes: Полное Прицеливание — полудействие (1 ОД вместо 2)", () => {
    expect(aimApCost(actorWith(0, [coldEyesItem()]), "full", { seesTarget: false })).toBe(1);
  });

  it("Blessing of Magnus активна + психосиловое оружие + тяжело ранен — Полу-прицеливание бесплатно", () => {
    expect(aimApCost(actorWith(0, [blessingItem(), forceWeapon()], "heavy"), "half")).toBe(0);
  });

  it("Blessing of Magnus не задевает Полное Прицеливание", () => {
    expect(aimApCost(actorWith(0, [blessingItem(), forceWeapon()], "heavy"), "full")).toBe(2);
  });

  it("Blessing of Magnus: не тяжело ранен — обычная цена", () => {
    expect(aimApCost(actorWith(0, [blessingItem(), forceWeapon()], "light"), "half")).toBe(1);
  });
});
