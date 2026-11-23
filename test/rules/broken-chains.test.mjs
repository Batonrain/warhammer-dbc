// test/rules/broken-chains.test.mjs
//
// Порванные Цепи (Дикий Псайкер, module/rules/wild-psyker-talents.mjs):
// +3 бPR поверх Таланта Psy Rating, запрет жёсткой и силовой брони, иммунитет
// к Haywire (запись Конструктора и опознание старых копий по имени).
// Черта — настоящий документ packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { brokenChainsPrBonus, brokenChainsArmourBan, BROKEN_CHAINS_PR } from "../../module/rules/wild-psyker-talents.mjs";
import { hasWeaponPropertyImmunity } from "../../module/combat/weapon-properties.mjs";
import { prepareFinalPools } from "../../module/rules/character/final-pools.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const CHAINS = packDocById("packs-src/traits/Элитные_архетипы/Дикий_Псайкер", "EEOk1eZQiJi2VRdY");

let seq = 0;
const itemOf = doc => ({ id: `i${++seq}`, type: doc.type, name: doc.name, system: { ...(doc.system ?? {}) },
  flags: doc.flags ?? {}, getFlag: (s, k) => doc.flags?.[s]?.[k] });
const actorOf = items => ({ items, system: {}, flags: {}, getFlag: () => undefined });

describe("Порванные Цепи", () => {
  it("+3 бPR носителю Черты, остальным 0", () => {
    expect(BROKEN_CHAINS_PR).toBe(3);
    expect(brokenChainsPrBonus(actorOf([itemOf(CHAINS)]))).toBe(3);
    expect(brokenChainsPrBonus(actorOf([]))).toBe(0);
  });

  it("жёсткую и силовую броню надеть нельзя, лёгкую — можно", () => {
    const a = actorOf([itemOf(CHAINS)]);
    expect(brokenChainsArmourBan(a, { type: "armor", system: { armorType: "power" } })).toContain("силовую");
    expect(brokenChainsArmourBan(a, { type: "armor", system: { properties: ["hard"] } })).toContain("жёсткую");
    expect(brokenChainsArmourBan(a, { type: "armor", system: { armorType: "flak", properties: [] } })).toBe("");
    expect(brokenChainsArmourBan(actorOf([]), { type: "armor", system: { armorType: "power" } })).toBe("");
  });

  it("иммунитет к Haywire — запись Конструктора на Черте", () => {
    const keys = CHAINS.flags["warhammer-dbc"].mechanics.flatMap(b => b.entries).map(e => e.capabilityKey).filter(Boolean);
    expect(keys).toContain("weaponPropertyImmunity.haywire");
    // старая копия без записи — по имени
    const old = itemOf({ ...CHAINS, flags: {} });
    expect(hasWeaponPropertyImmunity(actorOf([old]), "haywire")).toBe(true);
  });

  it("лист: бPR = Талант Psy Rating + 3", () => {
    const pr = items => {
      const system = new ACTOR_DATA_MODELS.character({}).toObject();
      system.isPsyker = true;
      const a = { items, system, flags: {}, getFlag: () => undefined, type: "character" };
      prepareFinalPools(a, system, { chars: system.characteristics, agBonus: 3, traitInitMod: 0 });
      return system.psyker.rating;
    };
    const talent = itemOf({ type: "talent", name: "Psy Rating / Пси-Рейтинг", system: { rating: 2, hasRating: true } });
    expect(pr([talent])).toBe(2);
    expect(pr([talent, itemOf(CHAINS)])).toBe(5);
  });
});
