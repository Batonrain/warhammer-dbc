// test/combat/attack-dark-apostle.test.mjs
//
// Литания Хаоса Тёмного Апостола (Sahara 1-54b9), та часть, что живёт в combat/attack.mjs и Трудном Ландшафте:
// Неделимый — Extreme (9) на все атаки подчинённого; Нургл — автоуспех теста Трудного Ландшафта. Метка действует
// только в своём бою. Слаанеш (+30 на Командование) проверяется через resolveTest в test/rules/dark-apostle.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { showDifficultTerrainDialog } from "../../module/combat/movement-terrain.mjs";

const NS = "warhammer-dbc";

const axe = () => weaponFor({
  weaponClass: "melee", meleeCategory: "Топор", grips: "П", damage: "1d10", damageType: "rending", penetration: 1
});

function fighter(flags = {}) {
  const store = { ...flags };
  const actor = actorFor({
    items: [axe()], corruptionBonus: 0, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) }
  });
  actor.getFlag = (scope, key) => (scope === NS ? store[key] : undefined);
  actor.setFlag = async () => {};
  actor.unsetFlag = async () => {};
  return actor;
}

async function swingWithDamageDie(flags, die = 9) {
  resetCaptured();
  const actor = fighter(flags);
  const weapon = [...actor.items][0];
  captured.dice = [20, die, 5, 5, 5];
  await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "standard" });
  return captured.rolls.filter(r => r === "1d5").length;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.game.combat = { id: "c1", started: true, round: 1 };
  globalThis.game.combats = [globalThis.game.combat];
});

describe("Литания Неделимого: Extreme (9) на все атаки подчинённого", () => {
  it("9 на кубике урона — Экстремальный Урон (бросок 1d5 на Критический Эффект)", async () => {
    expect(await swingWithDamageDie({ litanyBlessing: { god: "undivided", combatId: "c1" } }, 9)).toBe(1);
  });

  it("без литании 9 — обычный урон, Экстремального нет", async () => {
    expect(await swingWithDamageDie({}, 9)).toBe(0);
  });

  it("литания другого Бога или метка прошлого боя Extreme не дают", async () => {
    expect(await swingWithDamageDie({ litanyBlessing: { god: "khorne", combatId: "c1" } }, 9)).toBe(0);
    expect(await swingWithDamageDie({ litanyBlessing: { god: "undivided", combatId: "c0" } }, 9)).toBe(0);
  });

  it("8 порога не достигает даже под литанией", async () => {
    expect(await swingWithDamageDie({ litanyBlessing: { god: "undivided", combatId: "c1" } }, 8)).toBe(0);
  });
});

describe("Литания Нургла: автоуспех Трудного Ландшафта", () => {
  const rollTerrain = async (flags, die) => {
    resetCaptured();
    const actor = {
      name: "Боец", items: [], system: { characteristics: { ag: { total: 35 } } },
      getFlag: (scope, key) => (scope === NS ? flags[key] : undefined), getActiveTokens: () => []
    };
    await showDifficultTerrainDialog(actor, { regions: null });
    captured.dice = [die];
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#tr-ag": 35, "#tr-mod": "0" }));
    return captured.chat.at(-1)?.content ?? "";
  };

  it("с литанией Нургла провальный бросок не нужен: карточка — автоуспех, кубик не брошен", async () => {
    const card = await rollTerrain({ litanyBlessing: { god: "nurgle", combatId: "c1" } }, 99);
    expect(card).toContain("Литания Нургла");
    expect(card).toContain("Автоуспех");
    expect(captured.dice).toEqual([99]);
  });

  it("без литании тот же бросок 99 — Провал, персонаж падает", async () => {
    const card = await rollTerrain({}, 99);
    expect(card).toContain("Персонаж падает");
    expect(card).not.toContain("Литания Нургла");
  });

  it("литания другого Бога или прошлого боя автоуспеха не даёт", async () => {
    expect(await rollTerrain({ litanyBlessing: { god: "khorne", combatId: "c1" } }, 99)).toContain("Персонаж падает");
    expect(await rollTerrain({ litanyBlessing: { god: "nurgle", combatId: "c0" } }, 99)).toContain("Персонаж падает");
  });
});
