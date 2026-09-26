// test/rules/char-recovery-mechanics.test.mjs
//
// Запись Конструктора «Восстановление урона в Характеристики» (kind:
// "charRecovery", wdbc-x1nz.2.83) — живой запрос: rules/item-rules.mjs
// собирает из неё правило { kind:"charRecovery", target, mode, hours },
// которое читает rules/char-loss.mjs::actorRecoveryPolicy() на каждом
// часовом шаге восстановления. Здесь — что запись действительно доезжает до
// готовой политики, а не только до формы правила (это уже покрыто
// item-rules.test.mjs для других видов).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { actorRecoveryPolicy } from "../../module/rules/char-loss.mjs";

const SYSTEM = "warhammer-dbc";

function trait(name, entries) {
  const flags = { [SYSTEM]: { mechanics: [{ id: "g", operator: "AND", entries }] } };
  return { id: name, name, type: "trait", system: {}, flags, getFlag: (s, k) => flags[s]?.[k] };
}

const actorWith = (...items) => ({ system: { characteristics: {} }, items });

describe("charRecovery: запись Конструктора → правило", () => {
  it("«Не восстанавливается» даёт эффект block на выбранные Характеристики", () => {
    const entry = { id: "e1", kind: "charRecovery", crTargets: ["t"], crMode: "block", label: "" };
    const rules = rulesFromItemMechanics([trait("Гниль Нургла", [entry])]);
    expect(rules).toEqual([{
      id: "item.Гниль Нургла.e1", label: "Гниль Нургла", when: {},
      effects: [{ kind: "charRecovery", target: "t", mode: "block" }]
    }]);
  });

  it("«Медленнее» несёт часы, «Все» превращается в область all", () => {
    const entry = { id: "e2", kind: "charRecovery", crTargets: ["all"], crMode: "period", crHours: 7, label: "" };
    const rules = rulesFromItemMechanics([trait("Гниль Нургла", [entry])]);
    expect(rules[0].effects[0]).toEqual({ kind: "charRecovery", target: "all", mode: "period", hours: 7 });
  });

  it("несколько Характеристик склеиваются запятой (t,s)", () => {
    const entry = { id: "e3", kind: "charRecovery", crTargets: ["t", "s"], crMode: "block", label: "" };
    const rules = rulesFromItemMechanics([trait("Яд", [entry])]);
    expect(rules[0].effects[0].target).toBe("t,s");
  });

  it("без выбранных Характеристик запись не даёт правила", () => {
    const entry = { id: "e4", kind: "charRecovery", crTargets: [], crMode: "block", label: "" };
    expect(rulesFromItemMechanics([trait("Пусто", [entry])])).toEqual([]);
  });
});

describe("charRecovery: запись на предмете актора → actorRecoveryPolicy", () => {
  it("«Не восстанавливается» блокирует T, остальные Характеристики восстанавливаются как обычно", () => {
    const item = trait("Гниль Нургла", [
      { id: "e1", kind: "charRecovery", crTargets: ["t"], crMode: "block", label: "" }
    ]);
    const policy = actorRecoveryPolicy(actorWith(item));
    expect(policy.t.blocked).toBe(true);
    expect(policy.t.sources).toEqual(["Гниль Нургла"]);
    expect(policy.s.blocked).toBe(false);
    expect(policy.s.hours).toBe(1);
  });

  it("«Медленнее» на «Все» растягивает период на всех Характеристиках сразу", () => {
    const item = trait("Гниль Нургла", [
      { id: "e2", kind: "charRecovery", crTargets: ["all"], crMode: "period", crHours: 7, label: "" }
    ]);
    const policy = actorRecoveryPolicy(actorWith(item));
    expect(policy.ws.hours).toBe(7);
    expect(policy.fel.hours).toBe(7);
    expect(policy.ws.blocked).toBe(false);
  });

  it("зависимость от препарата: I/P/W/F блокируются, остальные — нет", () => {
    const item = trait("Зависимость", [
      { id: "e3", kind: "charRecovery", crTargets: ["int", "per", "wp", "fel"], crMode: "block", label: "" }
    ]);
    const policy = actorRecoveryPolicy(actorWith(item));
    for (const k of ["int", "per", "wp", "fel"]) expect(policy[k].blocked).toBe(true);
    for (const k of ["ws", "bs", "s", "t", "ag"]) expect(policy[k].blocked).toBe(false);
  });

  it("block сильнее period, если у Характеристики два источника разом", () => {
    const items = [
      trait("Гниль Нургла", [{ id: "e1", kind: "charRecovery", crTargets: ["t"], crMode: "block", label: "" }]),
      trait("Ещё период", [{ id: "e2", kind: "charRecovery", crTargets: ["t"], crMode: "period", crHours: 3, label: "" }])
    ];
    const policy = actorRecoveryPolicy(actorWith(...items));
    expect(policy.t.blocked).toBe(true);
  });
});
