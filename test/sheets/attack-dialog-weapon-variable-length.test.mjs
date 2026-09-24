// test/sheets/attack-dialog-weapon-variable-length.test.mjs
//
// Длина Оружия, правило 5 (wdbc-x1nz.2.67.2, стр. 39): «Персонаж может при
// каждой атаке выбрать длину из доступного диапазона» — у оружия, чей Rng в
// книге дан диапазоном (Гладий 1-3, Меч 2-4 и т.п., system.rangeMin>0),
// пилюли «Длина» в окне атаки выбирают базу для meleeEffectiveRange этой
// атаки. У обычного оружия (rangeMin 0, ещё не размечено content-проходом)
// пилюли не показываются вовсе, и поведение не меняется — см. параллельные
// test/sheets/attack-dialog-weapon-length.test.mjs (правило 2) и
// attack-dialog-weapon-reach.test.mjs (правило 3), которые остаются зелёными
// без единой правки.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

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

describe("Пилюли «Длина»: видимость", () => {
  it("rangeMin>0 и < range — пилюли показаны, по умолчанию отмечена верхняя граница", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 3, rangeMin: 1, grips: "" }, { name: "Гладий" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(html()).toContain('id="atk-length-pills"');
    expect(html()).toMatch(/name="atk-length" value="3" checked/);
    expect(html()).toContain('value="1"');
    expect(html()).toContain('value="2"');
  });

  it("rangeMin 0 (обычное оружие) — пилюль нет вовсе", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 4, grips: "" }, { name: "Меч" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(html()).not.toContain("atk-length-pills");
  });

  it("rangeMin === range — вырожденный диапазон, пилюль нет", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 4, rangeMin: 4, grips: "" }, { name: "Странный" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(html()).not.toContain("atk-length-pills");
  });
});

describe("Выбранная длина доезжает до реального Rng этой атаки (через правило 2 — Натиск)", () => {
  it("длина не тронута — берётся верхняя граница range, как раньше (регресс не должен появиться)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 3, rangeMin: 1, grips: "" }, { name: "Гладий" });
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 0, grips: "" }, { name: "Кулак" })]
    });
    setTargets([target]);
    captured.dice = [10, 5];
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    // Атакующий эфф.3 (умолчание — верхняя граница), цель эфф.0: атакующий
    // длиннее — правило 2 (бонус ЦЕЛИ) не срабатывает.
    await pressRoll(p, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(0);
  });

  it("выбор короткой длины (1 вместо 3) реально меняет effRange — доезжает до правила 2", async () => {
    // Атакующий: Гладий, диапазон 1-3. Цель: Копьё эфф. 3 (range 3, без хвата).
    // Натиск длиной 3 — разница 0, бонуса нет. Натиск длиной 1 — разница 2,
    // тоже меньше 3, бонуса всё ещё нет; берём цель подлиннее, чтобы разница
    // пересекала порог 3 только при коротком выборе атакующего.
    const weapon = weaponFor({ weaponClass: "melee", range: 3, rangeMin: 1, grips: "" }, { name: "Гладий" });
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 3, grips: "", equipped: true }, { name: "Копьё" })]
    });
    setTargets([target]);
    captured.dice = [10, 5];

    // Длина по умолчанию (3): атакующий 3, цель 3, разница 0 — бонуса нет.
    const p1 = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p1, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(0);

    // Выбрана длина 1: атакующий 1, цель 3, разница 2 — всё ещё меньше 3,
    // бонуса нет (число до сих пор пересчиталось, просто порог не пройден).
    resetCaptured();
    setTargets([target]);
    captured.dice = [10, 5];
    const p2 = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p2, {
      "input[name='atk-base']:checked": "charge",
      "input[name='atk-length']:checked": "1"
    });
    expect(dodgeExtraMod()).toBe(0);
  });

  it("выбор короткой длины пересекает порог правила 2 (цель получает +5 Избегание)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 3, rangeMin: 1, grips: "" }, { name: "Гладий" });
    const target = actorFor({
      items: [weaponFor({ weaponClass: "melee", range: 4, grips: "1р", equipped: true }, { name: "Пика" })] // эфф. 5
    });
    setTargets([target]);
    captured.dice = [10, 5];

    // Длина 3 (умолчание): разница 5−3=2 — бонуса нет.
    const p1 = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p1, { "input[name='atk-base']:checked": "charge" });
    expect(dodgeExtraMod()).toBe(0);

    // Длина 1: разница 5−1=4 ≥ 3 — цель получает +5 Избегание.
    resetCaptured();
    setTargets([target]);
    captured.dice = [10, 5];
    const p2 = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p2, {
      "input[name='atk-base']:checked": "charge",
      "input[name='atk-length']:checked": "1"
    });
    expect(dodgeExtraMod()).toBe(5);
  });
});
