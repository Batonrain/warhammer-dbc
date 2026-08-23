// test/combat/defense.test.mjs
//
// Контратака (стр. 12, Талант Counter Attack): успешное Парирование
// предлагает кнопку тут же ударить в ответ тем же оружием — только с
// Талантом (capability technique.counterAttack) и не чаще раза в Раунд.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry, COUNTER_ATTACK_CAPABILITY } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();

/** weaponFor() не ставит type/equipped — actor.items.find(i=>i.type==="weapon"
 *  && i.system.equipped) их и требует (тот же приём, что в sheet-listeners.test.mjs). */
function equippedMelee(overrides = {}, meta = {}) {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, ...overrides }, meta);
  w.type = "weapon";
  return w;
}

/** Актор с getFlag/setFlag — «раз-в-Раунд» метка хранится флагом на акторе. */
function attacker(overrides = {}) {
  const a = actorFor(overrides);
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return a;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];               // WS 45 по умолчанию у actorFor() — гарантированный успех
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

function grantCounterAttack() {
  registerRuleSource("test", () => [{ id: "a", label: "Тест",
    effects: [{ kind: "grantFlag", target: COUNTER_ATTACK_CAPABILITY }] }]);
}

describe("_performParry: кнопка Контратаки", () => {
  it("без Таланта — кнопки нет, даже при удачном Парировании", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, null, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование успешно");
    expect(card).not.toContain("wh-counter-attack-btn");
  });

  it("с Талантом — кнопка есть, несёт id оружия и uuid атаковавшего", async () => {
    grantCounterAttack();
    const sword = equippedMelee({}, { id: "w-parry" });
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, null, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-counter-attack-btn");
    expect(card).toContain('data-weapon-id="w-parry"');
    expect(card).toContain('data-attacker-uuid="Actor.attacker-1"');
  });

  it("без оружия (нет мелейного на акторе) — кнопки нет, даже с Талантом", async () => {
    grantCounterAttack();
    const actor = attacker({ items: [] });

    await _performParry(actor, 0, null, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).not.toContain("wh-counter-attack-btn");
  });

  it("Парирование провалено — кнопки нет", async () => {
    grantCounterAttack();
    captured.dice = [96];
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, null, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование провалено");
    expect(card).not.toContain("wh-counter-attack-btn");
  });

  // isRoundCapabilityAvailable сама читает флаг «раз-в-Раунд» — здесь
  // достаточно убедиться, что _performParry её спрашивает: без активного
  // Combat возможность всегда доступна (раунд отследить нечем), а если
  // потрачена в ТЕКУЩЕМ раунде — кнопка пропадает.
  it("уже потрачена в этом Раунде (game.combat активен) — кнопки нет", async () => {
    grantCounterAttack();
    globalThis.game.combat = { round: 2 };
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });
    await actor.setFlag("warhammer-dbc",
      `usageLimits.${COUNTER_ATTACK_CAPABILITY.replace(/\./g, "-")}`, { scope: "round", used: true, round: 2 });

    await _performParry(actor, 0, null, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).not.toContain("wh-counter-attack-btn");
  });

  it("без активного Combat — доступна всегда (раунд отследить нечем)", async () => {
    grantCounterAttack();
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });
    await actor.setFlag("warhammer-dbc",
      `usageLimits.${COUNTER_ATTACK_CAPABILITY.replace(/\./g, "-")}`, { scope: "round", used: true, round: 2 });

    await _performParry(actor, 0, null, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).toContain("wh-counter-attack-btn");
  });
});
