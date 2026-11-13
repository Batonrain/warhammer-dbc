// test/rules/resonance.test.mjs
// Резонирующее (Resonant), книга «Особые Свойства Оружия»: +1 Резонанс за
// попадание до Размер+2, кубики урона оружия × Резонанс, −10×Резонанс к
// Восприятию, −1 в конце Хода цели.

import { describe, it, expect, beforeEach } from "vitest";
import { resonanceCap, resonanceAfterHits, multiplyDamageDice } from "../../module/rules/resonance.mjs";
import { WEAPON_PROPERTIES } from "../../module/constants/weapon-properties.mjs";
import { aggregateAuto } from "../../module/combat/weapon-properties.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

describe("resonanceCap / resonanceAfterHits", () => {
  it("максимум — Размер+2, не меньше 1", () => {
    expect(resonanceCap(4)).toBe(6);
    expect(resonanceCap(0)).toBe(2);
    expect(resonanceCap(-3)).toBe(1);
  });
  it("каждое попадание +1, но не выше предела", () => {
    expect(resonanceAfterHits(0, 1, 4)).toBe(1);
    expect(resonanceAfterHits(0, 3, 4)).toBe(3);
    expect(resonanceAfterHits(2, 5, 4)).toBe(4);
  });
});

describe("multiplyDamageDice", () => {
  it("умножает число кубиков, прибавку не трогает", () => {
    expect(multiplyDamageDice("1d10+5", 3)).toBe("3d10+5");
    expect(multiplyDamageDice("2d10 + 4", 2)).toBe("4d10 + 4");
  });
  it("множитель 1 и мусор — формула как была", () => {
    expect(multiplyDamageDice("1d10+5", 1)).toBe("1d10+5");
    expect(multiplyDamageDice("7", 3)).toBe("7");
    expect(multiplyDamageDice("1d10", 0)).toBe("1d10");
  });
  it("Рвущее/Проверенное: пул и отбрасываемые кубы растут вместе (kh ×k)", () => {
    expect(multiplyDamageDice("2d10kh1+5", 2)).toBe("4d10kh2+5");
    expect(multiplyDamageDice("2d10min4kh1", 3)).toBe("6d10min4kh3");
  });
});

describe("свойство Resonant в реестре", () => {
  it("больше не меняет Надёжность (раньше ошибочно −1), а несёт флаг resonant", () => {
    const auto = WEAPON_PROPERTIES.resonant.auto;
    expect(auto.resonant).toBe(true);
    expect(auto.reliability).toBeUndefined();
  });
  it("aggregateAuto поднимает флаг и не трогает reliabilityScore", () => {
    const a = aggregateAuto([{ def: WEAPON_PROPERTIES.resonant, rating: 0 }]);
    expect(a.resonant).toBe(true);
    expect(a.reliabilityScore).toBe(0);
  });
});

describe("атака Резонирующим оружием", () => {
  beforeEach(() => { resetCaptured(); setTargets([]); });

  function resonantWeapon() {
    const w = weaponFor({
      weaponClass: "basic", damage: "1d10+5", damageType: "E", penetration: 0,
      weaponProps: [{ key: "resonant" }]
    });
    w.type = "weapon";
    return w;
  }
  function target(level, size = 0) {
    const updates = [];
    const t = actorFor({ conditions: { resonanceLevel: level }, size });
    t.update = async (u) => { updates.push(u); };
    t.updates = updates;
    return t;
  }

  it("цель с Резонансом 1: после попадания уровень 2 — урон бросается 2d10, Резонанс записан", async () => {
    const weapon = resonantWeapon();
    const attacker = actorFor({ items: [weapon] });
    const victim = target(1);
    setTargets([victim]);
    // d100 попадание, два d10 урона (3 и 4).
    captured.dice = [10, 3, 4];

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});

    const m = (captured.chat.at(-1)?.content ?? "").match(/roll-hit-dmg">(-?\d+)</);
    expect(Number(m?.[1])).toBe(3 + 4 + 5);
    expect(victim.updates.some(u => u["system.conditions.resonanceLevel"] === 2)).toBe(true);
  });

  it("предел Размер+2: цель Размера 0 с Резонансом 2 остаётся на 2", async () => {
    const weapon = resonantWeapon();
    const attacker = actorFor({ items: [weapon] });
    const victim = target(2, 0);
    setTargets([victim]);
    captured.dice = [10, 3, 4];

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});

    expect(victim.updates.length).toBe(0); // уровень не вырос — писать нечего
    const m = (captured.chat.at(-1)?.content ?? "").match(/roll-hit-dmg">(-?\d+)</);
    expect(Number(m?.[1])).toBe(3 + 4 + 5);
  });
});
