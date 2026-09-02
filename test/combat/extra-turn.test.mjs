// test/combat/extra-turn.test.mjs
//
// module/combat/extra-turn.mjs (wdbc-1rno) — доп. Ход через второй
// Combatant того же актора, помеченный source-тегом. Инфраструктура для
// The Middle of the Hunt (доп. Ход на раундах 3-4) и Last Actor (3 Хода в
// раунде) — сама выдача способностей не входит в этот файл, только
// примитив «создать/снять доп. Combatant».

import { describe, it, expect } from "vitest";
import { hasExtraTurn, extraTurnCount, grantExtraTurn, revokeExtraTurn } from "../../module/combat/extra-turn.mjs";

/** Подставной Combat: combatants — обычный массив, createEmbeddedDocuments пушит в него. */
function fakeCombat(existing = []) {
  const combatants = [...existing];
  let nextId = 100;
  return {
    combatants,
    async createEmbeddedDocuments(type, docs) {
      const created = docs.map(d => ({
        id: `combatant-${nextId++}`, ...d,
        getFlag: (scope, key) => d.flags?.[scope]?.[key]
      }));
      combatants.push(...created);
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (const id of ids) {
        const idx = combatants.findIndex(c => c.id === id);
        if (idx !== -1) combatants.splice(idx, 1);
      }
    }
  };
}

const realCombatant = (id, actorId) => ({ id, actorId, getFlag: () => undefined });

describe("hasExtraTurn / extraTurnCount", () => {
  it("нет доп. Combatant — false/0", () => {
    const combat = fakeCombat([realCombatant("c1", "actor-1")]);
    expect(hasExtraTurn(combat, "actor-1", "lastActor")).toBe(false);
    expect(extraTurnCount(combat, "actor-1", "lastActor")).toBe(0);
  });

  it("не видит РЕАЛЬНЫЙ (без тега) Combatant того же актора", async () => {
    const combat = fakeCombat([realCombatant("c1", "actor-1")]);
    expect(hasExtraTurn(combat, "actor-1", "lastActor")).toBe(false);
  });

  it("не видит доп. Combatant ДРУГОГО актора или с ДРУГИМ тегом", async () => {
    const combat = fakeCombat();
    await grantExtraTurn(combat, { actorId: "actor-2", source: "lastActor" });
    await grantExtraTurn(combat, { actorId: "actor-1", source: "middleOfTheHunt" });
    expect(hasExtraTurn(combat, "actor-1", "lastActor")).toBe(false);
  });
});

describe("grantExtraTurn", () => {
  it("создаёт второго Combatant с тегом source", async () => {
    const combat = fakeCombat([realCombatant("c1", "actor-1")]);
    const created = await grantExtraTurn(combat, { actorId: "actor-1", source: "lastActor" });
    expect(created).toBeTruthy();
    expect(combat.combatants).toHaveLength(2);
    expect(hasExtraTurn(combat, "actor-1", "lastActor")).toBe(true);
  });

  it("повторный вызов создаёт ЕЩЁ ОДНОГО (счётчик растёт) — вызывающий сам решает, сколько нужно", async () => {
    const combat = fakeCombat();
    await grantExtraTurn(combat, { actorId: "actor-1", source: "lastActor" });
    await grantExtraTurn(combat, { actorId: "actor-1", source: "lastActor" });
    expect(extraTurnCount(combat, "actor-1", "lastActor")).toBe(2);
  });

  it("нет combat/actorId/source — ничего не делает, возвращает null", async () => {
    expect(await grantExtraTurn(null, { actorId: "a", source: "x" })).toBeNull();
    const combat = fakeCombat();
    expect(await grantExtraTurn(combat, { source: "x" })).toBeNull();
    expect(await grantExtraTurn(combat, { actorId: "a" })).toBeNull();
    expect(combat.combatants).toHaveLength(0);
  });

  it("передаёт tokenId и явную инициативу в создаваемый документ", async () => {
    const combat = fakeCombat();
    const created = await grantExtraTurn(combat, { actorId: "actor-1", tokenId: "token-1", source: "lastActor", initiative: 42 });
    expect(created.tokenId).toBe("token-1");
    expect(created.initiative).toBe(42);
  });
});

describe("revokeExtraTurn", () => {
  it("удаляет доп. Combatant этого актора с данным тегом", async () => {
    const combat = fakeCombat([realCombatant("c1", "actor-1")]);
    await grantExtraTurn(combat, { actorId: "actor-1", source: "lastActor" });
    expect(combat.combatants).toHaveLength(2);

    await revokeExtraTurn(combat, "actor-1", "lastActor");
    expect(combat.combatants).toHaveLength(1);
    expect(combat.combatants[0].id).toBe("c1"); // реальный Combatant цел
  });

  it("не трогает доп. Combatant с ДРУГИМ тегом или другого актора", async () => {
    const combat = fakeCombat();
    await grantExtraTurn(combat, { actorId: "actor-1", source: "lastActor" });
    await grantExtraTurn(combat, { actorId: "actor-1", source: "middleOfTheHunt" });
    await grantExtraTurn(combat, { actorId: "actor-2", source: "lastActor" });

    await revokeExtraTurn(combat, "actor-1", "lastActor");
    expect(combat.combatants).toHaveLength(2);
    expect(hasExtraTurn(combat, "actor-1", "middleOfTheHunt")).toBe(true);
    expect(hasExtraTurn(combat, "actor-2", "lastActor")).toBe(true);
  });

  it("нечего удалять — не падает, не зовёт deleteEmbeddedDocuments", async () => {
    const combat = fakeCombat();
    let called = false;
    combat.deleteEmbeddedDocuments = async () => { called = true; };
    await revokeExtraTurn(combat, "actor-1", "lastActor");
    expect(called).toBe(false);
  });
});
