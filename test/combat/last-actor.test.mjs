// test/combat/last-actor.test.mjs
//
// Last Actor / Последний Актёр (wdbc-1rno): только «бросает трижды на
// инициативу (три хода в раунде)» — через module/combat/extra-turn.mjs, 2
// доп. Combatant при старте боя. Остальные 7 пунктов находки — см.
// комментарий в last-actor.mjs, не входят в эту находку.

import { describe, it, expect } from "vitest";
import { hasLastActor, processLastActorCombatStart } from "../../module/combat/last-actor.mjs";
import { extraTurnCount } from "../../module/combat/extra-turn.mjs";

const actorWith = (...names) => ({
  items: names.map(name => ({ type: "talent", name }))
});

function fakeCombat(combatants) {
  const list = [...combatants];
  let nextId = 100;
  return {
    combatants: list,
    async createEmbeddedDocuments(type, docs) {
      const created = docs.map(d => ({
        id: `combatant-${nextId++}`, ...d,
        getFlag: (scope, key) => d.flags?.[scope]?.[key]
      }));
      list.push(...created);
      return created;
    }
  };
}

const combatantFor = (id, actorId, actor) =>
  ({ id, actorId, tokenId: `token-${id}`, actor, getFlag: () => undefined });

describe("hasLastActor", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasLastActor(actorWith("Last Actor / Последний Актёр"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasLastActor(actorWith("Dodge"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasLastActor(null)).toBe(false);
  });
});

describe("processLastActorCombatStart", () => {
  it("владельцу Таланта выдаёт 2 доп. Хода (3 всего с обычным)", async () => {
    const solitaire = { id: "actor-1" };
    const combat = fakeCombat([combatantFor("c1", "actor-1", { ...solitaire, items: [{ type: "talent", name: "Last Actor / Последний Актёр" }] })]);

    await processLastActorCombatStart(combat);

    expect(extraTurnCount(combat, "actor-1", "lastActor")).toBe(2);
    expect(combat.combatants).toHaveLength(3); // 1 реальный + 2 доп.
  });

  it("без Таланта — доп. Ходов не выдаётся", async () => {
    const combat = fakeCombat([combatantFor("c1", "actor-1", { id: "actor-1", items: [] })]);

    await processLastActorCombatStart(combat);

    expect(extraTurnCount(combat, "actor-1", "lastActor")).toBe(0);
    expect(combat.combatants).toHaveLength(1);
  });

  it("повторный вызов (напр. смена Combat) не плодит доп. Ходы сверх 2", async () => {
    const actor = { id: "actor-1", items: [{ type: "talent", name: "Last Actor / Последний Актёр" }] };
    const combat = fakeCombat([combatantFor("c1", "actor-1", actor)]);

    await processLastActorCombatStart(combat);
    await processLastActorCombatStart(combat);

    expect(extraTurnCount(combat, "actor-1", "lastActor")).toBe(2);
  });

  it("несколько владельцев Таланта — у каждого свои 2 доп. Хода", async () => {
    const solitaire = () => ({ items: [{ type: "talent", name: "Last Actor / Последний Актёр" }] });
    const combat = fakeCombat([
      combatantFor("c1", "actor-1", { id: "actor-1", ...solitaire() }),
      combatantFor("c2", "actor-2", { id: "actor-2", ...solitaire() })
    ]);

    await processLastActorCombatStart(combat);

    expect(extraTurnCount(combat, "actor-1", "lastActor")).toBe(2);
    expect(extraTurnCount(combat, "actor-2", "lastActor")).toBe(2);
  });

  it("нет combat — не падает", async () => {
    await expect(processLastActorCombatStart(null)).resolves.toBeUndefined();
  });
});
