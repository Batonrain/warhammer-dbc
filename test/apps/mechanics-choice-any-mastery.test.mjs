// test/apps/mechanics-choice-any-mastery.test.mjs
//
// specKey:"__choice_any__" + grantsMastery (wdbc-2n5t): «персонаж без траты
// опыта изучает ЛЮБОЙ Навык по своему выбору до +10 и получает Талант Mastery
// для этого Навыка» («Знания Веков» и подобные мутации). Кандидаты — ПОЛНЫЙ
// список masteryTargets() (rules/mastery-targets.mjs), не ограниченный список
// specChoiceKeys, как у обычного "__choice__". Использует тот же
// withMechCollector, что и test/apps/mechanics-parallel-spec-choices.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics, withMechCollector } from "../../module/apps/mechanics.mjs";
import { masteryTargets } from "../../module/rules/mastery-targets.mjs";

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const choiceAnyEntry = (id, { rank = "trained", grantsMastery = false } = {}) =>
  ({ id, kind: "skill", specKey: "__choice_any__", rank, grantsMastery });

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = (cur[parts[i]] ??= {});
  cur[parts.at(-1)] = value;
}

function actorStub() {
  const system = { characteristics: {}, skills: {}, groupSkills: {}, wounds: { max: 10 } };
  const actor = new Actor();
  actor.system = system;
  actor.items = [];
  actor.update = async data => { for (const [k, v] of Object.entries(data)) setPath(actor, k, v); };
  let seq = 0;
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => ({ id: `it-${seq++}`, name: d.name, type: d.type, system: d.system }));
    actor.items.push(...made);
    return made;
  };
  return actor;
}

function itemOnActor(mechanics) {
  const flags = { mechanics };
  const actor = actorStub();
  const item = {
    id: "item-1", type: "mutation", name: "Знания Веков", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => docs,
    deleteEmbeddedDocuments: async () => []
  };
  return item;
}

/** Резолвит первый вопрос коллектора выбором кандидата по ключу masteryTargets(). */
function pickCollector(key) {
  const calls = [];
  return {
    calls,
    choose: () => new Promise(resolve => calls.push({ type: "or", resolve })),
    chooseSpec: (skillLabel, choices) => {
      const found = choices.find(c => c.key === key);
      return Promise.resolve(found ?? null);
    }
  };
}

describe("specKey:__choice_any__ — кандидаты", () => {
  it("голые группы без специализации исключены (ранг некуда положить)", async () => {
    let seen = null;
    const collector = {
      choose: () => Promise.resolve(null),
      chooseSpec: (label, choices) => { seen = choices; return Promise.resolve(null); }
    };
    const item = itemOnActor([andGroup(choiceAnyEntry("e1"))]);
    await withMechCollector(collector, () => applyItemMechanics(item));

    expect(seen.length).toBeGreaterThan(0);
    const bareGroupKeys = masteryTargets().filter(t => t.group && !t.spec).map(t => t.key);
    for (const k of bareGroupKeys) expect(seen.map(c => c.key)).not.toContain(k);
  });

  it("отказ от выбора (null) — ничего не выдаётся", async () => {
    const item = itemOnActor([andGroup(choiceAnyEntry("e1", { grantsMastery: true }))]);
    await withMechCollector({ choose: () => Promise.resolve(null), chooseSpec: () => Promise.resolve(null) },
      () => applyItemMechanics(item));
    expect(item.parent.system.skills).toEqual({});
    expect(item.parent.items).toHaveLength(0);
  });
});

describe("specKey:__choice_any__ — обычный Навык", () => {
  it("выдаёт ранг ОБЫЧНОМУ (не групповому) Навыку", async () => {
    const item = itemOnActor([andGroup(choiceAnyEntry("e1"))]);
    await withMechCollector(pickCollector("dodge"), () => applyItemMechanics(item));
    expect(item.parent.system.skills.dodge?.rank).toBe("trained");
  });

  it("grantsMastery:true — довыдаёт Талант Mastery на ТОТ ЖЕ Навык", async () => {
    const item = itemOnActor([andGroup(choiceAnyEntry("e1", { grantsMastery: true }))]);
    await withMechCollector(pickCollector("dodge"), () => applyItemMechanics(item));
    expect(item.parent.system.skills.dodge?.rank).toBe("trained");
    const mastery = item.parent.items.find(i => i.name === "Mastery / Мастерство");
    expect(mastery).toBeDefined();
    expect(mastery.system.specialization).toBe("Уклонение"); // masteryLabel("dodge")
  });

  it("grantsMastery:false (по умолчанию) — Талант не выдаётся", async () => {
    const item = itemOnActor([andGroup(choiceAnyEntry("e1"))]);
    await withMechCollector(pickCollector("dodge"), () => applyItemMechanics(item));
    expect(item.parent.items.find(i => i.name === "Mastery / Мастерство")).toBeUndefined();
  });
});

describe("specKey:__choice_any__ — групповой Навык+специализация", () => {
  it("выдаёт нужную специализацию группового Навыка", async () => {
    const item = itemOnActor([andGroup(choiceAnyEntry("e1"))]);
    await withMechCollector(pickCollector("forbiddenLore:daemons"), () => applyItemMechanics(item));
    const rows = item.parent.system.groupSkills.forbiddenLore;
    expect(rows).toHaveLength(1);
    expect(rows[0].specKey).toBe("daemons");
    expect(rows[0].rank).toBe("trained");
  });

  it("grantsMastery:true — Талант привязан к «Группа (Специализация)»", async () => {
    const item = itemOnActor([andGroup(choiceAnyEntry("e1", { grantsMastery: true }))]);
    await withMechCollector(pickCollector("forbiddenLore:daemons"), () => applyItemMechanics(item));
    const mastery = item.parent.items.find(i => i.name === "Mastery / Мастерство");
    expect(mastery.system.specialization).toBe("Запретные знания (Демоны)"); // masteryLabel("forbiddenLore:daemons")
  });
});
