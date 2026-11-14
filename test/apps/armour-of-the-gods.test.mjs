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

  // Броню и «+1d10 Порчи» теперь отдаёт createItem-хук самого предмета Архетипа
  // (см. test/apps/ironclad-divine-plate-hook.test.mjs и запись kind:"corruption"
  // в Конструкторе Ironclad) — здесь код Мутации их НЕ дублирует.
  it("успех: предмет Архетипа создан, основное поле шапки заполнено; Порчу и броню сам не выдаёт", async () => {
    globalThis.game.packs.set("warhammer-dbc.elite-archetypes",
      stubPack([{ _id: "arch1", name: IRONCLAD_ARCHETYPE_NAME, type: "eliteArchetype", system: {} }]));
    const { actor, created } = makeActor({ corruption: 10 });
    captured.nextRoll = 6;

    const res = await grantArmourOfTheGods(actor);

    expect(res.ok).toBe(true);
    expect(created).toHaveLength(1); // только предмет Архетипа
    expect(created[0].name).toBe(IRONCLAD_ARCHETYPE_NAME);

    expect(actor.system.eliteArchetype).toBe(IRONCLAD_ARCHETYPE_NAME);
    expect(actor.system.corruption.value).toBe(10); // Порча — из Конструктора Ironclad, не отсюда
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

  it("Порчу сама не трогает (иначе она удвоилась бы с записью Конструктора)", async () => {
    globalThis.game.packs.set("warhammer-dbc.elite-archetypes",
      stubPack([{ _id: "arch1", name: IRONCLAD_ARCHETYPE_NAME, type: "eliteArchetype", system: {} }]));
    const { actor } = makeActor({ corruption: 95 });
    captured.nextRoll = 10;

    await grantArmourOfTheGods(actor);

    expect(actor.system.corruption.value).toBe(95);
  });
});
