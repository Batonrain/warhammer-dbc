// test/sheets/attack-dialog-sabre-second-attack.test.mjs
//
// Сабля (core.json, «Типы Рукопашного Оружия»): «при совершении Верховой
// Атаки может проигнорировать бонус +20, чтобы совершить две атаки вместо
// одной, но по разным целям на пути» — галочка отменяет +20 Базы «Верховая
// Атака», второй независимый бросок системой не автоматизирован (честный
// предел, тот же, что у «Вторичных целей Очереди»).

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

describe("Сабля: галочка «вторая атака вместо +20» — видимость", () => {
  it("Сабля верхом — галочка есть", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } }), weapon);
    expect(captured.dialog.content).toContain("atk-sabre-second-attack");
  });

  it("Сабля не верхом — галочки нет", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).not.toContain("atk-sabre-second-attack");
  });

  it("Рапира верхом — галочки нет (только у Сабли)", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    showAttackDialog(attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } }), weapon);
    expect(captured.dialog.content).not.toContain("atk-sabre-second-attack");
  });
});

describe("Сабля: эффект (отменяет +20 Верховой Атаки)", () => {
  it("Верховая Атака + галочка — +20 не применяется", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "mounted" },
      "#atk-sabre-second-attack": true
    }));
    await p;

    // Сравнение — с той же посадкой на скакуна БЕЗ галочки (второй тест
    // ниже, 65): разница ровно 20 — галочка отменяет ровно бонус Базы
    // «Верховая Атака» (sel.baseBon), не больше и не меньше, независимо от
    // прочих модификаторов верховой посадки (те этой галочкой не тронуты).
    expect(thresholdInCard()).toBe(45);
  });

  it("Верховая Атака БЕЗ галочки — обычный +20 применяется", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "mounted" }
    }));
    await p;

    expect(thresholdInCard()).toBe(65);
  });

  it("галочка отмечена, но База НЕ Верховая Атака — ничего не меняет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "standard" },
      "#atk-sabre-second-attack": true
    }));
    await p;

    // База «Стандартная» верхом не тянет за собой доп. модификаторов
    // посадки (те завязаны на саму Базу «Верховая Атака») — обычный
    // WS45+10 baseline, галочка Сабли не гейтится (f.baseKey !== "mounted").
    expect(thresholdInCard()).toBe(55);
  });
});
