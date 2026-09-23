// test/documents/parasite-fusion-derived.test.mjs
//
// Слияние с Паразитом (core, Трейт Parasite): «хост действует в Инициативу
// паразита и использует его I, P и W, а если его WS или BS ниже — то также и
// их». I здесь — Интеллект: книга пишет Характеристики как «WS, BS, S, T, A,
// I, P, W, F». wdbc-bjy1.4: раньше подменялся только .total в самом хвосте
// пересчёта, а Бонусы, Навыки и Здравомыслие к тому времени уже были
// посчитаны от хозяйских чисел. Проверка — через prepareDerivedData, чтобы
// видеть именно то, что доезжает до листа и бросков.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { POSSESSED_BY_PARASITE_FLAG } from "../../module/rules/parasite-trait.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

const FLAG = "warhammer-dbc";

function host(base) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const [k, v] of Object.entries(base)) system.characteristics[k].base = v;
  const items = [];
  items.get = () => null;
  const flags = { [POSSESSED_BY_PARASITE_FLAG]: "Actor.parasite" };
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Хозяин", system, items,
    flags: { [FLAG]: flags },
    getFlag: (scope, key) => (scope === FLAG ? flags[key] : undefined)
  });
  return system;
}

const parasite = {
  system: {
    initiative: 9,
    characteristics: {
      int: { total: 55, bonus: 5 }, per: { total: 47, bonus: 4 }, wp: { total: 63, bonus: 8 },
      ws: { total: 20, bonus: 2 }, bs: { total: 51, bonus: 5 }
    }
  }
};

describe("Слияние с Паразитом доезжает до производных чисел", () => {
  afterEach(() => { delete globalThis.fromUuidSync; });

  it("Int/Per/WP — числа и Бонусы паразита, включая его Unnatural", () => {
    globalThis.fromUuidSync = uuid => (uuid === "Actor.parasite" ? parasite : null);
    const s = host({ int: 25, per: 25, wp: 25, ws: 40, bs: 30 });
    const c = s.characteristics;
    expect([c.int.total, c.per.total, c.wp.total]).toEqual([55, 47, 63]);
    expect([c.int.bonus, c.per.bonus, c.wp.bonus]).toEqual([5, 4, 8]);
  });

  it("WS/BS — лучший из двух, вместе с Бонусом", () => {
    globalThis.fromUuidSync = uuid => (uuid === "Actor.parasite" ? parasite : null);
    const c = host({ int: 25, per: 25, wp: 25, ws: 40, bs: 30 }).characteristics;
    expect([c.ws.total, c.ws.bonus]).toEqual([40, 4]);   // свой выше
    expect([c.bs.total, c.bs.bonus]).toEqual([51, 5]);   // паразита выше
  });

  it("Здравомыслие и Навык на Воле считаются от Воли паразита", () => {
    globalThis.fromUuidSync = () => null;
    const own = host({ wp: 25 });
    globalThis.fromUuidSync = uuid => (uuid === "Actor.parasite" ? parasite : null);
    const fused = host({ wp: 25 });
    expect(fused.sanity.max).toBeGreaterThan(own.sanity.max);
    const key = Object.keys(fused.skills).find(k => SKILLS_DEF[k]?.char === "wp");
    expect(key).toBeTruthy();
    expect(fused.skills[key].total - own.skills[key].total).toBe(63 - 25);
    expect(fused.initiative).toBe(9);
  });
});
