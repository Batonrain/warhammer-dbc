import { describe, it, expect } from "vitest";
import { PREDICATES } from "../../module/rules/predicates.mjs";

/** Подставной актор: обычный литерал, никакого Foundry. */
const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: {}, ...system },
  items
});

const talent = name => ({ type: "talent", name });
const trait  = name => ({ type: "trait",  name });
const chars  = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { total: v }]));

describe("race", () => {
  const race = PREDICATES.race;

  it("раса актора есть в списке", () => {
    expect(race(actor({ race: "astartes" }), {}, ["astartes", "human"])).toBe(true);
  });

  it("раса актора вне списка", () => {
    expect(race(actor({ race: "human" }), {}, ["astartes"])).toBe(false);
  });

  it("одиночное значение читается как список из одного", () => {
    expect(race(actor({ race: "human" }), {}, "human")).toBe(true);
  });
});

describe("subrace", () => {
  it("субраса актора есть в списке", () => {
    expect(PREDICATES.subrace(actor({ subrace: "navigator" }), {}, ["navigator"])).toBe(true);
  });

  it("субраса не задана", () => {
    expect(PREDICATES.subrace(actor(), {}, ["navigator"])).toBe(false);
  });
});

describe("sizeMax", () => {
  const sizeMax = PREDICATES.sizeMax;

  it("Размер по умолчанию нулевой", () => {
    expect(sizeMax(actor(), {}, 1)).toBe(true);
  });

  it("вклад Черт учитывается", () => {
    expect(sizeMax(actor({ sizeMod: 2 }), {}, 1)).toBe(false);
  });

  it("базовый Размер складывается с вкладом Черт", () => {
    expect(sizeMax(actor({ size: 1, sizeMod: 1 }), {}, 1)).toBe(false);
  });

  it("готовый sizeTotal с листа берётся как есть", () => {
    expect(sizeMax(actor({ size: 1, sizeMod: 1, sizeTotal: 1 }), {}, 1)).toBe(true);
  });
});

describe("geneSeedLegion", () => {
  const geneSeedLegion = PREDICATES.geneSeedLegion;

  it("легион актора есть в списке", () => {
    expect(geneSeedLegion(actor({ geneSeed: { legion: "VIII" } }), {}, ["VIII"])).toBe(true);
  });

  it("легион актора вне списка", () => {
    expect(geneSeedLegion(actor({ geneSeed: { legion: "I" } }), {}, ["VIII"])).toBe(false);
  });

  it("Геносемени нет вовсе", () => {
    expect(geneSeedLegion(actor(), {}, ["VIII"])).toBe(false);
  });
});

describe("psyRatingMin", () => {
  const psyRatingMin = PREDICATES.psyRatingMin;

  it("рейтинг не ниже порога", () => {
    expect(psyRatingMin(actor({ psyker: { rating: 3 } }), {}, 1)).toBe(true);
  });

  it("рейтинг ниже порога", () => {
    expect(psyRatingMin(actor({ psyker: { rating: 0 } }), {}, 1)).toBe(false);
  });

  it("Пси-Рейтинга нет вовсе — как ноль", () => {
    expect(psyRatingMin(actor(), {}, 1)).toBe(false);
  });
});

describe("woundTier", () => {
  const woundTier = PREDICATES.woundTier;
  const withTier = tier => actor({ wounds: { tier } });

  it("тир актора есть в списке", () => {
    expect(woundTier(withTier("heavy"), {}, ["heavy", "dying"])).toBe(true);
  });

  it("тир актора вне списка", () => {
    expect(woundTier(withTier("healthy"), {}, ["heavy", "dying"])).toBe(false);
  });

  it("одиночное значение читается как список из одного", () => {
    expect(woundTier(withTier("dying"), {}, "dying")).toBe(true);
  });

  it("тир не посчитан (нет system.wounds.tier) — не проходит", () => {
    expect(woundTier(actor(), {}, ["healthy"])).toBe(false);
  });
});

describe("charMin", () => {
  const charMin = PREDICATES.charMin;

  it("все пороги пройдены", () => {
    expect(charMin(actor({ characteristics: chars({ s: 45, t: 40 }) }), {}, { s: 40, t: 40 })).toBe(true);
  });

  it("один порог не пройден", () => {
    expect(charMin(actor({ characteristics: chars({ s: 45, t: 35 }) }), {}, { s: 40, t: 40 })).toBe(false);
  });

  it("отсутствующая характеристика считается нулём", () => {
    expect(charMin(actor(), {}, { s: 1 })).toBe(false);
  });
});

