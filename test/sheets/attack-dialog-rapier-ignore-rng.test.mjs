// test/sheets/attack-dialog-rapier-ignore-rng.test.mjs
//
// Рапира (core.json, «Типы Рукопашного Оружия»): «при проведении Выпада
// может проигнорировать +1 к Rng, чтобы уменьшить штраф на Избирательные
// атаки на 10» — галочка видна только Рапире, эффект живёт, только пока
// реально выбран Выпад, отмечена галочка и есть сам штраф (Избирательная
// атака), который уменьшать.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attackForm(fields = {}, checks = {}) {
  return fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
}

function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  return a;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Рапира: галочка «игнорировать +1 Rng Выпада» — видимость", () => {
  it("Рапира — галочка есть", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).toContain("atk-rapier-ignore-rng");
  });

  it("Сабля — галочки нет (только у Рапиры)", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).not.toContain("atk-rapier-ignore-rng");
  });

  it("обычный Меч без подтипа — галочки нет", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).not.toContain("atk-rapier-ignore-rng");
  });
});

describe("Рапира: эффект (−10 к штрафу Избирательной атаки, только Выпад)", () => {
  it("Выпад + Избирательная в Ногу + галочка — штраф уменьшен на 10", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    const actor = attacker({ items: [weapon] });
    const p = showAttackDialog(actor, weapon, { technique: "thrust" });
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "#atk-aim": "leg",
      "#atk-aim option:checked": { dataset: { penalty: "-15" } },
      "input[name='atk-maneuver']:checked": { value: "thrust" },
      "#atk-rapier-ignore-rng": true
    }));
    await p;

    // WS 45 + База 10 − Избирательная(−15) + Рапира(+10) = 50.
    expect(thresholdInCard()).toBe(50);
  });

  it("Выпад + Избирательная в Ногу, БЕЗ галочки — обычный штраф −15, без компенсации", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    const actor = attacker({ items: [weapon] });
    const p = showAttackDialog(actor, weapon, { technique: "thrust" });
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "#atk-aim": "leg",
      "#atk-aim option:checked": { dataset: { penalty: "-15" } },
      "input[name='atk-maneuver']:checked": { value: "thrust" }
    }));
    await p;

    expect(thresholdInCard()).toBe(40);
  });

  it("галочка отмечена, но НЕ Избирательная атака — бонуса нет (нечего уменьшать)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    const actor = attacker({ items: [weapon] });
    const p = showAttackDialog(actor, weapon, { technique: "thrust" });
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-maneuver']:checked": { value: "thrust" },
      "#atk-rapier-ignore-rng": true
    }));
    await p;

    expect(thresholdInCard()).toBe(55); // WS 45 + База 10, без штрафа и без бонуса
  });

  it("галочка + Избирательная, но выбрана Обычная Атака (не Выпад) — бонуса нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    const actor = attacker({ items: [weapon] });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "#atk-aim": "leg",
      "#atk-aim option:checked": { dataset: { penalty: "-15" } },
      "input[name='atk-maneuver']:checked": { value: "standard" },
      "#atk-rapier-ignore-rng": true
    }));
    await p;

    // WS 45 + База 10 − Избирательная 15 = 40, без бонуса Рапиры (не Выпад).
    expect(thresholdInCard()).toBe(40);
  });
});
