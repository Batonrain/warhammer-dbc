// test/combat/overpenetration.test.mjs
//
// Стр. 12, wdbc-x1nz.2.39: «Снаряд летит дальше» — успешное Уклонение от
// дистанционной атаки предлагает кнопку, которая катает урон ОРИГИНАЛЬНЫМ
// оружием как 1 попадание в случайную часть тела; вторую цель выбирает ГМ
// уже на карточке применения урона (.wh-apply-dmg-btn, hooks.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _performDodge } from "../../module/combat/defense.mjs";
import { rollOverpenetration } from "../../module/combat/overpenetration.mjs";

function attacker(overrides = {}) {
  const a = actorFor(overrides);
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return a;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10]; // Ag 35 (actorFor), untrained −20 → Порог 15, rv=10 — успех
  globalThis.game.combat = undefined;
});

describe("_performDodge: кнопка «Снаряд летит дальше» (wdbc-x1nz.2.39)", () => {
  it("успешное Уклонение от дистанционной атаки, известно оружие — кнопка есть", async () => {
    const actor = attacker();
    await _performDodge(actor, { extraMod: 0, hitsCount: 1, isMelee: false, itemUuid: "Item.bolter-1" });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-overpenetration-btn");
    expect(card).toContain('data-item-uuid="Item.bolter-1"');
  });

  it("рукопашная атака — кнопки нет, даже с itemUuid (Отскок=Вольт занимает эту роль)", async () => {
    const actor = attacker();
    await _performDodge(actor, { extraMod: 0, hitsCount: 1, isMelee: true, itemUuid: "Item.sword-1" });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-overpenetration-btn");
  });

  it("оружие неизвестно (itemUuid пуст) — кнопки нет", async () => {
    const actor = attacker();
    await _performDodge(actor, { extraMod: 0, hitsCount: 1, isMelee: false });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-overpenetration-btn");
  });

  it("Уклонение провалено — кнопки нет", async () => {
    captured.dice = [96];
    const actor = attacker();
    await _performDodge(actor, { extraMod: 0, hitsCount: 1, isMelee: false, itemUuid: "Item.bolter-1" });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-overpenetration-btn");
  });
});

describe("rollOverpenetration", () => {
  it("оружие не найдено — предупреждение, карточки нет", async () => {
    await rollOverpenetration(null);
    expect(captured.warnings.at(-1)).toContain("не найдено");
    expect(captured.chat).toHaveLength(0);
  });

  it("катает урон оригинальным оружием, постит карточку со случайным местом и кнопкой применения урона", async () => {
    const bolter = weaponFor({ damage: "1d10+5", damageType: "X", penetration: 4 }, { id: "w-1", name: "Болтер" });
    bolter.uuid = "Item.bolter-1";
    captured.dice = [30, 3]; // 1-й бросок — место попадания (реверс 30→03), 2-й — урон 1d10 (не Экстремальный)

    await rollOverpenetration(bolter);

    expect(captured.chat).toHaveLength(1);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Снаряд летит дальше: Болтер");
    expect(card).toContain("вторую цель выбирает ГМ");
    expect(card).toContain("wh-apply-dmg-btn");
    expect(card).toContain('data-weapon-uuid="Item.bolter-1"');
    expect(card).toContain('data-penetration="4"');
    expect(card).toContain('data-damage-type="X"');
    // Нет forceTarget/forceHorde в разметке — showApplyDamageDialog спросит цель у ГМа.
    expect(card).not.toContain("data-force-target");
  });
});
