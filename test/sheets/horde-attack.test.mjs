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

// Ослеплённая Орда (wdbc-x1nz.2.89, хвост сверки «Статусы»): у Орды свой
// бросок, мимо общего исхода теста — автопровал читается на листе.
describe("Ослеплённая Орда", () => {
  const gun = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, weaponProps: [] },
    { name: "Лазган" });

  it("стрельба с автопровалом — промах даже на броске ниже Порога", async () => {
    captured.dice = [5, 5];
    await WarhammerHordeSheet.prototype._executeHordeAttack.call(
      { actor: hordeFor() }, gun(), "bs", 50, false, 3, { autoFail: true });
    expect(card()).toContain("Автопровал: Орда Ослеплена");
    expect(card()).toContain("Промах");
  });

  it("без автопровала тот же бросок — попадание", async () => {
    captured.dice = [5, 5];
    await WarhammerHordeSheet.prototype._executeHordeAttack.call(
      { actor: hordeFor() }, gun(), "bs", 50, false, 3);
    expect(card()).not.toContain("Автопровал");
    expect(card()).toContain("Попадание");
  });

  it("тест BS Ослеплённой Орды — автопровал в карточке", async () => {
    captured.dice = [5];
    const actor = actorFor({ conditions: { blinded: true } });
    await WarhammerHordeSheet.prototype._rollTest.call(
      { actor }, { label: "BS", threshold: 50, prefix: "BS", ctx: { kind: "skill", char: "bs" } });
    expect(card()).toContain("Автопровал");
    expect(card()).toContain("Провал");
  });

  it("тест BS зрячей Орды на том же броске — успех", async () => {
    captured.dice = [5];
    await WarhammerHordeSheet.prototype._rollTest.call(
      { actor: actorFor({ conditions: {} }) }, { label: "BS", threshold: 50, prefix: "BS", ctx: { kind: "skill", char: "bs" } });
    expect(card()).not.toContain("Автопровал");
    expect(card()).toContain("Успех");
  });
});
