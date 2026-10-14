// test/combat/damage-only-roll.test.mjs
//
// Урон напрямую, мимо броска атаки (wdbc-6rj): кнопка «Урон» у оружия на
// вкладке БОЙ — формула оружия (с подстановкой бонусов характеристик) плюс
// ручной модификатор, N раз, карточка в чат. Диалог параметров (DialogV2) не
// проверяется здесь — только сам расчёт/бросок/карточка.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { rollWeaponDamageOnly } from "../../module/combat/damage-only-roll.mjs";

beforeEach(() => resetCaptured());

describe("rollWeaponDamageOnly", () => {
  it("один бросок, без модификатора — формула оружия как есть", async () => {
    const weapon = weaponFor({ damage: "1d10+3", damageType: "R", penetration: 2 }, { id: "w1", name: "Болтер" });
    const actor = actorFor({ items: [weapon] });
    captured.nextRoll = 7;

    await rollWeaponDamageOnly(actor, weapon);

    expect(captured.rolls).toEqual(["1d10+3"]);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("7");
    expect(captured.chat[0].content).toContain("Болтер");
  });

  it("модификатор дописывается в формулу", async () => {
    const weapon = weaponFor({ damage: "1d10+3" }, { id: "w1", name: "Болтер" });
    const actor = actorFor({ items: [weapon] });
    captured.nextRoll = 10;

    await rollWeaponDamageOnly(actor, weapon, { modifier: 5 });

    expect(captured.rolls).toEqual(["1d10+3 + 5"]);
  });

  it("несколько попаданий — по одному броску на каждое, с итогом", async () => {
    const weapon = weaponFor({ damage: "1d10" }, { id: "w1", name: "Нож" });
    const actor = actorFor({ items: [weapon] });
    captured.nextRoll = 4;

    await rollWeaponDamageOnly(actor, weapon, { hits: 3 });

    expect(captured.rolls).toHaveLength(3);
    expect(captured.chat[0].content).toContain("Итого по всем попаданиям: <b>12</b>");
  });

  it("имя цели попадает в карточку, когда указано", async () => {
    const weapon = weaponFor({ damage: "1d10" }, { id: "w1" });
    const actor = actorFor({ items: [weapon] });
    captured.nextRoll = 5;

    await rollWeaponDamageOnly(actor, weapon, { targetName: "Культист" });

    expect(captured.chat[0].content).toContain("Культист");
  });

  it("бонус характеристики подставляется в формулу (S.b)", async () => {
    const weapon = weaponFor({ damage: "1d10+S.b" }, { id: "w1" });
    const actor = actorFor({ items: [weapon] });
    actor.system.characteristics.s = { bonus: 4 };
    captured.nextRoll = 6;

    await rollWeaponDamageOnly(actor, weapon);

    expect(captured.rolls).toEqual(["1d10+4"]);
  });
});
