// test/sheets/attack-dialog-stun-maneuver.test.mjs
//
// Приём Оглушить (стр. 14, wdbc-x1nz.2.66.3): раньше — только штраф −20 и
// текст-напоминалка. Теперь: (1) Избирательная атака в голову форсирована в
// окне атаки (select #atk-aim), (2) расчёт урона игнорирует свойство
// Primitive (проверяется через уже существующий data-primitive — Оглушить
// переиспользует его, wp.primitive перезаписан false), (3) конверсия
// непоглощённого урона в Оглушение — test/combat/stun-maneuver-damage.test.mjs
// (нужен полный конвейер applyDamageToActor, здесь — только доехавший флаг).

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

function stunManeuverAttr() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/data-stun-maneuver="(\d)"/);
  return m ? m[1] : null;
}

function primitiveAttr() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/data-primitive="(\d)"/);
  return m ? m[1] : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Приём Оглушить: окно форсирует Избирательную атаку в голову", () => {
  it("окно открыто сразу с предустановленным Приёмом «Оглушить» — select #atk-aim задизейблен, «Голова» выбрана", () => {
    const mace = weaponFor({ weaponClass: "melee" }, { name: "Булава" });
    showAttackDialog(attacker({ items: [mace] }), mace, { technique: "stun" });
    const html = captured.dialog.content;
    expect(html).toMatch(/<select id="atk-aim" class="av-input av-wide" disabled>/);
    expect(html).toMatch(/<option value="head"[^>]*selected>/);
  });

  it("Обычный Приём (без Оглушить) — select #atk-aim обычный, не задизейблен", () => {
    const mace = weaponFor({ weaponClass: "melee" }, { name: "Булава" });
    showAttackDialog(attacker({ items: [mace] }), mace);
    const html = captured.dialog.content;
    expect(html).toMatch(/<select id="atk-aim" class="av-input av-wide">/);
    expect(html).not.toMatch(/<select id="atk-aim"[^>]*disabled/);
  });
});

describe("Приём Оглушить: свойства в реальном броске", () => {
  it("Primitive-оружие Приёмом Оглушить — data-primitive=0 (проигнорировано), data-stun-maneuver=1", async () => {
    const mace = weaponFor({
      weaponClass: "melee", weaponProps: [{ key: "primitive" }]
    }, { name: "Дубина" });
    captured.dice = [1, 0];
    const p = showAttackDialog(attacker({ items: [mace] }), mace);
    await pressRoll(p, { "input[name='atk-maneuver']:checked": "stun", "#atk-aim": "head" });

    expect(stunManeuverAttr()).toBe("1");
    expect(primitiveAttr()).toBe("0");
  });

  it("то же Primitive-оружие Обычной Атакой — data-primitive=1 (как обычно), data-stun-maneuver=0", async () => {
    const mace = weaponFor({
      weaponClass: "melee", weaponProps: [{ key: "primitive" }]
    }, { name: "Дубина" });
    captured.dice = [1, 0];
    const p = showAttackDialog(attacker({ items: [mace] }), mace);
    await pressRoll(p, {});

    expect(stunManeuverAttr()).toBe("0");
    expect(primitiveAttr()).toBe("1");
  });
});

describe("Приём Оглушить: штраф −20 один раз (приёмка #516)", () => {
  function thresholdInCard() {
    const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
    return m ? Number(m[1]) : null;
  }
  async function thresholdFor(fields) {
    resetCaptured();
    const mace = weaponFor({ weaponClass: "melee" }, { name: "Булава" });
    captured.dice = [99, 0];
    const p = showAttackDialog(attacker({ items: [mace] }), mace);
    await pressRoll(p, { "#atk-char": "ws", ...fields });
    return thresholdInCard();
  }

  it("Оглушить (прицел в голову форсирован) = обычная атака −20, а не −40", async () => {
    const plain = await thresholdFor({});
    // В живом окне выбрана «Голова» с её data-penalty −20 — как её отдал бы select.
    const stun = await thresholdFor({ "input[name='atk-maneuver']:checked": "stun", "#atk-aim": "head",
      "#atk-aim option:checked": { dataset: { penalty: "-20" } } });
    expect(plain).not.toBeNull();
    expect(stun).toBe(plain - 20);
  });
});
