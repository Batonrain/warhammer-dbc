// test/apps/actor-setup-apply.test.mjs
//
// Применение выбранного варианта к листу. Ядро (сборка плана) проверено без
// Foundry в test/rules/actor-setup.test.mjs; здесь — то, что живёт только с
// ней: поиск снимаемого предмета по имени, разворачивание UUID в предметы,
// слияние групповых навыков и флаг сделанного выбора.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applySetupPlan } from "../../module/apps/actor-setup.mjs";

const PACK = {
  "Compendium.warhammer-dbc.weapons.chainsword": { name: "Пиломеч", type: "weapon" },
  "Compendium.warhammer-dbc.traits.undying":     { name: "Undying / Неумирающий", type: "trait" }
};

// Компендиумы заглушкой не изображаются: подставляем ровно то, что читает код.
globalThis.fromUuid = async (uuid) => {
  const doc = PACK[uuid];
  return doc ? { ...doc, toObject: () => ({ ...doc, _id: "pack-id" }) } : null;
};

function actorWith(items = []) {
  const list = [...items];
  list.find = Array.prototype.find.bind(list);
  const a = {
    name: "Культист Фанатик",
    system: {
      wounds: { max: 12 },
      characteristics: { s: { base: 42 } },
      groupSkills: { commonLore: [{ specialty: "War", rank: "knows" }], operate: [] }
    },
    items: list,
    created: [], deleted: [], updates: [],
    createEmbeddedDocuments: async (_t, docs) => { a.created.push(...docs); return docs; },
    deleteEmbeddedDocuments: async (_t, ids) => { a.deleted.push(...ids); return ids; },
    update: async (data) => { a.updates.push(data); return data; }
  };
  return a;
}

const emptyPlan = (over = {}) => ({
  add: [], remove: [], system: {}, groupSkills: [], chosen: {}, log: [], warnings: [], ...over
});

let actor;
beforeEach(() => {
  actor = actorWith([
    { id: "w1", name: "Автопистолет", type: "weapon" },
    { id: "w2", name: "Нож", type: "weapon" }
  ]);
});

describe("применение варианта", () => {
  it("снимает названный предмет и добавляет выбранный из компендиума", async () => {
    const res = await applySetupPlan(actor, emptyPlan({
      remove: [{ type: "weapon", name: "Автопистолет" }],
      add: ["Compendium.warhammer-dbc.weapons.chainsword"]
    }));

    expect(actor.deleted).toEqual(["w1"]);
    expect(actor.created.map(d => d.name)).toEqual(["Пиломеч"]);
    expect(actor.created[0]._id).toBeUndefined();   // копия, а не ссылка на предмет пака
    expect(res).toEqual({ added: 1, removed: 1 });
  });

  it("имя сверяется без учёта регистра и пробелов по краям", async () => {
    await applySetupPlan(actor, emptyPlan({ remove: [{ name: " автопистолет " }] }));

    expect(actor.deleted).toEqual(["w1"]);
  });

  it("одна строка снимает один предмет, а не все одноимённые", async () => {
    actor.items.push({ id: "w3", name: "Нож", type: "weapon" });

    await applySetupPlan(actor, emptyPlan({ remove: [{ type: "weapon", name: "Нож" }] }));

    expect(actor.deleted).toEqual(["w2"]);
  });

  it("нечего снять — предупреждение, а не падение", async () => {
    const plan = emptyPlan({ remove: [{ name: "Болтер" }] });

    await applySetupPlan(actor, plan);

    expect(actor.deleted).toEqual([]);
    expect(plan.warnings.length).toBe(1);
  });

  it("битая ссылка не роняет применение и попадает в предупреждения", async () => {
    const plan = emptyPlan({ add: ["Compendium.warhammer-dbc.weapons.нет-такого"] });

    const res = await applySetupPlan(actor, plan);

    expect(actor.created).toEqual([]);
    expect(plan.warnings.length).toBe(1);
    expect(res.added).toBe(0);
  });

  it("числа варианта уходят в правку листа вместе с дельтой", async () => {
    await applySetupPlan(actor, emptyPlan({
      system: { "characteristics.s.base": 52, "wounds.max": "+5" }
    }));

    expect(actor.updates[0]["system.characteristics.s.base"]).toBe(52);
    expect(actor.updates[0]["system.wounds.max"]).toBe(17);
  });

  it("групповой навык правится группой целиком: известная запись растёт, новая заводится", async () => {
    await applySetupPlan(actor, emptyPlan({ groupSkills: [
      { group: "commonLore", specialty: "War", rank: "veteran" },
      { group: "operate", specialty: "Surface", rank: "trained" }
    ] }));

    const upd = actor.updates[0];
    expect(upd["system.groupSkills.commonLore"]).toEqual([{ specialty: "War", rank: "veteran" }]);
    expect(upd["system.groupSkills.operate"]).toEqual([{ specialty: "Surface", rank: "trained" }]);
  });

  it("выбор запоминается флагом — по нему диалог не откроется у копии актора", async () => {
    await applySetupPlan(actor, emptyPlan({ chosen: { variant: ["berserk"] } }));

    const flag = actor.updates[0]["flags.warhammer-dbc.setupApplied"];
    expect(flag.chosen).toEqual({ variant: ["berserk"] });
    expect(typeof flag.at).toBe("number");
  });
});
