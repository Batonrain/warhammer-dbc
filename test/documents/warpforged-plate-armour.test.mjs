// test/documents/warpforged-plate-armour.test.mjs
//
// wdbc-dg6: Warpforged Plate/Закалённые Варпом Латы (Элитный архетип
// Варп-Кузнец) несла запечённый ActiveEffect system.armorBonus.<loc> "add"
// +12 на все шесть локаций — СКЛАДЫВАЕМУЮ надбавку, тем же путём, что и
// Естественная Броня Черт. Но по тексту предмета: «Не может снять доспех, но
// имеет AP 12/12/12/12» — это ЕГО броня (замена), а не бонус поверх надетой.
// Надеть любой доспех поверх давало AP 12+N.
//
// Верное поведение — «лучшее из» (best() в rules/character.mjs), тем же
// приёмом, что и у Чёрного Панциря (см. test/documents/black-carapace-armour.test.mjs,
// откуда wdbc-dg6 обобщил механизм в общий armorFloorLoc на все локации).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function itemFor({ type, name, system = {}, flags = {} } = {}) {
  return { id: `${type}-${name}`, name, type, system, getFlag: (_s, k) => flags[k] };
}

function warpforgedPlate() {
  return itemFor({ type: "trait", name: "Warpforged Plate / Закалённые Варпом Латы" });
}

function fullArmor(ap) {
  return itemFor({
    type: "armor",
    name: "Силовая броня",
    system: {
      equipped: true,
      head: ap, body: ap, leftArm: ap, rightArm: ap, leftLeg: ap, rightLeg: ap
    }
  });
}

/** Персонаж: Стойкость 30 (T.b 3), без брони по умолчанию. */
function characterWith({ items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.t.base = 30;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

const LOCS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

describe("Warpforged Plate: AP 12/12/12/12 не должен складываться с надетой бронёй", () => {
  it("без другой брони: все шесть локаций дают ровно АР 12", () => {
    const system = characterWith({ items: [warpforgedPlate()] });
    for (const k of LOCS) expect(system.absorption.armorOnly[k]).toBe(12);
  });

  it("поверх силовой брони АР8: остаётся 12 везде, НЕ 20 — не стакается", () => {
    const system = characterWith({ items: [warpforgedPlate(), fullArmor(8)] });
    for (const k of LOCS) expect(system.absorption.armorOnly[k]).toBe(12);
  });

  it("поверх тяжёлой брони АР14: побеждает броня (лучшее из двух, не сумма)", () => {
    const system = characterWith({ items: [warpforgedPlate(), fullArmor(14)] });
    for (const k of LOCS) expect(system.absorption.armorOnly[k]).toBe(14);
  });

  it("без предмета: обычная броня считается как раньше (регрессия)", () => {
    const system = characterWith({ items: [fullArmor(8)] });
    for (const k of LOCS) expect(system.absorption.armorOnly[k]).toBe(8);
  });
});
