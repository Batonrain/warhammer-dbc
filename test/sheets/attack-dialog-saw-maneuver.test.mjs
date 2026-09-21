// test/sheets/attack-dialog-saw-maneuver.test.mjs
//
// Приём Пила (стр. 14, wdbc-x1nz.2.66.2): раньше — только штраф −10 и текст в
// чате. Теперь: (1) доступен только оружию со свойством Tearing/Power Field,
// (2) S.b в уроне режется вдвое (окр.▲) — тот же слот, что у Обратного Хвата,
// (3) Rng этой атаки падает до 0 (уже покрыто test/rules/weapon-length.test.mjs
// через meleeEffectiveRange), (4) игнорирует силовые щиты-купола (проверяется
// через data-ignore-dome-shield кнопки «Применить урон»).

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

function ignoreDomeShieldAttr() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/data-ignore-dome-shield="(\d)"/);
  return m ? m[1] : null;
}

const damageFormula = () => captured.rolls[1];

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Приём Пила: доступность требует Tearing/Power Field (стр. 14)", () => {
  it("без Tearing/Power Field — пилюли Пилы нет в списке вовсе (недоступна и не текущий выбор)", () => {
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [] }, { name: "Меч" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-maneuver" value="saw"/);
  });

  it("со свойством Tearing — пилюля Пилы доступна", () => {
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "tearing" }] }, { name: "Цепной меч" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-maneuver" value="saw"/);
    expect(html).not.toMatch(/name="atk-maneuver" value="saw"[^>]*disabled/);
  });

  it("со свойством Power Field — пилюля Пилы тоже доступна", () => {
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "powerField" }] }, { name: "Силовой меч" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-maneuver" value="saw"[^>]*disabled/);
  });
});

describe("Приём Пила: эффекты в реальном броске", () => {
  it("S.b в уроне режется вдвое (окр.▲) — тот же слот, что у Обратного Хвата", async () => {
    const sword = weaponFor({
      weaponClass: "melee", weaponProps: [{ key: "tearing" }], damage: "1d10+2"
    }, { name: "Цепной меч" });
    const actorAttacker = attacker({ items: [sword] }); // S.b 4 (s=40)
    // Tearing уже само по себе превращает "1d10" в "2d10kh1" (+1 куб, оставить
    // старший) — второй d10 в очереди нужен ЕМУ, не Пиле; здесь проверяется
    // именно флэт-бонус S.b на конце формулы.
    captured.dice = [1, 0, 6, 3];
    const p = showAttackDialog(actorAttacker, sword);
    await pressRoll(p, { "input[name='atk-maneuver']:checked": "saw" });

    expect(damageFormula()).toBe("2d10kh1+2 + 2"); // ⌈4/2⌉ = 2
    expect((captured.chat.at(-1)?.content ?? "")).toContain("½ хват");
  });

  it("галочка «Применить урон» несёт data-ignore-dome-shield=1 при выбранной Пиле", async () => {
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "tearing" }] }, { name: "Цепной меч" });
    captured.dice = [1, 0, 6, 3];
    const p = showAttackDialog(attacker({ items: [sword] }), sword);
    await pressRoll(p, { "input[name='atk-maneuver']:checked": "saw" });

    expect(ignoreDomeShieldAttr()).toBe("1");
  });

  it("Обычная Атака той же связкой — data-ignore-dome-shield=0, урон не режется", async () => {
    const sword = weaponFor({
      weaponClass: "melee", weaponProps: [{ key: "tearing" }], damage: "1d10+2"
    }, { name: "Цепной меч" });
    captured.dice = [1, 0, 6, 3];
    const p = showAttackDialog(attacker({ items: [sword] }), sword);
    await pressRoll(p, {});

    expect(ignoreDomeShieldAttr()).toBe("0");
    expect(damageFormula()).toBe("2d10kh1+2 + 4"); // S.b 4 целиком
  });
});
