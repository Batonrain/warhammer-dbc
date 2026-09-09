// test/combat/attack-gun-guard-dodge.test.mjs
//
// Талант «Gun Guard / Винтовочная Гарда» (стр. 62, wdbc-pb60): вооружённый
// рукопашным оружием с Балансом не ниже −1 и винтовкой, персонаж стреляет из
// неё в рукопашной, НЕ давая цели обычного бонуса на Уклонение.
//
// Проверяется не сама функция правила (это test/rules/dual-wield-talents.test.mjs),
// а то, что она доехала до карточки: до этой работы Талант стоял в реестре
// возможностей с пустым читателем, и цель получала +30 в любом случае.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { CAP_GUN_GUARD } from "../../module/rules/dual-wield-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
function dodgeExtraMod() {
  const m = card().match(/wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

const savedSources = getRuleSources();
beforeEach(() => {
  resetCaptured();
  setTargets([]);
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of savedSources) registerRuleSource(key, fn);
});

/** Выдать актору Талант ветки — тем же способом, что рабочий источник правил. */
function grant(...caps) {
  clearRuleSources();
  registerRuleSource("test", () => caps.map(c => ({
    id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
  })));
}

/** Рукопашное оружие в руке. hands.mjs считает рукой всё equipped с hands ≥ 1. */
const blade = (balance) => weaponFor(
  { weaponClass: "melee", meleeCategory: "Меч", balance, equipped: true, hands: 1 },
  { id: "blade-1", name: "Клинок" });

describe("Винтовочная Гарда: выстрел в рукопашной не даёт цели бонуса", () => {
  it("клинок Баланса 0 в руке — бонус цели снят полностью", async () => {
    grant(CAP_GUN_GUARD);
    const rifle = weaponFor({ equipped: true, hands: 1 });
    const actor = actorFor({ items: [rifle, blade(0)] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, rifle, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(0);
  });

  it("Карабин с Талантом — тоже ноль, а не +10", async () => {
    grant(CAP_GUN_GUARD);
    const carbine = weaponFor({ equipped: true, hands: 1, weaponProps: [{ key: "carbine" }] });
    const actor = actorFor({ items: [carbine, blade(-1)] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, carbine, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(0);
  });

  it("клинок Баланса −2 — Талант не срабатывает, цель получает свои +30", async () => {
    grant(CAP_GUN_GUARD);
    const rifle = weaponFor({ equipped: true, hands: 1 });
    const actor = actorFor({ items: [rifle, blade(-2)] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, rifle, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(30);
  });

  it("без Таланта клинок в руке ничего не меняет", async () => {
    grant();
    const rifle = weaponFor({ equipped: true, hands: 1 });
    const actor = actorFor({ items: [rifle, blade(0)] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, rifle, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(30);
  });
});
