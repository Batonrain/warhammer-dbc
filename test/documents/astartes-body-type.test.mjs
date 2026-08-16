// test/documents/astartes-body-type.test.mjs
//
// Астартес могут быть только мужчинами: блок «Телосложение» на вкладке
// «Записи» для этой расы скрыт (шаблон, {{#unless isAstartes}}), а само
// значение принудительно выставляется в prepareDerivedData — иначе у актора,
// которому расу сменили после выбора женской фигуры, на вкладке «ТЕЛО» и в
// Хирургиконе остался бы женский силуэт при спрятанном переключателе.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

/** Персонаж со схемой по умолчанию: расчёт листа без живого документа Foundry. */
function characterWith(patch = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  Object.assign(system, patch);
  const items = Object.assign([], { get: () => null });
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items, getFlag: () => undefined
  });
  return system;
}

describe("Телосложение Астартес", () => {
  it("у Астартес фигура всегда мужская, даже если сохранена женская", () => {
    expect(characterWith({ race: "astartes", bodyType: "female" }).bodyType).toBe("male");
    expect(characterWith({ race: "astartes", bodyType: "other" }).bodyType).toBe("male");
  });

  it("остальным расам выбор оставлен", () => {
    expect(characterWith({ race: "human", bodyType: "female" }).bodyType).toBe("female");
    expect(characterWith({ race: "azuriane", bodyType: "other" }).bodyType).toBe("other");
  });
});
