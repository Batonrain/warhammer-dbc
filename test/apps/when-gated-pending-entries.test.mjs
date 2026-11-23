// 5-c24e: Чемпион-Терминатор получает броню в рюкзак, и записи с «Когда» от
// Терминаторской брони (ИЛИ-выбор +5, Черты) при выдаче пропускаются. Надели
// броню — hasPendingWhenEntries видит недоигранное, хук доигрывает его.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { hasPendingWhenEntries } from "../../module/apps/mechanics.mjs";

const armour = (equipped) => ({ type: "armor", name: "Terminator Aegis / Терминатор Эгида", system: { equipped }, effects: [] });
const TERM = { predicates: { wearsTerminatorArmour: true } };

function archetype(actor, applied = []) {
  const mechanics = [
    { id: "g1", operator: "OR", entries: [
      { id: "ws", kind: "characteristic", charKey: "ws", field: "value", op: "add", value: 5, when: TERM },
      { id: "bs", kind: "characteristic", charKey: "bs", field: "value", op: "add", value: 5, when: TERM }
    ] },
    { id: "g2", operator: "AND", entries: [
      { id: "gear", kind: "equipment", name: "Terminator Aegis" },
      { id: "giant", kind: "trait", name: "Graceful Giant", when: TERM }
    ] }
  ];
  return {
    id: "arch", uuid: "Actor.a.Item.arch", type: "eliteArchetype", name: "Чемпион-Терминатор", system: {}, parent: actor,
    effects: [], getFlag: (_s, k) => (k === "mechanics" ? mechanics : k === "mechanicsApplied" ? applied : undefined)
  };
}

describe("hasPendingWhenEntries", () => {
  it("броня в рюкзаке — доигрывать нечего (условие не выполнено)", () => {
    const actor = new Actor();
    actor.items = [armour(false)];
    expect(hasPendingWhenEntries(archetype(actor, ["gear"]))).toBe(false);
  });

  it("надели броню — пропущенные ИЛИ-выбор и Черта ждут выдачи", () => {
    const actor = new Actor();
    actor.items = [armour(true)];
    expect(hasPendingWhenEntries(archetype(actor, ["gear"]))).toBe(true);
  });

  it("всё уже выдано — повторно не трогаем", () => {
    const actor = new Actor();
    actor.items = [armour(true)];
    expect(hasPendingWhenEntries(archetype(actor, ["gear", "ws", "giant"]))).toBe(false);
  });
});
