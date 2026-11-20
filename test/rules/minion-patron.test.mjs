// test/rules/minion-patron.test.mjs
//
// Посвящение (Dedication): Покровитель Миньона ставится по божественному
// Трейту демонов (rules/minion-patron.mjs); поле system.patronGod есть в схеме Миньона.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { patronGodFromTrait, minionPatronUpdate } from "../../module/rules/minion-patron.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const trait = name => ({ type: "trait", name, system: {} });

describe("Покровитель Миньона", () => {
  it("божественные Трейты → Бог", () => {
    expect(patronGodFromTrait(trait("Blood for the Blood God / Кровь Богу Крови"))).toBe("khorne");
    expect(patronGodFromTrait(trait("Mockery of Life / Насмешка Над Жизнью"))).toBe("nurgle");
    expect(patronGodFromTrait(trait("Alluring Presence / Чарующее Присутствие"))).toBe("slaanesh");
    expect(patronGodFromTrait(trait("Sorcerous Barrier / Чародейский Барьер"))).toBe("tzeentch");
    expect(patronGodFromTrait(trait("Fear (2) / Страх (2)"))).toBe("");
  });
  it("ставится только Миньону и только если Бог ещё не выбран", () => {
    const t = trait("Mockery of Life / Насмешка Над Жизнью");
    expect(minionPatronUpdate({ type: "minion", system: { patronGod: "" } }, t)).toEqual({ "system.patronGod": "nurgle" });
    expect(minionPatronUpdate({ type: "minion", system: { patronGod: "khorne" } }, t)).toBe(null);
    expect(minionPatronUpdate({ type: "character", system: { patronGod: "" } }, t)).toBe(null);
  });
  it("в схеме Миньона есть поле Покровителя", () => {
    expect(new ACTOR_DATA_MODELS.minion({}).toObject()).toHaveProperty("patronGod", "");
  });
});