describe("hasTalent и hasTrait", () => {
  const soldier = actor({ items: [
    talent("Nerves of Steel / Стальные Нервы"),
    talent("Resistance (Cold) / Сопротивление (Холод)"),
    trait("Gene-Seed / Геносемя")
  ] });

  it("имя ищется по английской половине", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Nerves of Steel")).toBe(true);
  });

  it("имя ищется и по русской половине", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Стальные Нервы")).toBe(true);
  });

  it("специализация в скобках при сравнении отбрасывается", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Resistance")).toBe(true);
  });

  it("чужой Талант не находится", () => {
    expect(PREDICATES.hasTalent(soldier, {}, "Frenzy")).toBe(false);
  });

  it("список требует все имена сразу", () => {
    expect(PREDICATES.hasTalent(soldier, {}, ["Nerves of Steel", "Gene-Seed"])).toBe(true);
    expect(PREDICATES.hasTalent(soldier, {}, ["Nerves of Steel", "Frenzy"])).toBe(false);
  });

  it("hasTrait находит Черту", () => {
    expect(PREDICATES.hasTrait(soldier, {}, "Геносемя")).toBe(true);
  });

  it("предметы других типов не считаются", () => {
    expect(PREDICATES.hasTrait(actor({ items: [{ type: "weapon", name: "Gene-Seed" }] }), {}, "Gene-Seed")).toBe(false);
  });
});

describe("weaponClass", () => {
  const bolter = { system: { weaponClass: "basic" } };

  it("класс оружия из контекста есть в списке", () => {
    expect(PREDICATES.weaponClass(actor(), { weapon: bolter }, ["basic", "heavy"])).toBe(true);
  });

  it("класс оружия вне списка", () => {
    expect(PREDICATES.weaponClass(actor(), { weapon: bolter }, ["melee"])).toBe(false);
  });

  it("оружия в контексте нет", () => {
    expect(PREDICATES.weaponClass(actor(), {}, ["melee"])).toBe(false);
  });
});

describe("targetHasTrait", () => {
  it("у цели есть такая Черта", () => {
    const targetActor = actor({ items: [trait("Daemonic / Демонический")] });
    expect(PREDICATES.targetHasTrait(actor(), { targetActor }, "Daemonic")).toBe(true);
  });

  it("цели нет в контексте", () => {
    expect(PREDICATES.targetHasTrait(actor(), {}, "Daemonic")).toBe(false);
  });

  // ctx.target в контексте броска — флаг «бросок нацелен» (rules/match-context.mjs),
  // а не актор. Предикат не должен принимать его за цель.
  it("флаг ctx.target целью не считается", () => {
    expect(PREDICATES.targetHasTrait(actor(), { target: true }, "Daemonic")).toBe(false);
  });
});

describe("targetKeepsNimbleInArmour", () => {
  const armor = (armorType, equipped = true) => ({ type: "armor", system: { armorType, equipped } });
  const blackCarapace = (installed = true) => ({
    type: "implant", name: "19. Чёрный Панцирь / Black Carapace",
    flags: { "warhammer-dbc": { installed } }
  });

  it("нет силовой брони — условие не проверяется, штраф остаётся", () => {
    const targetActor = actor({ items: [armor("flak")] });
    expect(PREDICATES.targetKeepsNimbleInArmour(actor(), { targetActor })).toBe(true);
  });

  it("силовая броня без Чёрного Панциря гасит Nimble", () => {
    const targetActor = actor({ items: [armor("power")] });
    expect(PREDICATES.targetKeepsNimbleInArmour(actor(), { targetActor })).toBe(false);
  });

  it("силовая броня с установленным Чёрным Панцирем — Nimble сохраняется", () => {
    const targetActor = actor({ items: [armor("power"), blackCarapace(true)] });
    expect(PREDICATES.targetKeepsNimbleInArmour(actor(), { targetActor })).toBe(true);
  });

  it("Чёрный Панцирь не установлен (лежит в инвентаре) — не считается", () => {
    const targetActor = actor({ items: [armor("power"), blackCarapace(false)] });
    expect(PREDICATES.targetKeepsNimbleInArmour(actor(), { targetActor })).toBe(false);
  });

  it("снятая силовая броня штраф не гасит", () => {
    const targetActor = actor({ items: [armor("power", false)] });
    expect(PREDICATES.targetKeepsNimbleInArmour(actor(), { targetActor })).toBe(true);
  });
});

describe("hasSize и targetHasSize", () => {
  it("нулевой Размер — false", () => {
    expect(PREDICATES.hasSize(actor())).toBe(false);
    expect(PREDICATES.targetHasSize(actor(), { targetActor: actor() })).toBe(false);
  });

  it("ненулевой Размер — true", () => {
    expect(PREDICATES.hasSize(actor({ sizeMod: 1 }))).toBe(true);
    expect(PREDICATES.targetHasSize(actor(), { targetActor: actor({ sizeMod: 1 }) })).toBe(true);
  });
});

