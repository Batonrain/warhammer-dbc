// test/sheets/attack-dialog-rapier-sabre.test.mjs
//
// Рапира/Сабля (core.json, «Типы Рукопашного Оружия»): «Рапира использует
// тип Меч, но получает +10 на прием Выпад, –10 на прием Широкий Взмах» /
// «Сабля использует тип Меч, но получает +10 на прием Широкий Взмах, –10 на
// прием Выпад» — подтип хранится в system.meleeSubtype (meleeCategory у
// обоих остаётся «Меч»).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  return a;
}

function dialogThreshold() {
  const m = (captured.dialog?.content ?? "").match(/id="atk-total-display">(-?\d+)</);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Рапира: +10 Выпад, −10 Широкий Взмах", () => {
  it("Выпад — +10 к порогу", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    showAttackDialog(attacker({ items: [weapon] }), weapon, { technique: "thrust" });
    expect(dialogThreshold()).toBe(65); // WS 45 + База 10 + Выпад(Рапира) 10
  });

  it("Широкий Взмах — −10 к порогу", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    showAttackDialog(attacker({ items: [weapon] }), weapon, { technique: "sweep" });
    expect(dialogThreshold()).toBe(45); // WS 45 + База 10 − Взмах(Рапира) 10
  });
});

describe("Сабля: +10 Широкий Взмах, −10 Выпад", () => {
  it("Широкий Взмах — +10 к порогу", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon] }), weapon, { technique: "sweep" });
    expect(dialogThreshold()).toBe(65);
  });

  it("Выпад — −10 к порогу", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon] }), weapon, { technique: "thrust" });
    expect(dialogThreshold()).toBe(45);
  });
});

describe("Обычный Меч (без подтипа) — Выпад/Взмах без бонуса", () => {
  it("Выпад — без изменений (55)", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    showAttackDialog(attacker({ items: [weapon] }), weapon, { technique: "thrust" });
    expect(dialogThreshold()).toBe(55);
  });

  it("Широкий Взмах — без изменений (55)", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    showAttackDialog(attacker({ items: [weapon] }), weapon, { technique: "sweep" });
    expect(dialogThreshold()).toBe(55);
  });
});
