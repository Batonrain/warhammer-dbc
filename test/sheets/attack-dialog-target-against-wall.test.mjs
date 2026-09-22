// test/sheets/attack-dialog-target-against-wall.test.mjs
//
// Молот/Топор по лежащей или прижатой к стене цели (core.json, «Типы
// Рукопашного Оружия»): «лежащая» цель — авточтение статуса Повержен (см.
// attack-dialog-mace.test.mjs соседей и test/sheets/attack-dialog.test.mjs
// «Цель Повалена»), «прижата к стене» система не отслеживает (нет геометрии
// стен) — решает ГМ галочкой, показанной только этим двум типам оружия. Сам
// боевой эффект (+1d10, Concussive/Felling +1) — в
// test/combat/attack-melee-type-bonus.test.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Цель прижата к стене: галочка в диалоге атаки", () => {
  it("Молот — галочка есть, подписана Concussive", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Молот" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).toContain("atk-target-against-wall");
    expect(html()).toContain("Concussive");
  });

  it("Топор — галочка есть, подписана Felling", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Топор" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).toContain("atk-target-against-wall");
    expect(html()).toContain("Felling");
  });

  it("Меч — галочки нет", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).not.toContain("atk-target-against-wall");
  });

  it("не рукопашная — галочки нет, даже если meleeCategory Молот", () => {
    const weapon = weaponFor({ meleeCategory: "Молот" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);
    expect(html()).not.toContain("atk-target-against-wall");
  });
});
