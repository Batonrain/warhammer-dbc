// test/apps/mechanics-talentspec-when.test.mjs
//
// entry.when.talentSpec (wdbc-ta4y) — третий независимый гейт «Когда», общий
// для ЛЮБОГО вида записи Конструктора, тот же принцип, что «Когда Геносемя»/
// «Когда субмутация» (см. mechanics-geneseed-when.test.mjs). Пример из жизни:
// Серый Человек с Талантом Mastery (Психонаука) получает Черту Warp Sight.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

const whenTalent = (name, specialization, negateTalent = false) =>
  ({ negate: false, conditions: [], talentSpec: { name, specialization }, negateTalent });

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
// isEntryComplete (mechanics.mjs) требует непустой sourceUuid у kind:"trait" —
// сам он в этом тесте не резолвится (game.packs пуст), falls back на
// sourceName, но ПУСТАЯ строка отфильтровала бы запись ещё до applyMechEntry.
const traitEntry = (id, w) => ({
  id, kind: "trait", sourceUuid: "Compendium.warhammer-dbc.traits.Item.warpsight1",
  sourceName: "Warp Sight / Варп-Зрение", rating: "", when: w
});

function itemOnActor({ mechanics = [], actorItems = [] } = {}) {
  const own = { mechanics };
  const actor = new Actor();
  actor.system = { geneSeed: {} };
  actor.items = actorItems;
  let seq = 0;
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => ({ id: `it-${seq++}`, name: d.name, type: d.type,
                                  system: d.system, getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
    actor.items.push(...made);
    return made;
  };

  const item = {
    id: "item-1", type: "trait", name: "Oteshii Physiology", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => {
      const made = docs.map(d => ({ id: `fx-${seq++}`, name: d.name, system: d.system,
                                    getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
      item.effects.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (_t, ids) => {
      item.effects = item.effects.filter(f => !ids.includes(f.id));
      return ids;
    }
  };
  return item;
}

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

// entryWhenOk — talentSpec как чистая функция (без items/actor/нет, разная
// специализация) уже покрыта test/rules/mech-when.test.mjs, описание
// "entryWhenOk: Талант+специализация (wdbc-ta4y)" — те же три сценария
// дословно дублировались здесь (wdbc-shr, находка 10). Ниже остаётся только
// то, что там не проверяется: applyItemMechanics целиком (разовая выдача
// Черты через реальный конвейер Механики, а не голый entryWhenOk).

describe("applyItemMechanics — гейт на разовой выдаче Черты по talentSpec", () => {
  it("Mastery (Психонаука) есть — Warp Sight выдаётся", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", whenTalent("Мастерство", "Психонаука")))],
      actorItems: [{ id: "mastery-1", type: "talent", name: "Mastery / Мастерство",
                     system: { specialization: "Психонаука" } }]
    });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).toContain("Warp Sight / Варп-Зрение");
  });

  it("Mastery на другой Навык — Warp Sight не выдаётся", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", whenTalent("Мастерство", "Психонаука")))],
      actorItems: [{ id: "mastery-1", type: "talent", name: "Mastery / Мастерство",
                     system: { specialization: "Уклонение" } }]
    });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).not.toContain("Warp Sight / Варп-Зрение");
  });

  it("Mastery нет вовсе — Warp Sight не выдаётся", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", whenTalent("Мастерство", "Психонаука")))],
      actorItems: []
    });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).not.toContain("Warp Sight / Варп-Зрение");
  });

  it("Талант взяли уже ПОСЛЕ первого прогона Механики — повтор его подхватывает", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", whenTalent("Мастерство", "Психонаука")))],
      actorItems: []
    });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).not.toContain("Warp Sight / Варп-Зрение");

    item.parent.items.push({ id: "mastery-1", type: "talent", name: "Mastery / Мастерство",
                             system: { specialization: "Психонаука" } });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).toContain("Warp Sight / Варп-Зрение");
  });
});
