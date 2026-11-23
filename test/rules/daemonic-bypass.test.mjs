// test/rules/daemonic-bypass.test.mjs
// Sahara daemonic-force-sanctified-warp-weapon п.3: что игнорирует +X к T.b от Daemonic (X).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { isDaemonicTrait, daemonicTbBonus, bypassesDaemonic } from "../../module/rules/daemonic-bypass.mjs";

const trait = (name, value, { disabled = false, effects = true, rating = 0 } = {}) => ({
  type: "trait", name, system: { rating },
  effects: effects ? [{ disabled, system: { changes: [{ key: "system.characteristics.t.bonusFx", value }] } }] : []
});
const weapon = (props = [], extra = {}) => ({ type: "weapon", name: "W", system: { weaponProps: props.map(key => ({ key })), daemonWeapon: {}, ...extra }, getFlag: () => undefined });

describe("Daemonic (X): прибавка к T.b", () => {
  it("опознаёт только саму Черту, не Ужас/Подключение/Вооружение", () => {
    expect(isDaemonicTrait({ type: "trait", name: "Daemonic / Демонический (X)" })).toBe(true);
    expect(isDaemonicTrait({ type: "trait", name: "Daemonic (+4) / Демонический" })).toBe(true);
    expect(isDaemonicTrait({ type: "trait", name: "Daemonic Dread (10 W) / Демонический Ужас" })).toBe(false);
    expect(isDaemonicTrait({ type: "trait", name: "Daemonic Armament / Демоническое Вооружение" })).toBe(false);
  });

  it("X берётся из эффекта Черты; выключенный эффект не считается", () => {
    expect(daemonicTbBonus({ items: [trait("Daemonic (+4) / Демонический", 4)] })).toBe(4);
    expect(daemonicTbBonus({ items: [trait("Daemonic (+4) / Демонический", 4, { disabled: true })] })).toBe(0);
    expect(daemonicTbBonus({ items: [trait("Daemonic / Демонический (X)", 0, { effects: false, rating: 3 })] })).toBe(3);
    expect(daemonicTbBonus({ items: [] })).toBe(0);
  });
});

describe("Daemonic (X): что обходит Трейт", () => {
  it("психосила, Освящённое, Варп-Оружие", () => {
    expect(bypassesDaemonic({ psychicPowerType: "attack" })).toBe(true);
    expect(bypassesDaemonic({ sanctified: true })).toBe(true);
    expect(bypassesDaemonic({ warpSoak: true })).toBe(true);
  });
  it("оружие с Force / Sanctified / Warp Weapon", () => {
    expect(bypassesDaemonic({ weapon: weapon(["force"]) })).toBe(true);
    expect(bypassesDaemonic({ weapon: weapon(["warpWeapon"]) })).toBe(true);
    expect(bypassesDaemonic({ weapon: weapon(["tearing"]) })).toBe(false);
  });
  it("Демоническое и Руническое оружие", () => {
    expect(bypassesDaemonic({ weapon: weapon([], { daemonWeapon: { bound: true } }) })).toBe(true);
    expect(bypassesDaemonic({ weapon: weapon([], { daemonWeapon: { runic: true } }) })).toBe(true);
  });
  it("естественное оружие — только если у атакующего тоже Daemonic", () => {
    const claws = { ...weapon(), getFlag: (s, k) => k === "integralAttack" };
    expect(bypassesDaemonic({ weapon: claws, attacker: { items: [trait("Daemonic (+2) / Демонический", 2)] } })).toBe(true);
    expect(bypassesDaemonic({ weapon: claws, attacker: { items: [] } })).toBe(false);
  });
  it("обычное оружие без атакующего — не обходит", () => {
    expect(bypassesDaemonic({})).toBe(false);
  });
});
