// test/rules/master-of-executions.test.mjs
//
// Мастер Казней (Sahara 1-54b9): чистая часть rules/master-of-executions.mjs на настоящих записях пака —
// опознание способностей, Помеха Целеустремлённого Охотника, дальность Unnatural Senses, сила души по Inf,
// Терминаторская броня и Экзо-Костюм, «не дальше от цели», базовый контакт, предел обмена местами.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  hasSingleMindedHunter, hasHunterSight, hasMistSavior, hasMistwalker, hasMistLeap, hunterHindranceApplies,
  HUNTER_HINDRANCE_SKILLS, HUNTER_DISORDER, unnaturalSensesRange, soulTier, wearsTerminatorOrExo, mistwalkerAnchorOk,
  baseContactPoint, basesInContact, topLeftFor, swapLimitMeters, swapNeedsConsent
} from "../../module/rules/master-of-executions.mjs";
import { diceModeHtml } from "../../module/rules/test-kind-widget.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { DISORDER_LIBRARY } from "../../module/constants/fear-tables.mjs";

const TRAITS = "packs-src/traits/Элитные_архетипы/Мастер_Казней";
const TALENTS = "packs-src/talents/Элитные_архетипы/Мастер_Казней";
const SINGLE = packDocById(TRAITS, "SMFzhi92ZMmAx2pB");
const SIGHT = packDocById(TRAITS, "9o6Ux4E19zCmt4gt");
const WALKER = packDocById(TRAITS, "jCGAtzhmoeqgUbbC");
const LEAP = packDocById(TALENTS, "GT0mCLQ13cgAwr9y");
const SAVIOR = packDocById(TALENTS, "X2jE56CGvNbtHSg5");
const SENSES = packDocById("packs-src/traits", "7x1jLzfRKXuA0vew");
const AEGIS = packDocById("packs-src/armor/Астартес/Броня/Терминаторская", "zWrnp0yUuNetd2cf");
const CATAPHRACTII = packDocById("packs-src/armor/Астартес/Броня/Терминаторская", "pCguFdqdpFq0k5SK");
const MK_III = packDocById("packs-src/armor/Астартес/Броня/Силовая", "wmuDbcWesZQ8g9NO");

const asItem = (doc, patch = {}) => ({ ...doc, system: { ...doc.system, ...patch }, getFlag: (s, k) => doc.flags?.[s]?.[k] });
const actorOf = (docs = [], system = {}) => ({ items: docs.map(d => (d.name ? asItem(d) : d)), system });

describe("опознание способностей Мастера Казней по настоящим записям пака", () => {
  it("каждая запись читается на владельце и только на нём", () => {
    const checks = [[SINGLE, hasSingleMindedHunter], [SIGHT, hasHunterSight], [WALKER, hasMistwalker], [LEAP, hasMistLeap], [SAVIOR, hasMistSavior]];
    for (const [doc, check] of checks) {
      expect(check(actorOf([doc])), doc.name).toBe(true);
      expect(check(actorOf()), doc.name).toBe(false);
      for (const [other, otherCheck] of checks) if (other !== doc) expect(otherCheck(actorOf([doc])), `${doc.name} / ${other.name}`).toBe(false);
    }
  });

  it("запись несёт ключ Возможности из реестра, и ключ опознаёт её даже под другим именем", () => {
    const renamed = { name: "Другое имя", type: "trait", system: {}, flags: SINGLE.flags, getFlag: (s, k) => SINGLE.flags?.[s]?.[k] };
    expect(hasSingleMindedHunter({ items: [renamed] })).toBe(true);
    for (const doc of [SINGLE, SIGHT, WALKER, LEAP, SAVIOR]) {
      const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
      const keys = entries.filter(e => e.kind === "capability").map(e => e.capabilityKey);
      expect(keys.length, doc.name).toBe(1);
      expect(CAPABILITIES[keys[0]], keys[0]).toBeTruthy();
      expect(CAPABILITIES[keys[0]].reader, keys[0]).toMatch(/master-of-executions|disorders/);
    }
  });
});

