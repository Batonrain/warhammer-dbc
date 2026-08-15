// test/sheets/horde-attack.test.mjs
//
// Атака Орды считает урон своим кодом, но правило Бонуса Силы у неё то же, что
// у обычной атаки: Могучее ×2, Сдержанное 0. Правило живёт в meleeStrengthBonus
// (module/combat/attack-outcome.mjs) — здесь проверяется, что Орда даёт те же
// числа, чтобы вторую копию правила можно было снять (wdbc-ff4.11).
//
// Хватов у Орды нет, поэтому половинного Бонуса Силы («в полтора») тут не будет.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { WarhammerHordeSheet } from "../../module/sheets/horde-sheet.mjs";

/** Орда: Магнитуда даёт добавочные кубы урона, здесь они не нужны. */
function hordeFor() {
  return actorFor({ derived: { magDamageDice: 0 } });
}

/** Вызов метода листа без самого листа: ему нужен только this.actor. */
function hordeAttack(actor, weapon) {
  return WarhammerHordeSheet.prototype._executeHordeAttack.call(
    { actor }, weapon, "ws", 50, true, 3);
}

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("бонус Силы в атаке Орды", () => {
  const melee = props => weaponFor(
    { weaponClass: "melee", damage: "1d10+2", penetration: 2, weaponProps: props },
    { name: "Цепной меч" });

  it("обычное оружие добавляет S.b целиком", async () => {
    captured.dice = [30, 5];
    await hordeAttack(hordeFor(), melee([]));
    expect(card()).toContain("S.b +4");
  });

  it("Могучее удваивает S.b", async () => {
    captured.dice = [30, 5];
    await hordeAttack(hordeFor(), melee([{ key: "mighty" }]));
    expect(card()).toContain("S.b +8");
  });

  it("Сдержанное убирает S.b", async () => {
    captured.dice = [30, 5];
    await hordeAttack(hordeFor(), melee([{ key: "contained" }]));
    expect(card()).toContain("S.b +0");
  });
});
