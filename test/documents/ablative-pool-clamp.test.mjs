// test/documents/ablative-pool-clamp.test.mjs
//
// Аблативные Раны (wdbc-smy7) — пул живёт ТОЛЬКО пока жив его источник.
// ablativeMax приходит ActiveEffect'ом записи Конструктора (kind:"poolMax",
// poolTarget:"ablativeWounds"), а такая запись может отключиться в любой
// момент: гейт по Ярости (entry.when.requireRage), снятая Мутация, истёкший
// эффект. Само по себе ablativeMax → 0 не обнуляет НАКОПЛЕННЫЙ пул в
// хранимых данных, поэтому клампим на производных, как sanity.value чуть
// выше по rules/character.mjs — иначе пул продолжает поглощать урон
// (rules/wounds.mjs), а обратно не записывается (ветка ablativeMax > 0),
// то есть поглощает бесконечно.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ ablative = 0, ablativeMax = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.wounds.ablative = ablative;
  system.wounds.ablativeMax = ablativeMax;
  const list = [];
  list.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("аблативный пул не переживает свой источник", () => {
  it("источник пропал (ablativeMax 0) — накопленный пул обнуляется", () => {
    expect(characterWith({ ablative: 10, ablativeMax: 0 }).wounds.ablative).toBe(0);
  });

  it("максимум просел — пул срезается до нового максимума", () => {
    expect(characterWith({ ablative: 10, ablativeMax: 4 }).wounds.ablative).toBe(4);
  });

  it("в пределах максимума — не трогает", () => {
    expect(characterWith({ ablative: 3, ablativeMax: 10 }).wounds.ablative).toBe(3);
  });
});
