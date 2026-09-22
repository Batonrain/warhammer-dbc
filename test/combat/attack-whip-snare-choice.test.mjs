// test/combat/attack-whip-snare-choice.test.mjs
//
// Кнут (core.json, «Типы Рукопашного Оружия»): «При попадании в конечность
// кнутом персонаж может выбрать дать ему свойство Snare (–2). Если он
// успешно связывает им цель, кнут наматывается на нее и не может быть
// использован.» «Может выбрать» — кнопка применения эффекта к цели
// (buildTargetEffectButtons), решение — клик по ней, не автоматика.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Кнут: Snare(-2) — кнопка «применить» при попадании в конечность", () => {
  it("попадание в Ногу (Избирательная атака) — кнопка Силок появляется, рейтинг -2", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кнут", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5]; // попадание; урон.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).toContain('data-wp-key="snare"');
    expect(card()).toContain('data-wp-rating="-2"');
    expect(card()).toContain('data-wp-test-mod="20"'); // -2 × -10
    expect(card()).toContain("wh-wprop-apply-btn");
  });

  it("попадание в Торс (не конечность) — кнопки Силок нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кнут", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "torso", label: "Торс" }, {});

    expect(card()).not.toContain('data-wp-key="snare"');
  });

  it("промах в Ногу — кнопки нет (нет попадания)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кнут", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [90];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).not.toContain('data-wp-key="snare"');
  });

  it("другая категория (Меч) с попаданием в Ногу — кнопки Силок нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", damage: "1d10" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).not.toContain('data-wp-key="snare"');
  });

  it("оружие уже несёт собственный Snare — не задваивается вторым", async () => {
    const weapon = weaponFor({
      weaponClass: "melee", meleeCategory: "Кнут", damage: "1d10",
      weaponProps: [{ key: "snare", rating: 5 }]
    });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", { value: "leg", label: "Нога" }, {});

    expect(card()).toContain('data-wp-rating="5"');
    expect(card()).not.toContain('data-wp-rating="-2"');
  });
});
