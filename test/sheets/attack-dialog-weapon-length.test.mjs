// test/sheets/attack-dialog-weapon-length.test.mjs
//
// Длина Оружия, правило 2 (wdbc-x1nz.2.67, стр. 39): «При Натиске на
// противника, вооружённого оружием на 3 и более длиннее, тот получает +5 на
// тесты Избегания от этих атак.» Проверяется через настоящий бросок (форма →
// _executeAttackRoll → карточка), а не через selection.mjs напрямую — та же
// причина, что у test/combat/attack-carbine-dodge.test.mjs: интересен именно
// бонус, дошедший до кнопки Избегания в карточке, а не промежуточное число.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  return a;
}

function attackForm(fields = {}, checks = {}) {
  return fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
}

async function pressRoll(promise, fields = {}, checks = {}) {
  await captured.press("roll", attackForm(fields, checks));
  return promise;
}

function dodgeExtraMod() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Длина Оружия (стр. 39): бонус Избегания цели при Натиске оружием намного короче её", () => {
  it("Натиск Кастетом (Rng 0) на цель с Пикой (эфф. Rng 5) — разница 5, цель получает +5", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 0, grips: "Кл" }, { name: "Кастет" });
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 4, grips: "1р", equipped: true }, { name: "Пика" })]
    });
    setTargets([target]);
    captured.dice = [10, 5];
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(5);
  });

  it("Натиск оружием почти той же длины (разница 1) — бонуса нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 3, grips: "1р" }, { name: "Меч" });
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 3, grips: "1р", equipped: true }, { name: "Меч" })]
    });
    setTargets([target]);
    captured.dice = [10, 5];
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(0);
  });

  it("та же разница в длине, но База — Стандартная Атака (не Натиск) — бонуса нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 0, grips: "Кл" }, { name: "Кастет" });
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 4, grips: "1р", equipped: true }, { name: "Пика" })]
    });
    setTargets([target]);
    captured.dice = [10, 5];
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p, {});
    expect(dodgeExtraMod()).toBe(0);
  });

  // Приём Выпад (стр. 14, wdbc-x1nz.2.66.12): «+1 к Rng для этой атаки» —
  // реализован поверх meleeEffectiveRange, здесь проверяется, что этот +1
  // реально доезжает до правила 2 через живой пересчёт на сабмите формы
  // (не просто существует как число в отдельном юнит-тесте).
  it("Приём Выпад (+1 Rng атакующему) сокращает разницу — бонус, который был бы без Выпада, пропадает", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 0, grips: "Кл" }, { name: "Кастет" }); // Кл: rngSet 0
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 2, grips: "1р", equipped: true }, { name: "Копьё" })] // 2+1=3
    });
    setTargets([target]);
    captured.dice = [10, 5];

    // Без Выпада: атакующий 0, цель 3, разница 3 — бонус есть.
    const p1 = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p1, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(5);

    // С Выпадом: атакующий 0+1=1, цель 3, разница 2 — бонус правила 2 (+5)
    // пропадает; остаётся только собственный бонус Приёма Выпад — «Уклонение
    // от этой атаки +10» (MELEE_MANEUVERS.thrust.targetDodgeMod), независимый
    // от Длины Оружия. Итог 10, а не 15 (10 Выпада + 5 правила 2) и не 0 —
    // доказывает, что именно чувствительная к Выпаду часть (правило 2)
    // реально пересчиталась на сабмите, а не осталась зависшей от старого
    // выбора Приёма.
    resetCaptured();
    setTargets([target]);
    captured.dice = [10, 5];
    const p2 = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p2, {
      "input[name='atk-base']:checked": "charge",
      "input[name='atk-maneuver']:checked": "thrust"
    });
    expect(dodgeExtraMod()).toBe(10);
  });

  it("нет цели (не наведён targets) — бонуса нет, диалог не падает", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 0, grips: "Кл" }, { name: "Кастет" });
    captured.dice = [10, 5];
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(0);
  });
});
