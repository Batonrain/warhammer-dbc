// test/combat/disabled-armour-overload.test.mjs
//
// «Выключенная Силовая Броня перестаёт подавлять свой вес» (стр. 233) —
// каскад по тому, насколько СОБСТВЕННЫЙ вес брони превышает Ношение/Подъём/
// Толкание актора. Чистая классификация тира, без бросков и без записи —
// применение (SPD, движение, тест-развилка) отдельная задача (wdbc-rdd).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { disabledArmourOverloadTier } from "../../module/combat/armor-mods.mjs";

const actorWith = (encumbrance, sBonus = 0) => ({
  system: { encumbrance, characteristics: { s: { bonus: sBonus } } }
});

describe("тир перевеса выключенной силовой брони", () => {
  it("вес не превышает Ношение — перевеса нет", () => {
    const actor = actorWith({ carry: 100, lift: 200, push: 400 });
    expect(disabledArmourOverloadTier(actor, 100)).toBe(null);
    expect(disabledArmourOverloadTier(actor, 50)).toBe(null);
  });

  it("вес > Ношения, ≤ Подъёма — тир 1", () => {
    const actor = actorWith({ carry: 100, lift: 200, push: 400 });
    const r = disabledArmourOverloadTier(actor, 150);
    expect(r.tier).toBe(1);
    expect(r.moveAtkMod).toBe(-10);
    expect(r.spdMod).toBe(-1);
    expect(r.fullActionOnly).toBe(false);
    expect(r.helpless).toBe(false);
  });

  it("вес = Подъёму включительно — ещё тир 1", () => {
    const actor = actorWith({ carry: 100, lift: 200, push: 400 });
    expect(disabledArmourOverloadTier(actor, 200).tier).toBe(1);
  });

  it("вес > Подъёма, ≤ Толкания — тир 2, только Полное действие, штраф теста −20", () => {
    const actor = actorWith({ carry: 100, lift: 200, push: 400 });
    const r = disabledArmourOverloadTier(actor, 300);
    expect(r.tier).toBe(2);
    expect(r.fullActionOnly).toBe(true);
    expect(r.helpless).toBe(false);
    expect(r.testPenalty).toBe(-20);
  });

  it("вес > Толкания — тир 3, Беспомощен", () => {
    const actor = actorWith({ carry: 100, lift: 200, push: 400 });
    const r = disabledArmourOverloadTier(actor, 500);
    expect(r.tier).toBe(3);
    expect(r.helpless).toBe(true);
  });

  it("исключение: Ношение по чистому S.b ≥5× веса брони — каскада нет", () => {
    // S.b=8 → carryRow(8).carry (между 18 у idx4 и 78 у idx10) — заведомо
    // больше 30 (5× веса брони 6 кг), даже если общее Ношение актора (по
    // сумме S.b+T.b) ниже веса брони.
    const actor = actorWith({ carry: 5, lift: 10, push: 20 }, 8);
    expect(disabledArmourOverloadTier(actor, 6)).toBe(null);
  });

  it("исключение не срабатывает, если S.b мал", () => {
    const actor = actorWith({ carry: 5, lift: 10, push: 20 }, 0);
    // carryRow(0).carry = 0.9 → ×5 = 4.5, меньше веса брони (6) — исключение не действует.
    expect(disabledArmourOverloadTier(actor, 6).tier).toBe(1);
  });

  it("нулевой/отрицательный вес брони — не перевес", () => {
    const actor = actorWith({ carry: 100, lift: 200, push: 400 });
    expect(disabledArmourOverloadTier(actor, 0)).toBe(null);
    expect(disabledArmourOverloadTier(actor, -5)).toBe(null);
  });
});
