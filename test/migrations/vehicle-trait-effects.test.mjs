// test/migrations/vehicle-trait-effects.test.mjs
//
// Чистая часть догоняющего прохода Черт техники (wdbc-y33b): добавляются
// только ОТСУТСТВУЮЩИЕ ключи effects, существующие значения не трогаются,
// двуязычное имя пака матчится и целиком, и половинами.

import { describe, it, expect, afterEach } from "vitest";
import { missingEffectKeys, matchTraitDoc, migrateVehicleTraitEffects } from "../../module/migrations/vehicle-trait-effects.mjs";

describe("missingEffectKeys", () => {
  it("добавляет только отсутствующие ключи, существующие значения не трогает", () => {
    const canon   = { amphibious: false, sideHatches: false, spdMod: 0 };
    const current = { spdMod: -2 };
    expect(missingEffectKeys(canon, current)).toEqual({ amphibious: false, sideHatches: false });
  });

  it("всё уже на месте — пустой патч (идемпотентность)", () => {
    const canon = { amphibious: false };
    expect(missingEffectKeys(canon, { amphibious: true })).toEqual({});
  });
});

describe("matchTraitDoc", () => {
  const docs = [{ name: "Side Hatches / Боковые Двери", system: { effects: { sideHatches: false } } }];
  it("матчится целиком и любой половиной двуязычного имени", () => {
    expect(matchTraitDoc("Side Hatches / Боковые Двери", docs)).toBe(docs[0]);
    expect(matchTraitDoc("Боковые Двери", docs)).toBe(docs[0]);
    expect(matchTraitDoc("side hatches", docs)).toBe(docs[0]);
  });
  it("незнакомое имя — null, Черта не трогается", () => {
    expect(matchTraitDoc("Неизвестная", docs)).toBeNull();
  });

  it("рейтинг копии «(4)» матчится с шаблоном «(X)» канона", () => {
    const rated = [{ name: "Демонический (X) / Daemonic (X)", system: { effects: { daemonicAbsorb: true } } }];
    expect(matchTraitDoc("Демонический (4)", rated)).toBe(rated[0]);
    expect(matchTraitDoc("Daemonic (4)", rated)).toBe(rated[0]);
  });
});

describe("смена семантики spdDamageReduce (число → флаг)", () => {
  it("falsy 0 на копии перезаписывается каноном, truthy правка ГМа — нет", () => {
    expect(missingEffectKeys({ spdDamageReduce: true }, { spdDamageReduce: 0 })).toEqual({ spdDamageReduce: true });
    expect(missingEffectKeys({ spdDamageReduce: true }, { spdDamageReduce: true })).toEqual({});
  });
});

// wdbc-059h: цикл по акторам раньше не был защищён ВООБЩЕ (ни общим, ни
// поштучным try/catch) — сбой на одной машине обрывал весь проход и оставлял
// без догонки все машины ПОСЛЕ неё в этом же запуске.
describe("migrateVehicleTraitEffects: изоляция сбоя одного актора (wdbc-059h)", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  const canonDoc = { name: "Side Hatches / Боковые Двери", system: { effects: { sideHatches: false, amphibious: false } } };

  function vehicleWith(id, items, { throwOnUpdate = false } = {}) {
    return {
      id, name: `Машина ${id}`, type: "vehicle", items,
      async updateEmbeddedDocuments(type, updates) {
        if (throwOnUpdate) throw new Error(`boom on ${id}`);
        for (const u of updates) {
          const item = items.find(i => i.id === u._id);
          if (item) {
            for (const [k, v] of Object.entries(u)) {
              if (k === "_id") continue;
              const key = k.replace("system.effects.", "");
              item.system.effects[key] = v;
            }
          }
        }
      }
    };
  }

  const trait = (id) => ({ id, type: "vehicleTrait", name: "Боковые Двери", system: { effects: {} } });

  it("сбой на одном акторе не прерывает догонку остальным (раньше обрывал ВЕСЬ проход)", async () => {
    const bad = vehicleWith("bad", [trait("t1")], { throwOnUpdate: true });
    const good = vehicleWith("good", [trait("t2")]);

    globalThis.game = {
      user: { isGM: true },
      actors: [bad, good],
      scenes: [],
      packs: { get: () => ({ getDocuments: async () => [canonDoc] }) }
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateVehicleTraitEffects();

    expect(res.failed).toBe(1);
    expect(res.patchedActors).toBe(1);
    expect(good.items[0].system.effects).toEqual({ sideHatches: false, amphibious: false });
    expect(bad.items[0].system.effects).toEqual({}); // не тронут, попробуется заново
  });
});
