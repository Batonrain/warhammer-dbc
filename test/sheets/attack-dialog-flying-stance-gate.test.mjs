// test/sheets/attack-dialog-flying-stance-gate.test.mjs
//
// Стойки — «только в пешем бою» (стр. 15, wdbc-x1nz.2.66.10): раньше
// groundedOk проверял только isMounted, полёт (system.movement.altitude
// low/high) не учитывался вовсе.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  return a;
}

beforeEach(() => resetCaptured());

describe("Стойка — только в пешем бою: полёт (Низкая/Высокая) тоже блокирует", () => {
  it("altitude:'low' — доступна только Стандартная Стойка", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword], movement: { altitude: "low" } }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="aggressive"/);
  });

  it("altitude:'high' — тоже блокирует", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword], movement: { altitude: "high" } }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="aggressive"/);
  });

  it("altitude:'ground' — Стойки доступны как обычно (регресс)", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword], movement: { altitude: "ground" } }), sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-stance" value="aggressive"/);
    expect(html).not.toMatch(/name="atk-stance" value="aggressive"[^>]*disabled/);
  });

  it("altitude:'landed' (по умолчанию) — Стойки доступны как обычно (регресс)", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-stance" value="aggressive"/);
  });
});
