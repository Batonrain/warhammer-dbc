// test/combat/overheats.test.mjs
//
// Перегрев / Overheats (core, «Особые Свойства Оружия»): «вместо Клина оно
// наносит урон по самому стрелку, в руку, что держит его (случайную если ее
// держали двумя)». Раньше карточка писала «Оружие заклинило!» (Sahara overheats).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { overheatArm, hasOverheats } from "../../module/combat/overheats.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Перегрев вместо Клина", () => {
  it("плазма на броске Клина не клинит: урон по стрелку в руку, патроны целы", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_single: 1, damage: "1d10+5", penetration: 6,
      weaponProps: [{ key: "overheats" }] }, { id: "w1" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [97, 4];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(weapon.system.jammed).toBeFalsy();
    expect(card()).toContain("Перегрев");
    expect(card()).toMatch(/wh-apply-dmg-btn/);
    expect(card()).toMatch(/data-penetration="6"/);
    expect(card()).toMatch(/Рука/);
  });

  it("без Перегрева — обычный Клин", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_single: 1 }, { id: "w1" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [97];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(weapon.system.jammed).toBe(true);
  });
});

describe("overheatArm", () => {
  const held = hand => ({ getFlag: (_s, k) => (k === "heldHand" ? hand : undefined) });
  it("держащая рука; двумя руками — случайная", () => {
    expect(overheatArm(held("right"))).toBe("П. Рука");
    expect(overheatArm(held("left"))).toBe("Л. Рука");
    expect(overheatArm(held("both"), 0.1)).toBe("П. Рука");
    expect(overheatArm(held(null), 0.9)).toBe("Л. Рука");
  });
  it("hasOverheats читает ключ свойства", () => {
    expect(hasOverheats([{ key: "overheats" }])).toBe(true);
    expect(hasOverheats([{ key: "maximal" }])).toBe(false);
  });
});
