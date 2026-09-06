// test/rules/skill-mod.test.mjs
//
// wdbc-q4wb: постоянное поле «Модификатор» у Навыка на листе. Число хранится
// в схеме (system.skills.<key>.mod, module/data/actor/_creature.mjs) и входит
// в derived-поле total (module/rules/character.mjs) — а значит, само собой
// оказывается и в Пороге любого броска этого Навыка, без второго места, где
// его пришлось бы прибавлять.
//
// Отдельно проверяется, что модификатор НЕ ополовинивается вместе со штрафом
// необученности (½-штраф — про штраф ранга, а не про прибавку снаряжения) и
// что у групповых Навыков (Знания/Ремёсла — свободный список специализаций)
// то же поле лежит в записи списка и считается так же.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function halvePenaltyTraitItem(skillKey) {
  return {
    id: "trait-1", name: "Физиология Отеший", type: "trait", system: {},
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "migratedEffect") ? true : undefined,
    flags: { "warhammer-dbc": { mechanics: [
      { id: "g1", operator: "AND", entries: [
        { id: "e1", kind: "testMod", modScope: "skill", skillKey, modValueMode: "halvePenalty", label: "½ штрафа" }
      ] }
    ] } },
    effects: []
  };
}

function characterWith({ skills = {}, groupSkills = null, items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const [key, patch] of Object.entries(skills)) system.skills[key] = { ...system.skills[key], ...patch };
  if (groupSkills) system.groupSkills = groupSkills;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Постоянный модификатор Навыка (wdbc-q4wb)", () => {
  it("по умолчанию модификатор 0 и Итог не меняется", () => {
    const system = characterWith();
    expect(system.skills.athletics.mod).toBe(0);
    expect(system.skills.athletics.total).toBe((system.characteristics.s.total ?? 0) - 20);
  });

  it("положительный модификатор прибавляется к Итогу", () => {
    const system = characterWith({ skills: { athletics: { rank: "trained", mod: 10 } } });
    const base = characterWith({ skills: { athletics: { rank: "trained" } } }).skills.athletics.total;
    expect(system.skills.athletics.total).toBe(base + 10);
  });

  it("отрицательный модификатор вычитается", () => {
    const system = characterWith({ skills: { athletics: { rank: "trained", mod: -15 } } });
    const base = characterWith({ skills: { athletics: { rank: "trained" } } }).skills.athletics.total;
    expect(system.skills.athletics.total).toBe(base - 15);
  });

  it("не мешает ополовиниванию штрафа необученности и сам не ополовинивается", () => {
    const system = characterWith({
      skills: { psyniscience: { rank: "untrained", mod: -6 } },
      items: [halvePenaltyTraitItem("psyniscience")]
    });
    const per = system.characteristics.per.total ?? 0;
    // −20 штрафа → −10 (Талант), модификатор −6 остаётся целым: −6, а не −3.
    expect(system.skills.psyniscience.total).toBe(per - 10 - 6);
  });

  it("у групповых Навыков модификатор лежит в записи специализации и так же входит в Итог", () => {
    const entry = { specialty: "Империум", rank: "trained", cost: 0, total: 0, mod: 8 };
    const system = characterWith({ groupSkills: { commonLore: [entry] } });
    const plain  = characterWith({ groupSkills: { commonLore: [{ ...entry, mod: 0 }] } });
    expect(system.groupSkills.commonLore[0].total).toBe(plain.groupSkills.commonLore[0].total + 8);
  });

  it("нечисловой мусор в поле не ломает Итог", () => {
    const system = characterWith({ skills: { athletics: { rank: "trained", mod: "" } } });
    const base = characterWith({ skills: { athletics: { rank: "trained" } } }).skills.athletics.total;
    expect(system.skills.athletics.total).toBe(base);
  });
});
