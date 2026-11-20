// Тестудо и Гекатонхейр (Разобрать tfgq9).
import { describe, it, expect } from "vitest";
import { isDendriteShield, hasTestudo, testudoShieldCap, testudoMountBlock, testudoOverCap } from "../../module/rules/testudo.mjs";
import { weaponHandsRequired } from "../../module/rules/hands.mjs";
import { equippedMeleeWeapon } from "../../module/combat/equipped-melee.mjs";
import { craftShiftHours } from "../../module/rules/mechadendrites.mjs";

const shield = (id, mounted = false, equipped = true) => ({
  id, type: "weapon", name: `Щит ${id}`,
  system: { shieldAP: 2, shieldZones: "Т+Р1", weaponClass: "melee", equipped },
  flags: { "warhammer-dbc": { dendriteMounted: mounted } },
  getFlag(s, k) { return this.flags[s]?.[k]; }
});
const talent = name => ({ type: "talent", name, system: {} });
const actorOf = (items, wsb = 4) => ({ items, system: { characteristics: { ws: { bonus: wsb } } } });

describe("Тестудо", () => {
  it("щит на дендрите руку не занимает и не парирует", () => {
    const s = shield("a", true);
    expect(isDendriteShield(s)).toBe(true);
    expect(weaponHandsRequired(s, actorOf([s]))).toBe(0);
    expect(weaponHandsRequired(shield("b"), actorOf([]))).toBe(1);
    expect(equippedMeleeWeapon(actorOf([s]))).toBe(null);
  });

  it("предел — ½WS.b вверх", () => {
    expect(testudoShieldCap(actorOf([], 3))).toBe(2);
    expect(testudoShieldCap(actorOf([], 4))).toBe(2);
  });

  it("поставить можно только с Талантом и в пределах", () => {
    const a = shield("a", true), b = shield("b", true), c = shield("c");
    expect(testudoMountBlock(actorOf([c]), c)).toMatch(/Testudo/);
    const act = actorOf([talent("Testudo / Тестудо"), a, b, c], 4);
    expect(hasTestudo(act)).toBe(true);
    expect(testudoMountBlock(act, c)).toMatch(/не больше/);
    expect(testudoMountBlock(actorOf([talent("Testudo"), a, c], 4), c)).toBe("");
    expect(testudoOverCap(actorOf([a, b, shield("d", true)], 4))).toBe(true);
  });
});

describe("Гекатонхейр — длина смены", () => {
  it("без Таланта 8 ч, с Талантом −0,5 за лишнюю руку, не меньше 2", () => {
    expect(craftShiftHours(actorOf([]), { extraArms: 4 })).toBe(8);
    const h = actorOf([talent("Hecatoncheires / Гекатонхейр")]);
    expect(craftShiftHours(h, { extraArms: 2 })).toBe(7);
    expect(craftShiftHours(h, { extraArms: 40 })).toBe(2);
  });
});