describe("Целеустремлённый Охотник", () => {
  it("Помеха — на Command, Charm, Deceive, Inquiry, и только у носителя", () => {
    const hunter = actorOf([SINGLE]);
    for (const skill of ["command", "charm", "deceive", "inquiry"]) {
      expect(hunterHindranceApplies(hunter, skill), skill).toBe(true);
      expect(hunterHindranceApplies(actorOf(), skill), skill).toBe(false);
    }
    for (const skill of ["awareness", "intimidate", "athletics", "", null, undefined]) expect(hunterHindranceApplies(hunter, skill), String(skill)).toBe(false);
    expect(HUNTER_HINDRANCE_SKILLS).toEqual(["command", "charm", "deceive", "inquiry"]);
  });

  it("окно теста ставит Помеху заранее; без пресета — Обычный кубик", () => {
    expect(diceModeHtml({ preset: "disadvantage" })).toMatch(/value="disadvantage" checked/);
    expect(diceModeHtml({ preset: "disadvantage" })).not.toMatch(/value="normal" checked/);
    expect(diceModeHtml()).toMatch(/value="normal" checked/);
    expect(diceModeHtml({ preset: "advantage" })).toMatch(/value="advantage" checked/);
  });

  it("расстройство в таблице есть и называется так, как его ищет Черта; скрипт записи просит именно его", () => {
    expect(DISORDER_LIBRARY.some(d => d.name === HUNTER_DISORDER.name)).toBe(true);
    expect(HUNTER_DISORDER.severityMin).toBe(0);
    const script = SINGLE.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "script");
    expect(script.scriptOnGrant).toBe(true);
    expect(script.code).toContain(`name: "${HUNTER_DISORDER.name}"`);
    expect(script.code).toContain("severityMin: 0");
  });
});

describe("Взор Охотника и Unnatural Senses", () => {
  it("дальность — рейтинг Трейта (P), без Трейта — P актора; отмеченная добыча — километры", () => {
    const withRating = rating => actorOf([{ ...SENSES, type: "trait", system: { ...SENSES.system, rating } }], { characteristics: { per: { total: 44 } } });
    expect(unnaturalSensesRange(withRating(52))).toBe(52);
    expect(unnaturalSensesRange(withRating(52), { km: true })).toBe(52000);
    expect(unnaturalSensesRange(actorOf([], { characteristics: { per: { total: 44 } } }))).toBe(44);
    expect(unnaturalSensesRange(actorOf())).toBe(0);
  });

  it("рейтинг-формула «perv» читается живьём: выросшее P сдвигает зону, не застывшее выданное число", () => {
    const item = { ...SENSES, type: "trait", system: { ...SENSES.system, rating: 45 }, flags: { "warhammer-dbc": { ratingFormula: "perv" } } };
    const actor = actorOf([item], { characteristics: { per: { total: 55, bonus: 5 } } });
    expect(unnaturalSensesRange(actor)).toBe(55);
  });

  it("грубая сила души по Inf: пороги 30 / 60 / 80 книжной градации Казни", () => {
    expect(soulTier(0).key).toBe("faint");
    expect(soulTier(29).key).toBe("faint");
    expect(soulTier(30).key).toBe("notable");
    expect(soulTier(59).key).toBe("notable");
    expect(soulTier(60).key).toBe("mighty");
    expect(soulTier(79).key).toBe("mighty");
    expect(soulTier(80).key).toBe("great");
    expect(soulTier("мусор").key).toBe("faint");
  });
});

describe("Туманоходец: Терминаторская броня и Экзо-Костюм", () => {
  const worn = (doc, equipped = true) => ({ ...doc, type: "armor", system: { ...doc.system, equipped } });

  it("надетая Терминаторская броня — Эгида и Марки с крупной Базой — запрещает телепорт", () => {
    expect(wearsTerminatorOrExo(actorOf([worn(AEGIS)]))).toBe(true);
    expect(wearsTerminatorOrExo(actorOf([worn(CATAPHRACTII)]))).toBe(true);
  });

  it("снятая броня и обычная силовая — не запрещают", () => {
    expect(wearsTerminatorOrExo(actorOf([worn(AEGIS, false)]))).toBe(false);
    expect(wearsTerminatorOrExo(actorOf([worn(MK_III)]))).toBe(false);
    expect(wearsTerminatorOrExo(actorOf())).toBe(false);
  });

  it("Экзо-Костюм опознаётся по имени надетой брони", () => {
    expect(wearsTerminatorOrExo(actorOf([{ name: "Exo-Suit / Экзо-Костюм «Дредноут»", type: "armor", system: { equipped: true } }]))).toBe(true);
    expect(wearsTerminatorOrExo(actorOf([{ name: "Экзо-Костюм", type: "armor", system: { equipped: false } }]))).toBe(false);
  });
});

