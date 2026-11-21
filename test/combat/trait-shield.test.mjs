// test/combat/trait-shield.test.mjs
//
// Встроенные щиты Черт (module/combat/trait-shield.mjs): Щит Рубрики и
// щит-купол Тела Из Плотеметалла Облитератора (Sahara 576-51a6). Черты —
// настоящие документы packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  TRAIT_SHIELDS, traitShieldSpec, traitShieldData, traitShieldPlan, syncTraitShields, needsTraitShieldSync
} from "../../module/combat/trait-shield.mjs";
import { traitShieldsOutOfSync } from "../../module/migrations/trait-shields.mjs";

const NS = "warhammer-dbc";
const FLESHMETAL = packDocById("packs-src/traits/Элитные_архетипы/Облитератор", "IN7kanX4lipRnZ9J");
const RUBRIC = packDocById("packs-src/traits/Элитные_архетипы/Колдун_Рубрики", "A0mnKWWoZCWS3rMv");
const FLESH_SPEC = traitShieldSpec("fleshmetalShield");

let seq = 0;
const itemOf = doc => {
  const flags = { ...(doc.flags ?? {}) };
  return { id: `i${++seq}`, type: doc.type, name: doc.name, system: { ...(doc.system ?? {}) }, flags,
    getFlag: (s, k) => flags[s]?.[k] };
};

function actorOf(items = []) {
  const list = [...items];
  const self = {
    id: `a${++seq}`, isOwner: true, items: list, created: [],
    createEmbeddedDocuments: async (kind, docs) => {
      await Promise.resolve();
      for (const d of docs) { self.created.push(d); list.push(itemOf(d)); }
      return docs;
    },
    deleteEmbeddedDocuments: async (kind, ids) => {
      for (const id of ids) list.splice(list.findIndex(i => i.id === id), 1);
      return ids;
    }
  };
  return self;
}

describe("Встроенный щит Тела Из Плотеметалла", () => {
  it("в реестре: технологический купол 1-50", () => {
    expect(FLESH_SPEC).toBeTruthy();
    const d = traitShieldData(FLESH_SPEC);
    expect(d.type).toBe("forcefield");
    expect(d.system).toEqual(expect.objectContaining({
      shieldNature: "technological", shieldType: "dome", ratingMin: 1, ratingMax: 50,
      overloadThreshold: 0, currentRating: 50, status: "active", equipped: true
    }));
    expect(d.flags[NS].fleshmetalShield).toBe(true);
  });

  it("Черта есть — щит создаётся один раз; Черту сняли — щит уходит", async () => {
    const trait = itemOf(FLESHMETAL);
    const a = actorOf([trait]);
    expect(needsTraitShieldSync(a)).toBe(true);
    expect(traitShieldsOutOfSync(a)).toBe(true);
    await Promise.all([syncTraitShields(a), syncTraitShields(a), syncTraitShields(a)]);
    expect(a.created.map(c => c.name)).toEqual(["Fleshmetal Shield / Щит Плотеметалла"]);
    expect(traitShieldsOutOfSync(a)).toBe(false);
    a.items.splice(a.items.indexOf(trait), 1);
    expect(traitShieldPlan(a, FLESH_SPEC).remove).toHaveLength(1);
    await syncTraitShields(a);
    expect(a.items.filter(i => i.type === "forcefield")).toHaveLength(0);
  });

  it("Талант Fleshmetal Механикума щита не даёт", () => {
    const a = actorOf([itemOf({ type: "talent", name: "Fleshmetal / Плотеметалл", system: {} })]);
    expect(needsTraitShieldSync(a)).toBe(false);
  });

  it("Колдун Рубрики и Облитератор в одном лице — два разных щита", async () => {
    const a = actorOf([itemOf(FLESHMETAL), itemOf(RUBRIC)]);
    await syncTraitShields(a);
    expect(a.created.map(c => c.system.shieldNature).sort()).toEqual(["technological", "warp"]);
    expect(TRAIT_SHIELDS).toHaveLength(2);
  });
});
