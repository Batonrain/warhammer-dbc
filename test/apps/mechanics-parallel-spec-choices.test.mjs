// test/apps/mechanics-parallel-spec-choices.test.mjs
//
// Соседние записи kind:"skill" со specKey:"__choice__" (Навык «на выбор» —
// «Общие знания», «Учёные знания» и т.п.) в ОДНОЙ И-группе раньше спрашивались
// строго ПО ОЧЕРЕДИ: applyGroupEntries просила выбор у первой, ждала ответ,
// и только ПОСЛЕ этого доходила до второй — вложенные ИЛИ-подгруппы (см.
// resolveDirectOrGroup) уже спрашивались ОДНОВРЕМЕННО, а прямые записи
// spec-выбора — нет. В Мастере создания это выглядело как «строки выбора
// Расы всплывают по одной, а Архетипа — пачкой» (пользовательский репорт
// 20.08.2026, живая проверка на Друкхари/Изгое).
//
// Проверяем через withMechCollector с ОТЛОЖЕННЫМ (не сразу резолвящим)
// коллектором: оба вопроса должны прийти ДО того, как отвечен первый.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { applyItemMechanics, withMechCollector } from "../../module/apps/mechanics.mjs";

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const specChoiceEntry = (id, skillKey, specChoiceKeys, rank = "knows") => ({
  id, kind: "skill", skillScope: "group", skillKey, specKey: "__choice__",
  specChoiceKeys, specChoiceCount: 1, rank
});

/** Дотнотированный путь в объекте — тестовому актору хватает этого одного места. */
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
  actor.update = async data => { for (const [k, v] of Object.entries(data)) setPath(actor, k, v); };
  actor.createEmbeddedDocuments = async (_t, docs) => docs;
  return actor;
}

function itemOnActor(mechanics) {
  const flags = { mechanics };
  const actor = actorStub();
  const item = {
    id: "item-1", type: "trait", name: "Черта", img: "icons/svg/aura.svg",
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

/** Коллектор, который НЕ резолвит вопрос сразу — копит их, чтобы тест видел, что пришло ДО ответа. */
function deferredCollector() {
  const calls = [];
  return {
    calls,
    choose: () => new Promise(resolve => calls.push({ type: "or", resolve })),
    chooseSpec: (skillLabel, choices) => new Promise(resolve => calls.push({ type: "spec", skillLabel, choices, resolve }))
  };
}

describe("прямые записи spec-выбора одной И-группы спрашиваются одновременно", () => {
  it("оба вопроса приходят ДО того, как отвечен первый", async () => {
    const item = itemOnActor([andGroup(
      specChoiceEntry("e1", "commonLore", ["chaos"]),
      specChoiceEntry("e2", "forbiddenLore", ["warp"])
    )]);
    const collector = deferredCollector();
    const applyPromise = withMechCollector(collector, () => applyItemMechanics(item));

    // Дать асинхронной цепочке обеих ветвей дойти до коллектора, не отвечая ни на одну.
    await new Promise(r => setTimeout(r, 20));

    expect(collector.calls.length).toBe(2);
    expect(collector.calls.map(c => c.skillLabel).sort()).toEqual(
      ["Запретные знания", "Общие знания"].sort()
    );

    for (const c of collector.calls) c.resolve([c.choices[0]]);
    await applyPromise;

    expect(item.parent.system.groupSkills.commonLore?.[0]?.specKey).toBe("chaos");
    expect(item.parent.system.groupSkills.forbiddenLore?.[0]?.specKey).toBe("warp");
  });

  it("порядок ЗАПИСИ в актора остаётся исходным, даже если ответить во втором порядке первой", async () => {
    const order = [];
    const item = itemOnActor([andGroup(
      specChoiceEntry("e1", "commonLore", ["chaos"]),
      specChoiceEntry("e2", "forbiddenLore", ["warp"])
    )]);
    const origUpdate = item.parent.update;
    item.parent.update = async data => { order.push(Object.keys(data)[0]); return origUpdate(data); };

    const collector = deferredCollector();
    const applyPromise = withMechCollector(collector, () => applyItemMechanics(item));
    await new Promise(r => setTimeout(r, 20));

    // Отвечаем на ВТОРОЙ вопрос первым — запись в актора всё равно должна
    // пойти в исходном порядке (commonLore раньше forbiddenLore).
    const bySkill = key => collector.calls.find(c => c.skillLabel.startsWith(key === "commonLore" ? "Общие" : "Запретные"));
    bySkill("forbiddenLore").resolve([bySkill("forbiddenLore").choices[0]]);
    bySkill("commonLore").resolve([bySkill("commonLore").choices[0]]);
    await applyPromise;

    expect(order).toEqual(["system.groupSkills.commonLore", "system.groupSkills.forbiddenLore"]);
  });
});