describe("Туманоходец: не дальше от достойной цели, чем начал", () => {
  it("сравнивает ближайшие расстояния; ближе или так же — можно, дальше — нельзя", () => {
    expect(mistwalkerAnchorOk([10, 20], [5, 40])).toBe(true);
    expect(mistwalkerAnchorOk([10, 20], [10, 40])).toBe(true);
    expect(mistwalkerAnchorOk([10, 20], [10.5, 5])).toBe(true);
    expect(mistwalkerAnchorOk([10, 20], [12, 15])).toBe(false);
  });

  it("нет целей отсчёта — ограничение нечем мерить, телепорт разрешён", () => {
    expect(mistwalkerAnchorOk([], [50])).toBe(true);
    expect(mistwalkerAnchorOk([10], [])).toBe(true);
    expect(mistwalkerAnchorOk(undefined, undefined)).toBe(true);
  });
});

describe("Туманный Прыжок: базовый контакт", () => {
  it("встаёт на прямой от добычи к прыгуну на расстоянии соприкосновения Баз", () => {
    const self = { x: 0, y: 0, width: 1, height: 1 };
    const prey = { x: 1000, y: 0, width: 1, height: 1 };
    const p = baseContactPoint(self, prey, 100);
    expect(p.x).toBeCloseTo(950);
    expect(p.y).toBeCloseTo(50);
    expect(p.distCells).toBe(1);
  });

  it("крупная добыча 3×3: прыгун встаёт у её края, а не внутри — Базы соприкасаются", () => {
    const self = { x: 0, y: 0, width: 1, height: 1 };
    const prey = { x: 600, y: 0, width: 3, height: 3 };
    const p = baseContactPoint(self, prey, 100);
    // центр добычи (750,150); слева от неё край на x=600, центр прыгуна — на 50 левее края
    expect(p.x).toBeLessThanOrEqual(550 + 1e-6);
    expect(basesInContact({ x: p.x - 50, y: p.y - 50, width: 1, height: 1 }, prey, 100)).toBe(true);
    const diag = baseContactPoint({ x: 0, y: 0, width: 1, height: 1 }, { x: 600, y: 600, width: 3, height: 3 }, 100);
    expect(basesInContact({ x: diag.x - 50, y: diag.y - 50, width: 1, height: 1 }, { x: 600, y: 600, width: 3, height: 3 }, 100)).toBe(true);
    expect(diag.x).toBeLessThan(750);
  });

  it("вплотную к краю крупной Базы — уже в контакте; в двух клетках от края — нет", () => {
    const prey = { x: 600, y: 600, width: 3, height: 3 };
    expect(basesInContact({ x: 500, y: 700, width: 1, height: 1 }, prey, 100)).toBe(true);
    expect(basesInContact({ x: 300, y: 700, width: 1, height: 1 }, prey, 100)).toBe(false);
  });

  it("токены совпали — уходит вправо, а не в NaN", () => {
    const p = baseContactPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, 100);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p.x).toBeCloseTo(150);
  });

  it("левый верхний угол по центру учитывает размер токена", () => {
    expect(topLeftFor({ width: 1, height: 1 }, { x: 950, y: 50 }, 100)).toEqual({ x: 900, y: 0 });
    expect(topLeftFor({ width: 2, height: 2 }, { x: 950, y: 50 }, 100)).toEqual({ x: 850, y: -50 });
  });
});

describe("Спаситель Туманов: обмен местами", () => {
  it("предел обмена — наибольшее из P.b и Полудвижения, не меньше метра", () => {
    expect(swapLimitMeters({ system: { characteristics: { per: { bonus: 4 } }, movement: { halfMove: 3 } } })).toBe(4);
    expect(swapLimitMeters({ system: { characteristics: { per: { bonus: 2 } }, movement: { halfMove: 6 } } })).toBe(6);
    expect(swapLimitMeters({ system: {} })).toBe(1);
  });

  it("согласие нужно, пока цель не Беспомощна", () => {
    expect(swapNeedsConsent({ system: { conditions: { helpless: true } } })).toBe(false);
    expect(swapNeedsConsent({ system: { conditions: { helpless: false } } })).toBe(true);
    expect(swapNeedsConsent({ system: {} })).toBe(true);
  });
});
