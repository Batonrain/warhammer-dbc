// test/sheets/attack-dialog-confined-space.test.mjs
//
// Стр. 36, wdbc-x1nz.2.63: галочка «Тесное помещение» показывается только у
// Взрывного оружия — остальным книжный бонус не полагается. Решает ГМ на
// глаз (система не знает геометрии стен); настоящий эффект — в attack.mjs
// (test/combat/attack-confined-space.test.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Тесное помещение: галочка в диалоге атаки", () => {
  it("Взрывное оружие — галочка есть", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).toContain("atk-confined-space");
    expect(html()).toContain("Тесное помещение");
  });

  it("не Взрывное оружие — галочки нет", () => {
    const weapon = weaponFor({ weaponProps: [] });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).not.toContain("atk-confined-space");
  });
});
