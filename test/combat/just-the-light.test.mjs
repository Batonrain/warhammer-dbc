// test/combat/just-the-light.test.mjs
//
// Just the Light / Лишь Свет (wdbc-1rno, harlequin.solitaire.justTheLight):
// весь прошлый Ход ушёл на движение → щит-дефлектор A.b×3 до начала
// следующего Хода. module/combat/just-the-light.mjs.

import { describe, it, expect } from "vitest";
import { hasJustTheLight, processJustTheLightTurnEnd, justTheLightReduction } from "../../module/combat/just-the-light.mjs";

function actorWith({ names = [], moved = false, ap = 0, agBonus = 0, type = "character", justTheLightActive = false } = {}) {
  const flags = { "warhammer-dbc.movedThisTurn": moved || undefined, "warhammer-dbc.justTheLightActive": justTheLightActive || undefined };
  const a = {
    type,
    items: names.map(name => ({ type: "talent", name })),
    system: { actionPoints: { value: ap, max: 2 }, characteristics: { ag: { bonus: agBonus } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  return a;
}

describe("hasJustTheLight", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasJustTheLight(actorWith({ names: ["Just the Light / Лишь Свет"] }))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasJustTheLight(actorWith({ names: ["Dodge"] }))).toBe(false);
  });
});

describe("processJustTheLightTurnEnd", () => {
  it("двигался и дожёг ОД до 0 — ставит флаг щита", async () => {
    const actor = actorWith({ names: ["Just the Light / Лишь Свет"], moved: true, ap: 0 });
    await processJustTheLightTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "justTheLightActive")).toBe(true);
  });

  it("двигался, но остались ОД — флаг не ставится", async () => {
    const actor = actorWith({ names: ["Just the Light / Лишь Свет"], moved: true, ap: 1 });
    await processJustTheLightTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "justTheLightActive")).toBeUndefined();
  });

  it("не двигался вовсе, хоть ОД и на нуле — флаг не ставится", async () => {
    const actor = actorWith({ names: ["Just the Light / Лишь Свет"], moved: false, ap: 0 });
    await processJustTheLightTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "justTheLightActive")).toBeUndefined();
  });

  it("нет Таланта — флаг не ставится", async () => {
    const actor = actorWith({ names: ["Dodge"], moved: true, ap: 0 });
    await processJustTheLightTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "justTheLightActive")).toBeUndefined();
  });

  it("тип актора без экономики действий — не падает, флаг не ставится", async () => {
    const actor = actorWith({ names: ["Just the Light / Лишь Свет"], moved: true, ap: 0, type: "npc" });
    await processJustTheLightTurnEnd(actor);
    expect(actor.getFlag("warhammer-dbc", "justTheLightActive")).toBeUndefined();
  });

  it("нет актора — не падает", async () => {
    await expect(processJustTheLightTurnEnd(null)).resolves.toBeUndefined();
  });
});

describe("justTheLightReduction", () => {
  it("флаг активен — возвращает A.b×3", () => {
    const actor = actorWith({ agBonus: 4, justTheLightActive: true });
    expect(justTheLightReduction(actor)).toBe(12);
  });

  it("флаг не активен — 0", () => {
    const actor = actorWith({ agBonus: 4, justTheLightActive: false });
    expect(justTheLightReduction(actor)).toBe(0);
  });

  it("нет актора — 0, не падает", () => {
    expect(justTheLightReduction(null)).toBe(0);
  });
});
