// test/apps/armour-of-the-gods.test.mjs
//
// Armour of the Gods / Доспехи Богов (wdbc-1rno) — grantArmourOfTheGods:
// создаёт предмет Архетипа (реальный createItem-триггер выдаёт остальное —
// не проверяется здесь напрямую, стенд Foundry хуки не гоняет, см. шапку
// rules/armour-of-the-gods.mjs про Hooks.on("createItem", ...)), пишет
// system.eliteArchetype/eliteArchetypesExtra, катает +1d10 Порчи, выдаёт
// реальную броню «Божественные Латы».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { grantArmourOfTheGods } from "../../module/apps/armour-of-the-gods.mjs";
import { IRONCLAD_ARCHETYPE_NAME } from "../../module/rules/armour-of-the-gods.mjs";

function makeActor({ eliteArchetype = "", eliteArchetypesExtra = [], corruption = 10 } = {}) {
  const created = [];
  const actor = {
    name: "Чемпион",
    system: { eliteArchetype, eliteArchetypesExtra, corruption: { value: corruption } },
    createEmbeddedDocuments: async (type, docs) => { created.push(...docs); return docs; },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return { actor, created };
}

function stubPack(entries) {
  return {
    getIndex: async () => entries,
    getDocument: async id => {
      const e = entries.find(x => x._id === id);
      return e ? { ...e, toObject: () => ({ ...e }) } : null;
    }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.packs = new Map();
});

describe("grantArmourOfTheGods", () => {
  it("уже Броненосец (основное поле) — ok:false, ничего не создаётся", async () => {
    const { actor, created } = makeActor({ eliteArchetype: IRONCLAD_ARCHETYPE_NAME });
    const res = await grantArmourOfTheGods(actor);
    expect(res.ok).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("уже Броненосец (дополнительный архетип) — тоже ok:false", async () => {
    const { actor } = makeActor({ eliteArchetype: "Другой", eliteArchetypesExtra: [IRONCLAD_ARCHETYPE_NAME] });
    const res = await grantArmourOfTheGods(actor);
    expect(res.ok).toBe(false);
  });

  it("архетип не найден в компендиуме — ok:false, честная причина", async () => {
    globalThis.game.packs.set("warhammer-dbc.elite-archetypes", stubPack([]));
    const { actor } = makeActor();
    const res = await grantArmourOfTheGods(actor);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("не найден");
  });

  it("успех: предмет Архетипа создан, основное поле шапки заполнено, +1d10 Порчи, выдана броня AP", async () => {
    globalThis.game.packs.set("warhammer-dbc.elite-archetypes",
      stubPack([{ _id: "arch1", name: IRONCLAD_ARCHETYPE_NAME, type: "eliteArchetype", system: {} }]));
    const { actor, created } = makeActor({ corruption: 10 });
    captured.nextRoll = 6;

    const res = await grantArmourOfTheGods(actor);

    expect(res.ok).toBe(true);
    expect(res.corGain).toBe(6);
    expect(created).toHaveLength(2); // предмет Архетипа + броня
    expect(created[0].name).toBe(IRONCLAD_ARCHETYPE_NAME);
    expect(created[1]).toMatchObject({ type: "armor", system: { head: 8, body: 10, leftArm: 8, rightArm: 8, leftLeg: 8, rightLeg: 8 } });

    expect(actor.system.eliteArchetype).toBe(IRONCLAD_ARCHETYPE_NAME);
    expect(actor.system.corruption.value).toBe(16); // 10 + 6
  });

  it("уже есть ДРУГОЙ архетип — Ironclad уходит в eliteArchetypesExtra, не перетирает основной", async () => {
    globalThis.game.packs.set("warhammer-dbc.elite-archetypes",
      stubPack([{ _id: "arch1", name: IRONCLAD_ARCHETYPE_NAME, type: "eliteArchetype", system: {} }]));
    const { actor } = makeActor({ eliteArchetype: "Другой Архетип" });
    captured.nextRoll = 3;

    await grantArmourOfTheGods(actor);

    expect(actor.system.eliteArchetype).toBe("Другой Архетип");
    expect(actor.system.eliteArchetypesExtra).toEqual([IRONCLAD_ARCHETYPE_NAME]);
  });

  it("Порча капируется потолком 100", async () => {
    globalThis.game.packs.set("warhammer-dbc.elite-archetypes",
      stubPack([{ _id: "arch1", name: IRONCLAD_ARCHETYPE_NAME, type: "eliteArchetype", system: {} }]));
    const { actor } = makeActor({ corruption: 95 });
    captured.nextRoll = 10;

    await grantArmourOfTheGods(actor);

    expect(actor.system.corruption.value).toBe(100);
  });
});
