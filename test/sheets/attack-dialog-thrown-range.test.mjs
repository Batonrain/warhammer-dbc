// test/sheets/attack-dialog-thrown-range.test.mjs
//
// Стр. 40, wdbc-x1nz.2.58: «Rng метательного оружия равна S.b×3м» — живой
// расчёт от броска атакующего, не паковое число.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("Метательное оружие: Rng = S.b×3м (wdbc-x1nz.2.58)", () => {
  it("S.b 4 — Дальность оружия считается как 12м, не паковое system.range", () => {
    const weapon = weaponFor({ weaponClass: "thrown", range: 999 }, { id: "w1" });
    const actor  = actorFor({ items: [weapon], aiming: "none", characteristics: { s: { total: 40, bonus: 4 } } });
    const shooterToken = { actor, document: { x: 0, y: 0, width: 1, height: 1 } };
    const targetToken   = { actor: { name: "Цель" }, document: { x: 5, y: 0, width: 1, height: 1 } };
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("Дальность оружия: 12 м");
  });

  it("выше S.b — выше Rng (нет фиксированного значения из пака)", () => {
    const weapon = weaponFor({ weaponClass: "thrown", range: 5 }, { id: "w1" });
    const actor  = actorFor({ items: [weapon], aiming: "none", characteristics: { s: { total: 70, bonus: 7 } } });
    const shooterToken = { actor, document: { x: 0, y: 0, width: 1, height: 1 } };
    const targetToken   = { actor: { name: "Цель" }, document: { x: 5, y: 0, width: 1, height: 1 } };
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("Дальность оружия: 21 м");
  });
});
