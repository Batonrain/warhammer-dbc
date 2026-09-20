// test/sheets/attack-dialog-wide-burst.test.mjs
//
// Стр. 35, wdbc-x1nz.2.53: галочка «Широкая Очередь» показывается, только
// если у оружия есть Короткая или Длинная Очередь с базовым RoF ≥3 — гейт
// мягкий (по наличию хотя бы одной такой Очереди, не по текущей пилюле);
// настоящая проверка «применилась ли» — в attack.mjs (test/combat/
// attack-wide-burst.test.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Широкая Очередь: галочка в диалоге атаки", () => {
  it("rof_semi >= 3 — галочка есть", () => {
    const weapon = weaponFor({ rof_semi: 3 });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).toContain("atk-wide-burst");
  });

  it("rof_full >= 3 — галочка тоже есть", () => {
    const weapon = weaponFor({ rof_semi: 0, rof_full: 4 });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).toContain("atk-wide-burst");
  });

  it("оба RoF ниже 3 — галочки нет", () => {
    const weapon = weaponFor({ rof_semi: 2, rof_full: 0 });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).not.toContain("atk-wide-burst");
  });

  it("рукопашное оружие — галочки нет вовсе (Широкая Очередь только стрелковая)", () => {
    const weapon = weaponFor({ weaponClass: "melee", rof_semi: 4 });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).not.toContain("atk-wide-burst");
  });
});
