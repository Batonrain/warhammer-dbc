// test/combat/attack-grenade-melee-self-immune.test.mjs
//
// Стр. 40, wdbc-x1nz.2.60: граната как рукопашное оружие — «если атакующий
// нанёс удар с 3 и более Успехами, он не задет собственным Взрывом».
// Информационная строка на карточке — распределение по Взрыву остаётся
// на усмотрение GM, как у Вторичных целей Очереди.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Граната в рукопашной: 3+ Успеха — атакующий не задет своим Взрывом (wdbc-x1nz.2.60)", () => {
  it("рукопашная атака, 3+ Успеха, Взрыв — печатает строку самоиммунитета", async () => {
    const weapon = weaponFor({
      weaponType: "grenade", weaponClass: "thrown", damage: "2d10", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    }, { id: "w1" });
    weapon.update = async () => {};
    weapon.delete = async () => { weapon.deleted = true; };
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5]; // rv=10 против Порога 45 — попадание с большим запасом (3+ Успеха); 2d10 урона

    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { forceMelee: true });

    expect(card()).toContain("не задет собственным Взрывом");
  });

  it("рукопашная атака, попадание всего с 1 Успехом — строки нет", async () => {
    const weapon = weaponFor({
      weaponType: "grenade", weaponClass: "thrown", damage: "2d10", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    }, { id: "w1" });
    weapon.update = async () => {};
    weapon.delete = async () => { weapon.deleted = true; };
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [44, 5, 5]; // rv=44 против Порога 45 — попадание впритык (1 Успех)

    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { forceMelee: true });

    expect(card()).not.toContain("не задет собственным Взрывом");
  });

  it("стрелковый бросок гранаты (не рукопашная), 3+ Успеха — строки нет", async () => {
    const weapon = weaponFor({
      weaponType: "grenade", weaponClass: "thrown", damage: "2d10", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("не задет собственным Взрывом");
  });
});