describe("общее требование к предикатам", () => {
  const value = {
    race: ["human"], subrace: ["navigator"], geneSeedLegion: ["VIII"], psyRatingMin: 1,
    sizeMax: 1, charMin: { s: 40 },
    woundTier: ["heavy"],
    hasTalent: "Frenzy", hasTrait: "Gene-Seed", weaponClass: ["melee"],
    targetHasTrait: "Daemonic", targetLacksCondition: "stunned",
    hasSize: undefined, targetHasSize: undefined, targetKeepsNimbleInArmour: undefined,
    // Принадлежность к фракции — своя и у цели (дерево фракций).
    hasFaction: "chaos", targetHasFaction: "chaos",
    // Метка Avatar of Slaughter/Аватар Резни (wdbc-sk8s) — читает флаг самого
    // актора, значение из `when` не участвует.
    avatarOfSlaughterOffTarget: undefined
  };

  it("на пустом акторе каждый возвращает строго true или false", () => {
    for (const [key, fn] of Object.entries(PREDICATES)) {
      expect(typeof fn({}, {}, value[key]), key).toBe("boolean");
    }
  });

  it("реестр совпадает со справочником: ни лишних условий, ни забытых", () => {
    expect(Object.keys(PREDICATES).sort()).toEqual(Object.keys(value).sort());
  });
});

// ── Общие предикаты листа: Элитный архетип и Одержимый ──────────────────────
import { hasEliteArchetype, isPossessed, giftNamesOf, GIFT_NAME_PREFIX } from "../../module/rules/predicates.mjs";

describe("hasEliteArchetype — три источника, двуязычные имена", () => {
  const actor = ({ elite = "", extra = [], items = [] } = {}) =>
    ({ system: { eliteArchetype: elite, eliteArchetypesExtra: extra }, items });

  it("строка в шапке, список дополнительных, предмет", () => {
    expect(hasEliteArchetype(actor({ elite: "Чернокнижник" }), "Чернокнижник")).toBe(true);
    expect(hasEliteArchetype(actor({ extra: ["Одержимый"] }), "Одержимый")).toBe(true);
    expect(hasEliteArchetype(actor({ items: [{ type: "eliteArchetype", name: "Sorcerer / Чернокнижник" }] }), "Чернокнижник")).toBe(true);
  });

  it("чужое имя и пустой актор — false", () => {
    expect(hasEliteArchetype(actor(), "Чернокнижник")).toBe(false);
    expect(hasEliteArchetype(null, "Чернокнижник")).toBe(false);
  });
});

describe("isPossessed — один предикат на вкладку и на пикер Даров", () => {
  it("чекбокс Хаосита", () => {
    expect(isPossessed({ system: { alignment: "heretic", possessed: true }, items: [] })).toBe(true);
  });
  it("чекбокс без heretic не считается, архетип «Одержимый» — считается", () => {
    expect(isPossessed({ system: { alignment: "loyalist", possessed: true }, items: [] })).toBe(false);
    expect(isPossessed({ system: { alignment: "loyalist", eliteArchetype: "Одержимый" }, items: [] })).toBe(true);
  });
});

// wdbc-rc5z: раньше по-разному сломано в двух местах — rules/character.mjs
// сравнивал ВСЮ строку имени с «Дар: X» (не находил реальные бигвальные
// записи пака), sheets/tabs/possession.mjs звал name.startsWith («Дар: » не
// в начале строки у «Carapace / Дар: Панцирь»). Общий giftNamesOf проверяет
// КАЖДУЮ половину имени на префикс.
describe("giftNamesOf — Дары Одержимого по двуязычному имени", () => {
  it("реальный формат пака: английская половина первая", () => {
    const actor = { items: [{ type: "talent", name: "Carapace / Дар: Панцирь" }] };
    expect(giftNamesOf(actor)).toEqual(new Set(["Панцирь"]));
  });

  it("старый формат без английской половины — тоже находит", () => {
    const actor = { items: [{ type: "talent", name: "Дар: Гигант" }] };
    expect(giftNamesOf(actor)).toEqual(new Set(["Гигант"]));
  });

  it("несколько Даров разом, не-таланты и предметы без префикса игнорируются", () => {
    const actor = { items: [
      { type: "talent", name: "Carapace / Дар: Панцирь" },
      { type: "talent", name: "Giant / Дар: Гигант" },
      { type: "trait", name: "Дар: Не считается — не talent" },
      { type: "talent", name: "Iron Discipline" }
    ] };
    expect(giftNamesOf(actor)).toEqual(new Set(["Панцирь", "Гигант"]));
  });

  it("пустой актор — пустое множество", () => {
    expect(giftNamesOf({ items: [] })).toEqual(new Set());
    expect(giftNamesOf(null)).toEqual(new Set());
  });

  it("GIFT_NAME_PREFIX — общая константа с завершающим пробелом", () => {
    expect(GIFT_NAME_PREFIX).toBe("Дар: ");
  });
});
