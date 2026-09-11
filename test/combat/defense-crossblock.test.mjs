// test/combat/defense-crossblock.test.mjs
//
// Талант «Crossblock / Крестовой Блок» (стр. 62, wdbc-pb60): вооружённый двумя
// рукопашными оружиями с Балансом не ниже 0, персонаж суммирует бонусы на
// Парирование от свойств, Качества и модификаций ОБОИХ оружий, но, парируя
// обоими, не может использовать Counter Attack и Riposte.
//
// До этой работы Талант стоял в реестре возможностей с пустым читателем: бонус
// второго оружия не считался, и Контратака оставалась доступной.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry, parryProfile, COUNTER_ATTACK_CAPABILITY } from "../../module/combat/defense.mjs";
import { CAP_CROSSBLOCK } from "../../module/rules/dual-wield-talents.mjs";

const DEFAULT_SOURCES = getRuleSources();

/** Рукопашное оружие в руке: hands.mjs требует equipped и занятой руки. */
function melee({ balance = 0, props = [], id = "w1", name = "Клинок" } = {}) {
  const w = weaponFor(
    { weaponClass: "melee", meleeCategory: "Меч", balance, equipped: true, hands: 1, weaponProps: props },
    { id, name });
  w.type = "weapon";
  return w;
}

/** Защитное даёт +15 к Парированию — самый дешёвый способ получить ненулевой бонус. */
const defensive = () => [{ key: "defensive" }];

function hero(items, ...caps) {
  clearRuleSources();
  registerRuleSource("test", () => caps.map(c => ({
    id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
  })));
  const a = actorFor({ items });
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return a;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("Крестовой Блок: бонусы обоих оружий складываются", () => {
  it("Защитное во второй руке добавляет свои +15 к порогу", () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал", props: defensive() });
    const plain = parryProfile(hero([main, off]), 0);
    const cross = parryProfile(hero([main, off], CAP_CROSSBLOCK), 0);
    expect(cross.threshold - plain.threshold).toBe(15);
    expect(cross.crossblock.bonus).toBe(15);
  });

  it("второе оружие без парирующих свойств бонуса не даёт", () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал" });
    const cross = parryProfile(hero([main, off], CAP_CROSSBLOCK), 0);
    expect(cross.crossblock.bonus).toBe(0);
  });

  it("второе оружие с Балансом −1 не годится — Талант не срабатывает", () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал", balance: -1, props: defensive() });
    const cross = parryProfile(hero([main, off], CAP_CROSSBLOCK), 0);
    expect(cross.crossblock).toBeNull();
  });

  it("без Таланта второе оружие в порог не входит", () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал", props: defensive() });
    const p = parryProfile(hero([main, off]), 0);
    expect(p.crossblock).toBeNull();
  });
});

describe("Крестовой Блок: цена — нет Контратаки и Ответного Удара", () => {
  it("парируя обоими, Контратаку не предлагает даже с её Талантом", async () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал", props: defensive() });
    const actor = hero([main, off], CAP_CROSSBLOCK, COUNTER_ATTACK_CAPABILITY);
    captured.confirmAnswer = true;                 // «Обоими»
    await _performParry(actor, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование успешно");
    expect(card).not.toContain("wh-counter-attack-btn");
    expect(card).toContain("Контратака и Ответный Удар в этом Парировании недоступны");
  });

  // Книга говорит «ЕСЛИ он парирует обоими» — это выбор, и цена берётся за сам
  // выбор, а не за величину бонуса (wdbc-2hg). Пока бонус второго оружия
  // суммировался сам, боец с парой клинков терял Контратаку в каждом
  // Парировании и отказаться не мог.
  it("выбрал парировать одним — Контратака остаётся, бонуса второго нет", async () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал", props: defensive() });
    const actor = hero([main, off], CAP_CROSSBLOCK, COUNTER_ATTACK_CAPABILITY);
    captured.confirmAnswer = false;                // «Одним»
    await _performParry(actor, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-counter-attack-btn");
    expect(card).not.toContain("Крестовой Блок");
  });

  it("платить нечем (Таланта Контратаки нет) — вопроса нет, парируем обоими", async () => {
    const main = melee({ id: "w1" });
    const off  = melee({ id: "w2", name: "Кинжал", props: defensive() });
    const actor = hero([main, off], CAP_CROSSBLOCK);
    captured.dialog = null;
    captured.confirmAnswer = false;                // ответ не должен спрашиваться
    await _performParry(actor, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
    expect(captured.dialog, "лишний вопрос там, где выбора нет").toBe(null);
    expect(captured.chat.at(-1).content).toContain("Крестовой Блок");
  });
});
