// test/migrations/tech-power-costs.test.mjs
//
// Цены Техночудес появились в компендиуме, но статья Опыта spentTech читает
// вложенную копию — у старых акторов там cost: 0. Довыдача обязана взять цену
// из компендиума по compendiumSource (при потере ссылки — по имени) и не
// перетирать цену, выставленную руками.

import { describe, it, expect } from "vitest";
import { zeroCostTechPowers, costFromCompendium } from "../../module/migrations/tech-power-costs.mjs";

const tech = ({ id, name = "Чудо", cost = 0, src } = {}) => ({
  id, name, type: "techPower",
  system: { cost },
  _stats: src ? { compendiumSource: src } : {}
});

const packDoc = (uuid, name, cost) => ({ uuid, name, system: { cost } });

describe("довыдача цен Техночудес", () => {
  it("отбирает только Техночудеса с нулевой ценой", () => {
    const items = [
      tech({ id: "a", cost: 0 }),
      tech({ id: "b", cost: 350 }),
      { id: "c", type: "psyPower", system: { cost: 0 } }
    ];
    expect(zeroCostTechPowers(items).map(i => i.id)).toEqual(["a"]);
  });

  it("цену берёт по compendiumSource, при потере ссылки — по имени", () => {
    const doc = packDoc("Compendium.warhammer-dbc.tech-powers.Item.x1", "Луч Смерти", 500);
    const byUuid = new Map([[doc.uuid, doc]]);
    const byName = new Map([[doc.name, doc]]);

    expect(costFromCompendium(tech({ src: doc.uuid }), byUuid, byName)).toBe(500);
    expect(costFromCompendium(tech({ name: "Луч Смерти" }), byUuid, byName)).toBe(500);
  });

  it("источник не найден или в паке тот же ноль — цена не выдумывается", () => {
    const zero = packDoc("Compendium.warhammer-dbc.tech-powers.Item.z0", "Пустышка", 0);
    const byUuid = new Map([[zero.uuid, zero]]);
    const byName = new Map([[zero.name, zero]]);

    expect(costFromCompendium(tech({ name: "Неизвестное" }), byUuid, byName)).toBe(null);
    expect(costFromCompendium(tech({ src: zero.uuid, name: "Пустышка" }), byUuid, byName)).toBe(null);
  });
});
