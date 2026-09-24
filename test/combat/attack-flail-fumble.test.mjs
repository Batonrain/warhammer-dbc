// test/combat/attack-flail-fumble.test.mjs
//
// Кистень/Кнут (core.json, «Типы Рукопашного Оружия»): «При Критическом
// Промахе наносит попадание по себе в случайную часть тела.» Кнут
// дополнительно: «...но при этом не получает бонус к урону от S.b, и
// попадание получает свойство Snare (0)». Критический диапазон — натуральные
// 96-100 (module/rules/roll-outcome.mjs::criticalOutcome, тот же, что у
// Критического Промаха гранаты — test/combat/attack-grenade-fumble.test.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

// S.b 4 (Сила 40) — чтобы отличить «получил бонус Силы» (Кистень) от «не
// получил» (Кнут) по итоговому числу урона.
function meleeActor(items) {
  return actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Кистень: Критический Промах — попадание по себе, с бонусом Силы", () => {
  it("натуральный 96-100 — бьёт себя в случайную часть тела, урон включает S.b", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кистень", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [99, 50, 5]; // 99 — крит-провал; 50 → локация «Голова»; 5 — база урона.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain("Критический Промах: Болтер бьёт по себе");
    expect(card()).toContain("Место попадания: <b>Голова</b>");
    expect(card()).toContain('data-damage="9"'); // 5 + S.b 4
    expect(card()).toContain('data-hit-location="Голова"');
    expect(card()).not.toContain("Без бонуса Силы");
  });

  it("обычный промах (не крит) — самопопадания нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кистень", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [70];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("бьёт по себе");
  });
});

describe("Кнут: Критический Промах — попадание по себе, БЕЗ бонуса Силы, Snare(0)", () => {
  it("натуральный 96-100 — урон без S.b, карточка упоминает Snare(0)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кнут", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [99, 50, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="5"'); // 5, без S.b 4
    expect(card()).toContain("Без бонуса Силы");
    expect(card()).toContain("Snare (0)");
  });
});

describe("Другая категория (Меч) — крит-провал не бьёт по себе", () => {
  it("Меч на крит-провале — обычная карточка Критического Провала", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [99];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("бьёт по себе");
    expect(card()).toContain("Критический Провал");
  });
});
