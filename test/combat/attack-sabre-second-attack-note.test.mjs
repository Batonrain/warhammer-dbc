// test/combat/attack-sabre-second-attack-note.test.mjs
//
// Сабля (core.json, «Типы Рукопашного Оружия»): «может проигнорировать бонус
// +20, чтобы совершить две атаки вместо одной, но по разным целям на пути» —
// +20 уже отменён галочкой диалога (opts.sabreSecondAttack); здесь проверяется
// только напоминание в карточке (второй бросок система не автоматизирует).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Сабля: напоминание о второй атаке в карточке", () => {
  it("opts.sabreSecondAttack — карточка напоминает про вторую атаку", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 3];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { sabreSecondAttack: true });

    expect(card()).toContain("Сабля: +20 Верховой Атаки проигнорирован");
    expect(card()).toContain("вторая атака этим оружием");
  });

  it("без opts.sabreSecondAttack — напоминания нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 3];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("Верховой Атаки проигнорирован");
  });
});
