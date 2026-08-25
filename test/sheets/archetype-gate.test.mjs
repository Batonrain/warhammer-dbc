// test/sheets/archetype-gate.test.mjs
//
// Талант из дерева «Дополнительных Талантов» Элитного архетипа несёт гейт в
// system.specialization («Элитный архетип: X»), а не в system.requirement —
// без archetypeGateOk пикер это поле не читал вовсе, и персонаж без архетипа
// мог купить любой его Талант.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { archetypeGateOk } from "../../module/sheets/item-picker.mjs";

const actorWith = (names = []) => ({
  items: names.map(name => ({ type: "eliteArchetype", name }))
});

describe("archetypeGateOk", () => {
  it("не гейт архетипа (обычное требование Таланта) — null, ни к чему не относится", () => {
    expect(archetypeGateOk(actorWith([]), "")).toBeNull();
    expect(archetypeGateOk(actorWith([]), "WS, BS")).toBeNull();
    expect(archetypeGateOk(actorWith([]), undefined)).toBeNull();
  });

  it("гейт есть, архетипа у актора нет — false", () => {
    const actor = actorWith(["Corsair Prince / Барон Корсаров"]);
    expect(archetypeGateOk(actor, "Элитный архетип: Felarch / Феларх")).toBe(false);
  });

  it("гейт есть, архетип взят — true (сверка по английской половине имени)", () => {
    const actor = actorWith(["Felarch / Феларх"]);
    expect(archetypeGateOk(actor, "Элитный архетип: Felarch / Феларх")).toBe(true);
  });

  it("не чувствителен к регистру и к префиксу [WIP]", () => {
    const actor = actorWith(["[WIP] Felarch / Феларх"]);
    expect(archetypeGateOk(actor, "Элитный архетип: felarch / Феларх")).toBe(true);
  });

  it("другой архетип с тем же актором не проходит", () => {
    const actor = actorWith(["Felarch / Феларх"]);
    expect(archetypeGateOk(actor, "Элитный архетип: Corsair Prince / Барон Корсаров")).toBe(false);
  });

  it("58 старых архетипов пишут только русскую половину — тоже проходит", () => {
    const actor = actorWith(["Archmage / Архимаг"]);
    expect(archetypeGateOk(actor, "Элитный архетип: Архимаг")).toBe(true);
  });

  it("русская специализация без взятого архетипа — false, не null", () => {
    const actor = actorWith(["Felarch / Феларх"]);
    expect(archetypeGateOk(actor, "Элитный архетип: Архимаг")).toBe(false);
  });
});
