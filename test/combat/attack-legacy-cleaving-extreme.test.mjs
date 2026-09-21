// test/combat/attack-legacy-cleaving-extreme.test.mjs
//
// Кромсающее/fearsome 10-10, Оружие Наследия (wdbc-1rno.35, стр. 427): «При
// нанесении Экстремального Урона персонаж бросает 1d5+1 на Критический
// Результат» — тот же примитив, что Monofilament (wp.extremeLevelBonus, см.
// test/combat/extreme-level-bonus.test.mjs для самой формулы), здесь
// проверяется только проводка: attack.mjs действительно подмешивает +1 для
// оружия с этой Мутацией.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Кромсающее: +1 к extremeLevel (1d5+1 вместо 1d5)", () => {
  it("оружие с Мутацией — бросок кубика 3 на 1d5 даёт extremeLevel 4 (+1)", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Кромсающее" }] } });
    const actor  = actorFor({ items: [weapon] });
    // captured.dice: rv атаки, кубик урона (10 — триггерит Экстремальный), 1d5 на extremeLevel.
    captured.dice = [10, 10, 3];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("Экстремальный урон");
    expect(card()).toContain("d5: 4");
  });

  it("без Мутации — тот же бросок кубика 3 даёт extremeLevel 3 (нет +1)", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [] } });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 10, 3];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("Экстремальный урон");
    expect(card()).toContain("d5: 3");
  });
});
