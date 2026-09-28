// test/rules/talent-spec-choice.test.mjs
//
// Талант «на выбор» в записи Конструктора (сверка Репликанта, 26.09.2026):
// «Resistance (любые 2)» выдавался строкой «любые 2» — без единой настоящей
// специализации. Теперь выбор спрашивается тем же диалогом/коллектором, что у
// Навыков, а варианты берутся у Таланта библиотеки.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { anySpecCount, talentSpecOptions, withPickedSpecs } from "../../module/rules/talent-spec-choice.mjs";
import { applyItemMechanics, withMechCollector } from "../../module/apps/mechanics.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

describe("anySpecCount — «на выбор» ли специализация", () => {
  it("«любые N» / «любой 1» / «любая» / «1 любое»", () => {
    expect(anySpecCount("любые 2")).toBe(2);
    expect(anySpecCount("любые 4")).toBe(4);
    expect(anySpecCount("любой 1")).toBe(1);
    expect(anySpecCount("любая")).toBe(1);
    expect(anySpecCount("1 любое")).toBe(1);
  });
  it("конкретная специализация или пусто — не выбор", () => {
    expect(anySpecCount("Cold, Heat")).toBeNull();
    expect(anySpecCount("")).toBeNull();
    expect(anySpecCount(undefined)).toBeNull();
    expect(anySpecCount("3 организации на выбор")).toBeNull();
  });
});

describe("talentSpecOptions — варианты у Таланта библиотеки", () => {
  it("перечень через запятую", () => {
    expect(talentSpecOptions("Cold, Heat, Poison")).toEqual(["Cold", "Heat", "Poison"]);
  });
  it("описанное словами — не перечислимо", () => {
    expect(talentSpecOptions("Любая организация")).toBeNull();
    expect(talentSpecOptions("Для каждого экзотического оружия")).toBeNull();
    expect(talentSpecOptions("")).toBeNull();
  });
  it("Resistance из пака перечисляет все 9 книжных видов", () => {
    const res = packDocuments("talents", "talent").map(d => d.doc).find(d => d._id === "KUrEsT190BtUwtW8");
    expect(talentSpecOptions(res.system.specialization)).toEqual(
      ["Cold", "Blindness", "Deafness", "Disease", "Fear", "Heat", "Poison", "Psychic Powers", "Stun"]);
  });
  it("выбранные ложатся одной записью через запятую, как «Resistance (Cold, Heat)» Огрина", () => {
    expect(withPickedSpecs({ id: "e", specialization: "любые 2" }, ["Cold", "Fear"]).specialization).toBe("Cold, Fear");
  });
});

// ── Сквозной прогон через Конструктор ──────────────────────────────────────

const RESISTANCE_UUID = "Compendium.warhammer-dbc.talents.Item.KUrEsT190BtUwtW8";
const origFromUuid = globalThis.fromUuid;
afterEach(() => { globalThis.fromUuid = origFromUuid; });

function setup(specialization) {
  const created = [];
  const actor = new Actor();
  actor.system = { characteristics: {}, skills: {}, groupSkills: {}, wounds: { max: 10 } };
  actor.update = async () => actor;
  actor.createEmbeddedDocuments = async (_t, docs) => { created.push(...docs); return docs; };
  const flags = { mechanics: [{ id: "g", operator: "AND", entries: [{
    id: "t1", kind: "talent", sourceUuid: RESISTANCE_UUID,
    sourceName: "Resistance / Сопротивление", specialization
  }] }] };
  const item = {
    id: "race-1", type: "race", name: "Репликант", img: "", system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => docs,
    deleteEmbeddedDocuments: async () => []
  };
  const lib = packDocuments("talents", "talent").map(d => d.doc).find(d => d._id === "KUrEsT190BtUwtW8");
  globalThis.fromUuid = async uuid => uuid === RESISTANCE_UUID
    ? { ...lib, toObject: () => structuredClone(lib) } : null;
  return { item, created };
}

describe("Конструктор: Талант «любые N»", () => {
  it("спрашивает 2 из 9 и выдаёт Талант с выбранными специализациями", async () => {
    const { item, created } = setup("любые 2");
    const asked = [];
    const collector = {
      choose: async () => null,
      chooseSpec: async (label, choices, need) => {
        asked.push({ label, need, keys: choices.map(c => c.key) });
        return [choices[0], choices[4]];
      }
    };
    await withMechCollector(collector, () => applyItemMechanics(item));
    expect(asked).toHaveLength(1);
    expect(asked[0].need).toBe(2);
    expect(asked[0].keys).toHaveLength(9);
    const talents = created.filter(d => d.type === "talent");
    expect(talents).toHaveLength(1);
    expect(talents[0].system.specialization).toBe("Cold, Fear");
  });

  it("конкретная специализация — без вопроса, как раньше", async () => {
    const { item, created } = setup("Cold, Heat");
    let askedCount = 0;
    const collector = { choose: async () => null, chooseSpec: async () => { askedCount++; return []; } };
    await withMechCollector(collector, () => applyItemMechanics(item));
    expect(askedCount).toBe(0);
    expect(created.find(d => d.type === "talent").system.specialization).toBe("Cold, Heat");
  });

  it("пропуск выбора — Талант не выдаётся «любые 2» строкой", async () => {
    const { item, created } = setup("любые 2");
    const collector = { choose: async () => null, chooseSpec: async () => [] };
    await withMechCollector(collector, () => applyItemMechanics(item));
    expect(created.filter(d => d.type === "talent")).toHaveLength(0);
  });
});
