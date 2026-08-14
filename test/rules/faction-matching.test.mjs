import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { setFactionIndex, clearFactionIndex, actorFactionKeys } from "../../module/rules/factions.mjs";
import { targetMatches, anyTargetMatches, factionTarget, actorTypeTarget, allTarget }
  from "../../module/rules/talent-targets.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";

/** Затравка дерева — та же, что лежит в packs-src/factions. */
const TREE = [
  { key: "chaos" },
  { key: "traitor-legions", parent: "chaos" },
  { key: "word-bearers", parent: "traitor-legions" },
  { key: "word-bearers-host-6", parent: "word-bearers" },
  { key: "word-bearers-host-6-company-3", parent: "word-bearers-host-6" },
  { key: "imperium" }
];

/** Актор с фракциями-предметами: фракция на листе — обычный предмет. */
const actor = (keys = [], over = {}) => ({
  type: "character",
  system: {},
  items: keys.map(key => ({ type: "faction", system: { key } })),
  ...over
});

beforeEach(() => setFactionIndex(TREE));
afterEach(() => clearFactionIndex());

describe("actorFactionKeys", () => {
  it("собирает ключи только с предметов-фракций", () => {
    const a = actor(["chaos"]);
    a.items.push({ type: "talent", system: { key: "не-фракция" } });
    expect(actorFactionKeys(a)).toEqual(["chaos"]);
  });

  it("актор может состоять сразу в нескольких", () => {
    expect(actorFactionKeys(actor(["chaos", "word-bearers"]))).toHaveLength(2);
  });

  it("актора нет — пустой список, а не падение", () => {
    expect(actorFactionKeys(null)).toEqual([]);
  });
});

describe("предикат hasFaction", () => {
  const has = PREDICATES.hasFaction;

  it("нижестоящая подходит под вышестоящую", () => {
    expect(has(actor(["word-bearers-host-6-company-3"]), {}, "chaos")).toBe(true);
  });

  it("вышестоящая под нижестоящую — нет", () => {
    expect(has(actor(["chaos"]), {}, "word-bearers")).toBe(false);
  });

  it("чужая ветка не подходит", () => {
    expect(has(actor(["imperium"]), {}, "chaos")).toBe(false);
  });

  it("список означает «и»", () => {
    const a = actor(["word-bearers", "imperium"]);
    expect(has(a, {}, ["chaos", "imperium"])).toBe(true);
    expect(has(a, {}, ["chaos", "нет-такой"])).toBe(false);
  });

  it("без фракций не подходит никуда", () => {
    expect(has(actor([]), {}, "chaos")).toBe(false);
  });
});

describe("предикат targetHasFaction", () => {
  const tgt = PREDICATES.targetHasFaction;

  it("в бою смотрит на фракции выделенного актора", () => {
    expect(tgt(actor([]), { targetActor: actor(["word-bearers"]) }, "chaos")).toBe(true);
    expect(tgt(actor([]), { targetActor: actor(["imperium"]) }, "chaos")).toBe(false);
  });

  it("в социальном тесте смотрит на выбранную в диалоге фракцию", () => {
    expect(tgt(actor([]), { socialFaction: "word-bearers" }, "chaos")).toBe(true);
    expect(tgt(actor([]), { socialFaction: "imperium" }, "chaos")).toBe(false);
  });

  it("выбор в диалоге важнее выделенного токена: цели у соц-теста нет", () => {
    const ctx = { socialFaction: "imperium", targetActor: actor(["chaos"]) };
    expect(tgt(actor([]), ctx, "chaos")).toBe(false);
  });

  it("ни цели, ни выбора — не срабатывает", () => {
    expect(tgt(actor([]), {}, "chaos")).toBe(false);
  });
});

describe("targetMatches", () => {
  it("фракция: цель-потомок подходит, предок нет", () => {
    const t = factionTarget({ key: "chaos", name: "Хаос" });
    expect(targetMatches(t, { targetActor: actor(["word-bearers"]) })).toBe(true);
    expect(targetMatches(factionTarget({ key: "word-bearers", name: "НС" }),
      { targetActor: actor(["chaos"]) })).toBe(false);
  });

  it("тип существа сравнивается с типом актора цели", () => {
    const t = actorTypeTarget("vehicle", "Техника");
    expect(targetMatches(t, { targetActor: { type: "vehicle", items: [] } })).toBe(true);
    expect(targetMatches(t, { targetActor: actor([]) })).toBe(false);
  });

  it("«Все!» подходит всегда, даже без цели", () => {
    expect(targetMatches(allTarget(), {})).toBe(true);
  });

  it("фракция в социальном тесте берётся из диалога", () => {
    const t = factionTarget({ key: "chaos", name: "Хаос" });
    expect(targetMatches(t, { socialFaction: "word-bearers-host-6" })).toBe(true);
  });

  // У социального теста цели-токена нет: игрок выбирает собеседника в диалоге.
  // Если выделен посторонний токен, он не должен подменять этот выбор.
  it("выбор в диалоге важнее выделенного токена", () => {
    const t = factionTarget({ key: "chaos", name: "Хаос" });
    const ctx = { socialFaction: "imperium", targetActor: actor(["word-bearers"]) };
    expect(targetMatches(t, ctx)).toBe(false);
  });

  it("и наоборот: выбранная фракция срабатывает при постороннем токене", () => {
    const t = factionTarget({ key: "chaos", name: "Хаос" });
    const ctx = { socialFaction: "word-bearers", targetActor: actor(["imperium"]) };
    expect(targetMatches(t, ctx)).toBe(true);
  });
});

describe("anyTargetMatches", () => {
  it("цели соединены через «или»: хватает одной", () => {
    // «Hatred (Тёмный Механикум, Адептус Механикус, Техника)» — один Талант.
    const targets = [
      factionTarget({ key: "chaos", name: "Хаос" }),
      actorTypeTarget("vehicle", "Техника")
    ];
    expect(anyTargetMatches(targets, { targetActor: { type: "vehicle", items: [] } })).toBe(true);
    expect(anyTargetMatches(targets, { targetActor: actor(["word-bearers"]) })).toBe(true);
    expect(anyTargetMatches(targets, { targetActor: actor(["imperium"]) })).toBe(false);
  });

  it("пустой список целей не срабатывает никогда", () => {
    expect(anyTargetMatches([], { targetActor: actor(["chaos"]) })).toBe(false);
  });
});

describe("область social", () => {
  const rule = { id: "r", label: "Связи", effects: [{ kind: "rollBonus", target: "social", value: 10 }] };
  const modsFor = ctx => rollModsFromRules([rule], ctx);

  it("действует на социальные навыки книги", () => {
    for (const skill of ["charm", "command", "commerce", "deceive", "inquiry", "interrogate", "intimidate"])
      expect(modsFor({ kind: "skill", skill }), skill).toHaveLength(1);
  });

  it("не действует на несоциальный навык", () => {
    expect(modsFor({ kind: "skill", skill: "athletics" })).toHaveLength(0);
  });

  it("Проницательность в книге не социальная — и здесь тоже", () => {
    expect(modsFor({ kind: "skill", skill: "scrutiny" })).toHaveLength(0);
  });

  it("не действует на тест характеристики и на атаку", () => {
    expect(modsFor({ kind: "skill", char: "fel" })).toHaveLength(0);
    expect(modsFor({ kind: "attack", isMelee: true })).toHaveLength(0);
  });
});
