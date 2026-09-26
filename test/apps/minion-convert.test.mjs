// test/apps/minion-convert.test.mjs
//
// wdbc-v99a: «Превратить в Миньона» — дубль актора типа minion. Счётная часть
// (minionCreateDataFrom) проверяется на настоящей схеме Миньона: то, что
// переехало, должно в ней уцелеть.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { minionCreateDataFrom, MINION_CONVERTIBLE_TYPES } from "../../module/apps/minion-convert.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const character = () => {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ws.base = 41;
  system.characteristics.ws.advance = 10;
  system.wounds.max = 14;
  system.wounds.value = 9;
  system.skills.dodge.rank = "known";
  system.bodyType = "female";
  return { name: "Гвардеец", type: "character", img: "x.png", uuid: "Actor.abc", system };
};

describe("minionCreateDataFrom", () => {
  it("тип minion, isMinion и метка источника", () => {
    const d = minionCreateDataFrom(character());
    expect(d.type).toBe("minion");
    expect(d.system.isMinion).toBe(true);
    expect(d.flags["warhammer-dbc"].minionSource).toEqual({ uuid: "Actor.abc", name: "Гвардеец", type: "character" });
  });

  it("характеристики, Раны, навыки и Телосложение уцелевают в схеме Миньона", () => {
    const d = minionCreateDataFrom(character());
    const m = new ACTOR_DATA_MODELS.minion(d.system).toObject();
    expect(m.characteristics.ws.base).toBe(41);
    expect(m.characteristics.ws.advance).toBe(10);
    expect(m.wounds).toEqual(expect.objectContaining({ max: 14, value: 9 }));
    expect(m.skills.dodge.rank).toBe("known");
    expect(m.bodyType).toBe("female");
  });

  it("слот Таланта Хозяина не наследуется, оригинал не меняется", () => {
    const src = character();
    src.system.slotTalentId = "T1";
    const d = minionCreateDataFrom(src);
    expect(d.system.slotTalentId).toBe("");
    expect(src.system.slotTalentId).toBe("T1");
  });

  it("становиться Миньоном умеют существа с общей схемой", () => {
    expect(MINION_CONVERTIBLE_TYPES).toEqual(["character", "daemon", "demonPrince"]);
  });
});
