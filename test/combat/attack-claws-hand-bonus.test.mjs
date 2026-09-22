// test/combat/attack-claws-hand-bonus.test.mjs
//
// Когти.Р (core.json, «Типы Рукопашного Оружия»): «получают +1 Dmg за каждый
// нечетный Успех на попадание, кроме первого (3, 5, 7, и т.д.)» — хват «Л»
// (и составной «П+Л»), но не «П» (Когти.П, ладонь свободна, бонуса не даёт).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

// S.b 0 — чистая арифметика урона (база + бонус Когтей.Р, без слагаемого Силы).
function meleeActor(items) {
  return actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Когти.Р (хват «Л»): +1 Dmg за каждый нечётный Успех, кроме первого", () => {
  it("1 Успех — бонуса ещё нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Когти", grips: "Л", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [40, 5]; // порог 45, ролл 40 → 1 Успех.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="5"');
  });

  it("3 Успеха — +1 Dmg", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Когти", grips: "Л", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [20, 5]; // порог 45, ролл 20 → 3 Успеха.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="6"'); // 5 + 1
  });

  it("5 Успехов — +2 Dmg", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Когти", grips: "Л", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [1, 5]; // порог 45, ролл 1 → 5 Успехов.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="7"'); // 5 + 2
  });

  it("составной хват «П+Л» — тот же бонус, что «Л»", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Когти", grips: "П+Л", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [20, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="6"');
  });

  it("хват «П» (Когти.П, ладонь свободна) — бонуса нет даже на 5 Успехах", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Когти", grips: "П", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [1, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="5"');
  });

  it("другая категория оружия (Меч) с хватом «Л» — бонуса нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "Л", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    captured.dice = [1, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="5"');
  });
});
