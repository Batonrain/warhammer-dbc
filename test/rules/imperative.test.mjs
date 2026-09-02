// test/rules/imperative.test.mjs
//
// module/rules/imperative.mjs (wdbc-yu32) — Императив (Х): раздача
// временного баффа целям, ровно один носитель на цель (замещается новым
// независимо от источника), снимается сменой Раунда (imperativeExpireRound).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { activeImperative, activeImperativeBonuses, applyImperative, resolveExpiredImperatives }
  from "../../module/rules/imperative.mjs";

let nextId = 1;

function actorWith() {
  const items = [];
  items.get = id => items.find(i => i.id === id) ?? null;
  const data = {
    name: "Цель", items,
    createEmbeddedDocuments: async (_type, docs) => {
      const created = docs.map(d => ({ id: `item-${nextId++}`, getFlag(scope, key) { return this.flags?.[scope]?.[key]; }, ...structuredClone(d) }));
      items.push(...created);
      return created;
    },
    deleteEmbeddedDocuments: async (_type, ids) => {
      for (const id of ids) {
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
      }
    }
  };
  return data;
}

afterEach(() => {
  globalThis.game.combat = undefined;
  globalThis.game.user = { isGM: true };
});

describe("applyImperative / activeImperative", () => {
  it("создаёт носитель-Черту с бонусами во флагах", async () => {
    const target = actorWith();
    const caster = { id: "caster1" };
    await applyImperative(target, { sourceItem: { uuid: "Item.src1", img: "x.svg" }, casterActor: caster, label: "Императив Избегания", bonuses: { evasionBonus: 30 } });

    expect(target.items).toHaveLength(1);
    expect(target.items[0].type).toBe("trait");
    const carrier = activeImperative(target);
    expect(carrier).toBeTruthy();
    expect(activeImperativeBonuses(target)).toEqual({ evasionBonus: 30 });
  });

  it("новый Императив замещает предыдущий на той же цели, независимо от источника", async () => {
    const target = actorWith();
    await applyImperative(target, { sourceItem: { uuid: "Item.src1" }, label: "Императив Избегания", bonuses: { evasionBonus: 30 } });
    await applyImperative(target, { sourceItem: { uuid: "Item.src2" }, label: "Императив Крепости", bonuses: { evasionBonus: -30 } });

    expect(target.items).toHaveLength(1);
    expect(activeImperativeBonuses(target)).toEqual({ evasionBonus: -30 });
  });

  it("без активного Combat — imperativeExpireRound не выставляется (null)", async () => {
    const target = actorWith();
    await applyImperative(target, { sourceItem: {}, label: "X", bonuses: {} });
    expect(target.items[0].flags["warhammer-dbc"].imperativeExpireRound).toBeNull();
  });

  it("с активным Combat — imperativeExpireRound = round+1", async () => {
    globalThis.game.combat = { round: 3 };
    const target = actorWith();
    await applyImperative(target, { sourceItem: {}, label: "X", bonuses: {} });
    expect(target.items[0].flags["warhammer-dbc"].imperativeExpireRound).toBe(4);
  });

  it("нет носителя — activeImperative/activeImperativeBonuses возвращают null", () => {
    const target = actorWith();
    expect(activeImperative(target)).toBeNull();
    expect(activeImperativeBonuses(target)).toBeNull();
  });
});

describe("resolveExpiredImperatives", () => {
  it("снимает носитель, чей срок строго меньше текущего Раунда", async () => {
    const target = actorWith();
    globalThis.game.combat = { round: 1 };
    await applyImperative(target, { sourceItem: {}, label: "X", bonuses: {} }); // expire = 2
    expect(target.items).toHaveLength(1);

    const combat = { round: 3, combatants: [{ actor: target }] };
    await resolveExpiredImperatives(combat);
    expect(target.items).toHaveLength(0);
  });

  it("не снимает носитель, чей срок ещё не наступил", async () => {
    const target = actorWith();
    globalThis.game.combat = { round: 1 };
    await applyImperative(target, { sourceItem: {}, label: "X", bonuses: {} }); // expire = 2

    const combat = { round: 2, combatants: [{ actor: target }] };
    await resolveExpiredImperatives(combat);
    expect(target.items).toHaveLength(1);
  });

  it("не ГМ — ничего не делает", async () => {
    globalThis.game.user = { isGM: false };
    const target = actorWith();
    globalThis.game.combat = { round: 1 };
    globalThis.game.user = { isGM: true };
    await applyImperative(target, { sourceItem: {}, label: "X", bonuses: {} });
    globalThis.game.user = { isGM: false };

    const combat = { round: 10, combatants: [{ actor: target }] };
    await resolveExpiredImperatives(combat);
    expect(target.items).toHaveLength(1);
  });
});
