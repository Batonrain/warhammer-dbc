// test/combat/attack-thrown-weapon.test.mjs
//
// Стр. 40, wdbc-x1nz.2.58: Метательное оружие — «+S.b к урону» даже брошенным
// (не только в рукопашной), и «При Критическом Промахе... не Заклинивает»
// (общий механизм Заклинивания по Надёжности его не касается вовсе).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Метательное оружие: +S.b к урону при броске (wdbc-x1nz.2.58)", () => {
  it("брошено (не рукопашная) — урон включает S.b", async () => {
    const weapon = weaponFor({ weaponClass: "thrown", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: { s: { total: 40, bonus: 4 } } });
    captured.dice = [10, 5]; // атака: rv=10 (попадание, Порог 45); урон: 1d10=5

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="9"'); // 5 + S.b 4
  });

  it("обычное стрелковое (basic) — S.b НЕ добавляется брошенным путём", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: { s: { total: 40, bonus: 4 } } });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="5"');
  });
});

describe("Метательное оружие: не Заклинивает (wdbc-x1nz.2.58)", () => {
  it("Ненадёжное метательное, высокий бросок урона — не клинит", async () => {
    const weapon = weaponFor({
      weaponClass: "thrown", damage: "1d10", rof_single: 1,
      weaponProps: [{ key: "unreliable" }]
    });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [95, 5]; // rv=95 — попало бы в порог клина Ненадёжного (91+) у обычного стрелкового

    await _executeAttackRoll(actor, weapon, "bs", 96, "single", null, {});

    expect(weapon.system.jammed).toBe(false);
  });

  it("то же Ненадёжное, но обычное стрелковое — клинит на том же броске", async () => {
    const weapon = weaponFor({
      weaponClass: "basic", damage: "1d10", rof_single: 1,
      weaponProps: [{ key: "unreliable" }]
    });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [95, 5];

    await _executeAttackRoll(actor, weapon, "bs", 96, "single", null, {});

    expect(weapon.system.jammed).toBe(true);
  });
});
