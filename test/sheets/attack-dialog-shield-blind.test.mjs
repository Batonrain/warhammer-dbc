// test/sheets/attack-dialog-shield-blind.test.mjs
//
// Щит на голове (core.json, «Типы Рукопашного Оружия», разд. «Щит»): «При
// прикрытии головы щитом, персонаж перекрывает себе обзор... персонаж
// считается слепым с углов прикрытия щита» — упрощено до обычного
// Ослепления (та же строка/чекбокс «Ослеплён», что уже даёт conditions.blinded
// — см. test/sheets/attack-dialog.test.mjs), без различения направления
// (геометрии для этого в системе нет).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

beforeEach(() => { resetCaptured(); });

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  return a;
}

/** Щит, прикрывающий голову — «(Г)» требует shieldRaised. */
function headShield({ raised = true } = {}) {
  return weaponFor(
    { weaponClass: "melee", shieldAP: 4, shieldZones: "Т+Р1+(Г)", equipped: true },
    { id: "shield-1", name: "Щит", flags: raised ? { "warhammer-dbc.shieldRaised": true } : {} }
  );
}

/** Щит без зоны головы вовсе. */
function bodyOnlyShield() {
  return weaponFor(
    { weaponClass: "melee", shieldAP: 4, shieldZones: "Т+Р1", equipped: true },
    { id: "shield-2", name: "Щит" }
  );
}

describe("Щит на голове: то же Ослепление, что и обычное (авточекбокс)", () => {
  it("щит с зоной «(Г)» поднят — Ослеплён отмечен заранее, штраф −30 в рукопашной", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    showAttackDialog(attacker({ items: [sword, headShield()] }), sword);
    expect(captured.dialog.content).toMatch(/atk-mod-auto[\s\S]*?Ослеплён \(-30\)/);
  });

  it("щит с зоной «(Г)», но НЕ поднят — Ослепления нет (частичная зона требует shieldRaised)", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    showAttackDialog(attacker({ items: [sword, headShield({ raised: false })] }), sword);
    expect(captured.dialog.content).not.toMatch(/atk-mod-auto[\s\S]*?Ослеплён/);
  });

  it("щит без зоны головы вовсе — Ослепления нет", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    showAttackDialog(attacker({ items: [sword, bodyOnlyShield()] }), sword);
    expect(captured.dialog.content).not.toMatch(/atk-mod-auto[\s\S]*?Ослеплён/);
  });

  it("без щита вовсе — Ослепления нет", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).not.toMatch(/atk-mod-auto[\s\S]*?Ослеплён/);
  });
  // wdbc-t3c3t.1: слепит только поднятый к голове щит, не пассивное покрытие.
  it("щит «Все» (Эльдарский Силовой) голову прикрывает всегда — но без подъёма к голове Ослепления нет", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    const all = weaponFor({ weaponClass: "melee", shieldAP: 4, shieldZones: "Все", equipped: true },
      { id: "shield-3", name: "Силовой щит", flags: { "warhammer-dbc.shieldRaised": true } });
    showAttackDialog(attacker({ items: [sword, all] }), sword);
    expect(captured.dialog.content).not.toMatch(/atk-mod-auto[\s\S]*?Ослеплён/);
  });

  it("Каплевидный «(Г)/(Н1+Н2)» поднят, выбран вариант ног — Ослепления нет", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    const kite = weaponFor({ weaponClass: "melee", shieldAP: 4, shieldZones: "Т+Р1+(Г)/(Н1+Н2)", equipped: true },
      { id: "shield-4", name: "Каплевидный", flags: { "warhammer-dbc.shieldRaised": true, "warhammer-dbc.shieldVariant": 1 } });
    showAttackDialog(attacker({ items: [sword, kite] }), sword);
    expect(captured.dialog.content).not.toMatch(/atk-mod-auto[\s\S]*?Ослеплён/);
  });

  it("Каплевидный «(Г)/(Н1+Н2)» не поднят — Ослепления нет", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { id: "sword-1" });
    const kite = weaponFor({ weaponClass: "melee", shieldAP: 4, shieldZones: "Т+Р1+(Г)/(Н1+Н2)", equipped: true },
      { id: "shield-4", name: "Каплевидный" });
    showAttackDialog(attacker({ items: [sword, kite] }), sword);
    expect(captured.dialog.content).not.toMatch(/atk-mod-auto[\s\S]*?Ослеплён/);
  });
});
