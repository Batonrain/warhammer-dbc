// test/rules/blood-flame.test.mjs
//
// Кровавое Пламя (wdbc-1rno, Дар Кхорна): идентификация предмета и бонус
// урона за убитых этим оружием с начала усиления (+2 Dmg, до +8 — 4
// убийства). Активация/деактивация — test/apps/blood-flame.test.mjs,
// боевой такт (убийство/конец боя) — test/combat/blood-flame.test.mjs.

import { describe, it, expect } from "vitest";
import {
  isBloodFlameItem, isBloodFlameActive, bloodFlameDamageBonus,
  ACTIVE_FLAG, KILLS_FLAG
} from "../../module/rules/blood-flame.mjs";

const NS = "warhammer-dbc";

function weaponWithFlags(flags = {}) {
  const store = { ...flags };
  return {
    type: "weapon",
    getFlag: (ns, key) => (ns === NS ? store[key] : undefined)
  };
}

describe("isBloodFlameItem — опознание Дара", () => {
  it("по capabilityKey (kind:capability, gift.khorne.bloodFlame)", () => {
    const item = {
      type: "mutation",
      flags: { [NS]: { mechanics: [{ id: "g1", operator: "AND", entries: [
        { id: "e1", kind: "capability", capabilityKey: "gift.khorne.bloodFlame" }
      ] }] } }
    };
    expect(isBloodFlameItem(item)).toBe(true);
  });

  it("по имени, если capabilityKey ещё не проставлен (двуязычное имя)", () => {
    expect(isBloodFlameItem({ type: "mutation", name: "Blood Flame / Кровавое Пламя", flags: {} })).toBe(true);
  });

  it("другая Мутация — false", () => {
    expect(isBloodFlameItem({ type: "mutation", name: "The Hunter / Загонщик", flags: {} })).toBe(false);
  });

  it("не Мутация (тип предмета другой) — false, даже с тем же именем", () => {
    expect(isBloodFlameItem({ type: "talent", name: "Blood Flame / Кровавое Пламя", flags: {} })).toBe(false);
  });
});

describe("isBloodFlameActive / bloodFlameDamageBonus", () => {
  it("не оружие — не активно, бонус 0", () => {
    expect(isBloodFlameActive({ type: "mutation" })).toBe(false);
    expect(bloodFlameDamageBonus({ type: "mutation" })).toBe(0);
  });

  it("оружие без флага активации — не активно, бонус 0", () => {
    const w = weaponWithFlags({});
    expect(isBloodFlameActive(w)).toBe(false);
    expect(bloodFlameDamageBonus(w)).toBe(0);
  });

  it("активно, 0 убитых — бонус 0 (не −2, не NaN)", () => {
    const w = weaponWithFlags({ [ACTIVE_FLAG]: true, [KILLS_FLAG]: 0 });
    expect(bloodFlameDamageBonus(w)).toBe(0);
  });

  it("1 убитый — +2 Dmg", () => {
    const w = weaponWithFlags({ [ACTIVE_FLAG]: true, [KILLS_FLAG]: 1 });
    expect(bloodFlameDamageBonus(w)).toBe(2);
  });

  it("3 убитых — +6 Dmg", () => {
    const w = weaponWithFlags({ [ACTIVE_FLAG]: true, [KILLS_FLAG]: 3 });
    expect(bloodFlameDamageBonus(w)).toBe(6);
  });

  it("4 убитых — потолок +8 Dmg (книжный максимум)", () => {
    const w = weaponWithFlags({ [ACTIVE_FLAG]: true, [KILLS_FLAG]: 4 });
    expect(bloodFlameDamageBonus(w)).toBe(8);
  });

  it("5+ убитых — бонус НЕ растёт дальше +8", () => {
    const w = weaponWithFlags({ [ACTIVE_FLAG]: true, [KILLS_FLAG]: 9 });
    expect(bloodFlameDamageBonus(w)).toBe(8);
  });
});
