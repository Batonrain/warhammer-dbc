// test/combat/capability-cost-action.test.mjs
//
// Цена возможности в ОЧКАХ ДЕЙСТВИЯ (wdbc-m7we).
//
// У записи Конструктора «Возможность» цена была только в Очках Бесчестия/
// Судьбы/Боли. Но самая частая форма способности без читателя — «Полудействие:
// сделать X» (113 таких подписей в реестре, 12 из них реально выданы
// предметами), и сказать про эту цену данными было нечем: автор писал её
// текстом, игрок тратил действие по памяти.
//
// Механизм траты ОД при этом существовал давно (combat/action-economy.mjs:
// canSpendActionPoints/spendActionPoints/apSpendGate) — не хватало только
// связи с Конструктором. Здесь она и заводится: пул "action" переиспользует
// тот API, а не заводит второй счёт.
//
// ВАЖНОЕ ОТЛИЧИЕ от трёх прежних пулов: те — три РАЗНЫХ ТЕРМИНА одного и того
// же поля актора (system.fate.value), и cost.pool у них авторская подпись, а не
// адрес хранения. У "action" адрес другой (system.actionPoints.value), и
// проверяется он иначе — вне боя экономика действий не считается вовсе.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CAPABILITY_COST_POOLS, capabilityCostLabel, capabilityCostGate, spendCapabilityCost }
  from "../../module/combat/capability-cost.mjs";

function actor({ ap = 2, fate = 3, type = "character" } = {}) {
  const updates = [];
  return {
    type, name: "Подставной",
    system: { actionPoints: { value: ap, max: 2 }, fate: { value: fate, max: 3 }, characteristics: {} },
    update: async (patch) => { updates.push(patch); },
    updates
  };
}

/**
 * Вне боя экономика действий НЕ проверяется вовсе — это правило самой
 * подсистемы (combat/action-economy.mjs::isEncounterActive), и цена в ОД ему
 * подчиняется, а не заводит своё. Поэтому бой приходится включать явно.
 */
const inCombat = (on) => { globalThis.game = { ...(globalThis.game ?? {}), combat: on ? { started: true } : null }; };

beforeEach(() => { resetCaptured(); inCombat(true); });
afterEach(() => inCombat(false));

describe("пул «Очки Действия» заведён в Конструкторе", () => {
  it("есть в списке пулов — иначе автор его не выберет", () => {
    expect(CAPABILITY_COST_POOLS.action).toBeTruthy();
    expect(CAPABILITY_COST_POOLS.action.label).toMatch(/Действия|ОД/);
  });

  it("подпись цены читается по-игровому, а не «Очков Действия»", () => {
    expect(capabilityCostLabel({ pool: "action", amount: 1 })).toBe("1 ОД");
    expect(capabilityCostLabel({ pool: "action", amount: 2 })).toBe("2 ОД");
  });

  it("прежние пулы не задеты", () => {
    expect(capabilityCostLabel({ pool: "infamy", amount: 1 })).toBe("1 Очко Бесчестия");
    expect(capabilityCostLabel({ pool: "fate", amount: 2 })).toBe("2 Очка Судьбы");
  });
});

describe("гейт кнопки по Очкам Действия", () => {
  it("хватает ОД — кнопка активна", () => {
    expect(capabilityCostGate(actor({ ap: 2 }), { pool: "action", amount: 2 }).disabled).toBe(false);
  });

  it("не хватает ОД — кнопка выключена и говорит почему ДО клика", () => {
    const gate = capabilityCostGate(actor({ ap: 1 }), { pool: "action", amount: 2 });
    expect(gate.disabled).toBe(true);
    expect(gate.title).toContain("2 ОД");
  });

  it("нехватка ОД не путается с нехваткой Бесчестия", () => {
    // У актора 0 ОД, но 3 Очка Бесчестия: цена в Бесчестии обязана пройти.
    const a = actor({ ap: 0, fate: 3 });
    expect(capabilityCostGate(a, { pool: "action", amount: 1 }).disabled).toBe(true);
    expect(capabilityCostGate(a, { pool: "infamy", amount: 1 }).disabled).toBe(false);
  });
});

describe("списание Очков Действия", () => {
  it("списывает из ОД, а не из Бесчестия", async () => {
    const a = actor({ ap: 2, fate: 3 });
    const ok = await spendCapabilityCost(a, { pool: "action", amount: 1 }, "Янус");
    expect(ok).toBe(true);
    const patch = a.updates.at(-1);
    expect(patch).toHaveProperty("system.actionPoints.value", 1);
    expect(Object.keys(patch).join()).not.toContain("fate");
  });

  it("не хватило ОД — ничего не списано", async () => {
    const a = actor({ ap: 0 });
    const ok = await spendCapabilityCost(a, { pool: "action", amount: 2 }, "Эфирная Стая");
    expect(ok).toBe(false);
    expect(a.updates).toEqual([]);
  });

  it("цена в Бесчестии по-прежнему идёт в своё поле", async () => {
    const a = actor({ ap: 2, fate: 3 });
    await spendCapabilityCost(a, { pool: "infamy", amount: 1 }, "Око Вызова");
    const patch = a.updates.at(-1);
    expect(patch).toHaveProperty("system.fate.value", 2);
    expect(Object.keys(patch).join()).not.toContain("actionPoints");
  });

  it("списание видно в чате — иначе за столом не заметят", async () => {
    // Карточка постится в этом же тесте, а не проверяется хвостом от
    // предыдущего: resetCaptured чистит перехват перед каждым.
    await spendCapabilityCost(actor({ ap: 2 }), { pool: "action", amount: 1 }, "Янус");
    const card = captured.chat.at(-1);
    expect(card, "карточка о трате не запощена").toBeTruthy();
    expect(card.content).toContain("1 ОД");
  });
});

describe("вне боя цена в ОД не сторожится", () => {
  // Не поблажка, а правило самой экономики действий: вне Encounter Очки
  // Действия не считаются вообще. Способность, купленную за полудействие,
  // вне боя можно объявить свободно — так же, как любое другое действие.
  it("кнопка активна даже при нуле ОД", () => {
    inCombat(false);
    expect(capabilityCostGate(actor({ ap: 0 }), { pool: "action", amount: 2 }).disabled).toBe(false);
  });

  it("а цена в Бесчестии сторожится всегда — она к бою не привязана", () => {
    inCombat(false);
    expect(capabilityCostGate(actor({ fate: 0 }), { pool: "infamy", amount: 1 }).disabled).toBe(true);
  });
});
