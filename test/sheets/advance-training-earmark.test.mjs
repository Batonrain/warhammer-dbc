// test/sheets/advance-training-earmark.test.mjs
//
// Целевой запас xp от курсов Обучения (module/rules/training.mjs) —
// списывается ИМЕННО в момент покупки конкретной Характеристики/Навыка/
// Таланта (module/sheets/tabs/advance.mjs::confirmXpSpendTrained), на 4
// разных точках покупки. Нет experience на акторе → confirmXpSpend сам
// пропускает любую цену (apps/xp-afford.mjs) — фикстуре нечего настраивать
// для «хватает опыта».

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateAdvanceListeners, charImpCost, skillCumCost, setGroupEntryField
} from "../../module/sheets/tabs/advance.mjs";
import { trainingTargetKey, addTrainingEarmark, TRAINING_EARMARK_FLAG } from "../../module/rules/training.mjs";
import { talentCostXP } from "../../module/constants/advancement.mjs";
import { talentCategory } from "../../module/sheets/item-picker.mjs";

function applyPath(target, path, value) {
  const keys = path.split(".");
  let cur = target;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {});
  cur[keys.at(-1)] = value;
}

function actor({ aptitudes = [], characteristics = {}, skills = {}, groupSkills = {}, items = [], earmarks = [] } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = { "warhammer-dbc": { [TRAINING_EARMARK_FLAG]: earmarks } };
  const a = {
    system: { aptitudes, characteristics, skills, groupSkills },
    items: list,
    update: async data => { for (const [path, value] of Object.entries(data)) applyPath(a, path, value); return data; },
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => { (flags[scope] ??= {})[key] = value; }
  };
  return a;
}

function wire(a) {
  const handlers = {};
  const html = {
    find: selector => ({
      click: fn => { handlers[`${selector}:click`] = fn; },
      change: fn => { handlers[`${selector}:change`] = fn; },
      on: (event, fn) => { handlers[`${selector}:${event}`] = fn; },
      each: () => {}
    })
  };
  activateAdvanceListeners(html, a, { addGroupSkill: () => {} });
  return handlers;
}

const ev = (dataset = {}, value) => ({ preventDefault: () => {}, currentTarget: { dataset, value } });

beforeEach(resetCaptured);

describe("Характеристика: скидка целевого запаса при покупке уровня", () => {
  it("запас МЕНЬШЕ цены — скидывается весь запас, остаётся платить разницу, запас пустеет", async () => {
    const fullCost = charImpCost(actor(), "ws", "simple");
    const earmark = Math.floor(fullCost / 3);
    const a = actor({
      characteristics: { ws: { improvement: "none", cost: 0 } },
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "char", key: "ws" }), "курс", earmark)
    });
    const h = wire(a);
    await h[".char-improvement-select:change"](ev({ char: "ws" }, "simple"));

    expect(a.system.characteristics.ws.cost).toBe(fullCost - earmark);
    expect(a.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toEqual([]);
  });

  it("запас БОЛЬШЕ цены — цена уходит в 0, излишек теряется (не остаётся на будущее)", async () => {
    const fullCost = charImpCost(actor(), "ws", "simple");
    const a = actor({
      characteristics: { ws: { improvement: "none", cost: 0 } },
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "char", key: "ws" }), "курс", fullCost * 10)
    });
    const h = wire(a);
    await h[".char-improvement-select:change"](ev({ char: "ws" }, "simple"));

    expect(a.system.characteristics.ws.cost).toBe(0);
    expect(a.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toEqual([]);
  });

  it("без запаса — цена как обычно, без скидки", async () => {
    const fullCost = charImpCost(actor(), "ws", "simple");
    const a = actor({ characteristics: { ws: { improvement: "none", cost: 0 } } });
    const h = wire(a);
    await h[".char-improvement-select:change"](ev({ char: "ws" }, "simple"));
    expect(a.system.characteristics.ws.cost).toBe(fullCost);
  });

  it("запас другой Характеристики не задевается", async () => {
    const fullCost = charImpCost(actor(), "ws", "simple");
    const a = actor({
      characteristics: { ws: { improvement: "none", cost: 0 } },
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "char", key: "bs" }), "курс", 500)
    });
    const h = wire(a);
    await h[".char-improvement-select:change"](ev({ char: "ws" }, "simple"));
    expect(a.system.characteristics.ws.cost).toBe(fullCost);
    expect(a.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toHaveLength(1);
  });
});

