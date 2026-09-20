// test/combat/attack-grenade-fumble.test.mjs
//
// Стр. 40, wdbc-x1nz.2.59: «При Критическом Промахе, граната падает
// персонажу под ноги и взрывается.» Критический диапазон — натуральные
// 96-100 (module/rules/roll-outcome.mjs::criticalOutcome).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Граната: Критический Промах роняет её под ноги и взрывает (wdbc-x1nz.2.59)", () => {
  it("натуральный 96-100 — граната взрывается у стрелка, не обычный промах по цели", async () => {
    const weapon = weaponFor({
      weaponType: "grenade", weaponClass: "thrown", damage: "2d10", rof_single: 1
    }, { id: "w1" });
    weapon.delete = async () => { weapon.deleted = true; };
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [99, 5, 5]; // rv=99 — крит-провал; 2d10 урона на детонацию

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Критический Промах: граната падает под ноги");
    expect(card()).toContain("упала под ноги атакующему и взорвалась");
    expect(card()).toContain("wh-apply-dmg-btn");
  });

  it("обычный промах (не крит) — граната НЕ взрывается сама, это просто промах", async () => {
    const weapon = weaponFor({
      weaponType: "grenade", weaponClass: "thrown", damage: "2d10", rof_single: 1
    }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [70]; // промах по Порогу 45, но не крит-диапазон (96-100)

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("падает под ноги");
    expect(card()).toContain("Промах");
  });

  it("обычное стрелковое оружие (не граната), тот же крит-провал — обычная карточка промаха", async () => {
    // Reliable (стр. 41, wdbc-x1nz.2.61): без него обычное стрелковое клинит
    // уже на 96+ — здесь же нужен именно обычный крит-провал, не Клин.
    const weapon = weaponFor({
      weaponClass: "basic", damage: "1d10", rof_single: 1,
      weaponProps: [{ key: "reliable" }]
    }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [99];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("падает под ноги");
    expect(card()).toContain("Критический Провал");
  });
});
