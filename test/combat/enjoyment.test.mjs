// test/combat/enjoyment.test.mjs
//
// maybeGrantEnjoymentPain (module/combat/enjoyment.mjs, wdbc-sk8s) — реактивный
// триггер Таланта Enjoyment/Наслаждение: 1 Боли раз за бой, без траты Реакции.
// Вызывается напрямую из трёх точек (hooks.mjs, drugs.mjs, damage.mjs) — эти
// тесты проверяют только саму функцию (владение Талантом + кулдаун + начисление),
// не сами точки интеграции.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { maybeGrantEnjoymentPain } from "../../module/combat/enjoyment.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

function makeActor(hasTalent, { pain = 0, painMax = 5 } = {}) {
  const flags = {};
  const actor = {
    name: "Испытуемый",
    items: hasTalent ? [{ type: "talent", name: "Enjoyment / Наслаждение" }] : [],
    system: { fate: { value: pain, max: painMax } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  actor.update = async data => {
    if (data["system.fate.value"] !== undefined) actor.system.fate.value = data["system.fate.value"];
  };
  return actor;
}

afterEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("maybeGrantEnjoymentPain", () => {
  it("без Таланта — ничего не делает", async () => {
    const actor = makeActor(false, { pain: 0 });
    await maybeGrantEnjoymentPain(actor);
    expect(actor.system.fate.value).toBe(0);
  });

  it("с Талантом — даёт 1 Боли (текст без траты Реакции)", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = makeActor(true, { pain: 0, painMax: 5 });
    await maybeGrantEnjoymentPain(actor);
    expect(actor.system.fate.value).toBe(1);
    expect(captured.chat[0].content).toContain("без траты Реакции");
  });

  it("раз за бой — второй триггер в том же бою не даёт вторую Боль", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = makeActor(true, { pain: 0, painMax: 5 });
    await maybeGrantEnjoymentPain(actor);
    await maybeGrantEnjoymentPain(actor);
    expect(actor.system.fate.value).toBe(1);
  });

  it("новый бой — снова доступно", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = makeActor(true, { pain: 0, painMax: 5 });
    await maybeGrantEnjoymentPain(actor);
    globalThis.game.combat = { id: "combat-2" };
    await maybeGrantEnjoymentPain(actor);
    expect(actor.system.fate.value).toBe(2);
  });

  it("Боль уже на максимуме — painChange сам не превышает потолок", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const actor = makeActor(true, { pain: 5, painMax: 5 });
    await maybeGrantEnjoymentPain(actor);
    expect(actor.system.fate.value).toBe(5);
  });
});
