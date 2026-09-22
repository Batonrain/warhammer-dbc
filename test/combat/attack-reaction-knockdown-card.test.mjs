// test/combat/attack-reaction-knockdown-card.test.mjs
//
// Посох/Крюк (core.json, «Типы Рукопашного Оружия»): «При Избирательном
// попадании в Ногу [Посохом] персонаж может потратить Реакцию, чтобы
// провести против цели прием Повалить» / «На 3+ Успеха на попадание
// [Крюком]... персонаж может потратить Реакцию...». Здесь проверяется только
// проводка кнопки в карточку атаки (клик — module/hooks.mjs, не
// unit-тестируется отдельно — тот же уровень, что у .wh-legacy-regroup-btn,
// см. test/combat/attack-legacy-regroup-card.test.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Посох: кнопка «Реакция: Повалить» на Избирательное попадание в Ногу", () => {
  it("попадание, Избирательная атака в Ногу — кнопка есть", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Посох", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.a1";
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).toContain("wh-reaction-knockdown-btn");
    expect(card()).toContain('data-attacker-uuid="Actor.a1"');
    expect(card()).toContain("Посох: Избирательное попадание в Ногу");
  });

  it("попадание в Торс (не Избирательное в Ногу) — кнопки нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Посох", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("wh-reaction-knockdown-btn");
  });

  it("промах в Ногу — кнопки нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Посох", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [90];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).not.toContain("wh-reaction-knockdown-btn");
  });

  it("другая категория (Меч), Избирательная атака в Ногу — кнопки нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).not.toContain("wh-reaction-knockdown-btn");
  });
});

describe("Крюк: кнопка «Реакция: Повалить» на 3+ Успеха", () => {
  it("3 Успеха — кнопка есть", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Крюк", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.a1";
    captured.dice = [20, 5]; // порог 45, ролл 20 → 3 Успеха.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain("wh-reaction-knockdown-btn");
    expect(card()).toContain("Крюк: 3+ Успеха на попадание");
  });

  it("1 Успех — кнопки нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Крюк", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [40, 5]; // порог 45, ролл 40 → 1 Успех.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("wh-reaction-knockdown-btn");
  });
});
