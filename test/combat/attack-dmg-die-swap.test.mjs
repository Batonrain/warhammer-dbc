// test/combat/attack-dmg-die-swap.test.mjs
//
// Стр. 34, wdbc-x1nz.2.49: «Атакующий может выбрать заменить результат
// броска одного кубика в броске на урон... на количество Успехов в тесте на
// атаку.» attack.mjs кладёт baseDieResult (первый кубик формулы урона) и
// successes (deg) в каждое попадание — кнопку строит attack-card.mjs
// (см. attack-card.test.mjs), а DOM-подмену числа делает hooks.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("сквозной прогон: кнопка замены кубика доносит правильные числа", () => {
  it("1d10+5, бросок d100=10 (4 степени) — кубик 3, Успехи 4", async () => {
    const weapon = weaponFor({ damage: "1d10+5" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 3]; // атака: rv=10 → Порог 45, deg=4; урон: 1d10=3 → total 8

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="8"');
    expect(card()).toContain("wh-dmg-swap-btn");
    expect(card()).toContain('data-base-die="3"');
    expect(card()).toContain('data-successes="4"');
    expect(card()).toContain("Кубик→Успехи: 3→4 (итог станет 9)");
  });

  it("оружие без кубика в формуле урона (фиксированное число) — кнопки нет", async () => {
    const weapon = weaponFor({ damage: "5" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="5"');
    expect(card()).not.toContain("wh-dmg-swap-btn");
  });
});
