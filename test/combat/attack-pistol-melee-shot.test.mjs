// test/combat/attack-pistol-melee-shot.test.mjs
//
// Стр. 40, wdbc-x1nz.2.57: «Пистолет... может использоваться для стрельбы в
// ближнем бою без каких-либо штрафов» — в т.ч. цель НЕ получает бонус
// Уклонения (Винтовка/Карабин дают +30/+10, module/combat/attack.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Пистолет в рукопашную: цель не получает бонус Уклонения (wdbc-x1nz.2.57)", () => {
  it("пистолет, opts.meleeShot=true — dodgeMod остаётся 0", async () => {
    const weapon = weaponFor({ weaponClass: "pistol" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { meleeShot: true });

    expect(card()).toMatch(/wh-dodge-btn"[^>]*data-extra-mod="0"/);
  });

  it("обычное стрелковое (basic, не carbine), opts.meleeShot=true — цель получает +30", async () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { meleeShot: true });

    expect(card()).toMatch(/wh-dodge-btn"[^>]*data-extra-mod="30"/);
  });
});
