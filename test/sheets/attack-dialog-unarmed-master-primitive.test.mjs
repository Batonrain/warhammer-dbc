import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const MASTER = { id: "um", name: "Unarmed Master / Безоружный Мастер", type: "talent", system: {} };

beforeEach(() => { resetCaptured(); });

function fist() {
  const w = weaponFor({
    weaponClass: "melee", equipped: true, damage: "1d5-3", damageType: "impact",
    weaponProps: [{ key: "primitive" }, { key: "reinforced" }]
  }, { id: "fist", name: "Кулак" });
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

function open(items) {
  const weapon = fist();
  const actor = actorFor({ items: [weapon, ...items] });
  actor.getFlag = () => undefined;
  showAttackDialog(actor, weapon);
  return captured.dialog.content;
}

describe("окно атаки: Безоружный Мастер", () => {
  it("с Талантом Примитивное в «Свойствах оружия» не показано, прочие свойства остаются", () => {
    const html = open([MASTER]);
    expect(html).not.toContain("Примитивное");
    expect(html).toContain("Укреплённое");
  });

  it("без Таланта Примитивное показано", () => {
    const html = open([]);
    expect(html).toContain("Примитивное");
  });
});