describe("Навык (плоский): скидка при покупке ранга", () => {
  it("применяется к SKILLS_DEF-ключу, запас обнуляется", async () => {
    const SKILLS_DEF = (await import("../../module/constants/skills.mjs")).SKILLS_DEF;
    const fullCost = skillCumCost(actor(), SKILLS_DEF.logic, "knows", null, "untrained", null, "", "logic");
    const earmark = Math.ceil(fullCost / 2);
    const a = actor({
      skills: { logic: { rank: "untrained", cost: 0 } },
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "skill", key: "logic" }), "курс", earmark)
    });
    const h = wire(a);
    await h[".skill-rank-select:change"](ev({ skill: "logic" }, "knows"));

    expect(a.system.skills.logic.cost).toBe(fullCost - earmark);
    expect(a.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toEqual([]);
  });
});

describe("Групповой Навык: скидка через setGroupEntryField (ключ по specialty)", () => {
  it("применяется к конкретной специализации, не к группе вообще", async () => {
    const GROUP_SKILLS_DEF = (await import("../../module/constants/skills.mjs")).GROUP_SKILLS_DEF;
    const fullCost = skillCumCost(actor(), GROUP_SKILLS_DEF.forbiddenLore, "knows", null, "untrained",
      "forbiddenLore", "Mechanicum", null, null);
    const earmark = Math.floor(fullCost / 4);
    const a = actor({
      groupSkills: { forbiddenLore: [{ specialty: "Mechanicum", rank: "untrained", cost: 0 }] },
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "group", key: "forbiddenLore", specialty: "Mechanicum" }), "курс", earmark)
    });
    const ok = await setGroupEntryField(a, "forbiddenLore", 0, "rank", "knows");

    expect(ok).toBe(true);
    expect(a.system.groupSkills.forbiddenLore[0].cost).toBe(fullCost - earmark);
    expect(a.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toEqual([]);
  });

  it("запас на ДРУГУЮ специализацию той же группы не трогает эту покупку", async () => {
    const GROUP_SKILLS_DEF = (await import("../../module/constants/skills.mjs")).GROUP_SKILLS_DEF;
    const fullCost = skillCumCost(actor(), GROUP_SKILLS_DEF.forbiddenLore, "knows", null, "untrained",
      "forbiddenLore", "Mechanicum", null, null);
    const a = actor({
      groupSkills: { forbiddenLore: [{ specialty: "Mechanicum", rank: "untrained", cost: 0 }] },
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "group", key: "forbiddenLore", specialty: "Daemons" }), "курс", 999)
    });
    await setGroupEntryField(a, "forbiddenLore", 0, "rank", "knows");
    expect(a.system.groupSkills.forbiddenLore[0].cost).toBe(fullCost);
  });
});

describe("Талант: скидка при покупке (снятие ★)", () => {
  function talentItem({ id = "tal-1", name = "Teacher / Учитель", tier = 1, granted = true, purchased = false, cost = 0 } = {}) {
    const t = { id, name, type: "talent", system: { tier, aptitudes: [], purchased, cost, granted, specialization: "" } };
    t.update = async data => { for (const [path, value] of Object.entries(data)) applyPath(t, path, value); return data; };
    return t;
  }

  it("скидывает цену при снятии ★ (покупке), запас очищается", async () => {
    const item = talentItem();
    const a0 = actor({ items: [talentItem()] });
    const fullCost = talentCostXP(1, [], [], talentCategory(a0, item.name), { name: item.name, actor: a0 });
    const earmark = Math.floor(fullCost / 2);
    const a = actor({
      items: [item],
      earmarks: addTrainingEarmark([], trainingTargetKey({ kind: "talent", key: item.name }), "курс", earmark)
    });
    const h = wire(a);
    await h[".grant-toggle[data-talent]:click"](ev({ talent: item.id }));

    expect(item.system.purchased).toBe(true);
    expect(item.system.cost).toBe(fullCost - earmark);
    expect(a.getFlag("warhammer-dbc", TRAINING_EARMARK_FLAG)).toEqual([]);
  });

  it("без запаса — обычная книжная цена", async () => {
    const item = talentItem();
    const a0 = actor({ items: [talentItem()] });
    const fullCost = talentCostXP(1, [], [], talentCategory(a0, item.name), { name: item.name, actor: a0 });
    const a = actor({ items: [item] });
    const h = wire(a);
    await h[".grant-toggle[data-talent]:click"](ev({ talent: item.id }));
    expect(item.system.cost).toBe(fullCost);
  });
});
