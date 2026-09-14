// test/rules/sigillite-runes.test.mjs
//
// Руны Сигиллитов (wdbc-fsl9) — экономика ресурса Элитного Архетипа
// «Последователь Ордена Сигиллитов» (DoomBC — Психокеры-Жабы, стр. 101-102).
//
// Главное, что здесь проверяется, — не только числа книги, но и ГРАНИЦА: у
// псайкера без Черты «Магия Сигиллитов» подсистема не должна давать ровно
// ничего (ни максимума, ни начисления, ни цены), потому что она встраивается
// в общий конвейер психосил, которым пользуются ВСЕ псайкеры системы.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  RUNE_BASE_MAX, RUNE_STRIKE_COST, RUNE_MAGIC_FLAG,
  hasRuneMagic, talentTakes, archeotechSteps, runeMax, runeGainPerTurn,
  runeStartOfCombat, runeCalculatorBonus, runeCostForPower, runeCostTotal,
  runeStrikeMax, runeStrikeRefund, runeValue, runeUpdate,
  RUNE_LEARN_COST, RUNE_LEARN_FORBIDDEN_EXTRA, IMPROVISED_RUNE_FLAG, PROMETHEUS_FIRE_FLAG,
  isRuneLearned, isForbiddenRuneDiscipline, hasImprovisedRune, hasPrometheusFire,
  runeLearnInfo, improvisedRuneCostUpdates,
  PREPARED_RUNE_FLAG, preparedRuneChoiceId, isPreparedRuneUsed, preparedRuneDiscount,
  markPreparedRuneUsed
} from "../../module/rules/sigillite-runes.mjs";

/** Предмет с записью Конструктора «Возможность» — так Черта раздаёт Путь. */
function capabilityItem(key, { type = "trait", name = "Магия Сигиллитов" } = {}) {
  return {
    id: `cap-${key}`, type, name,
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  };
}

/** Талант по имени — счёт взятий идёт по числу предметов, как «Бездонная Душа». */
function talent(name, extra = {}) {
  return { id: `${name}-${Math.random()}`, type: "talent", name, system: { ...extra } };
}

function actorOf({ runeMagic = true, talents = [], archeotechRank = null,
                   int = 40, intBonus = 4, psyRating = 3, runes = 0,
                   extraCaps = [], wounds = { value: 10, max: 10, critical: 0 },
                   charDamage = { s: 0, ag: 0, wp: 0 } } = {}) {
  const items = [];
  if (runeMagic) items.push(capabilityItem(RUNE_MAGIC_FLAG));
  for (const cap of extraCaps) items.push(capabilityItem(cap));
  items.push(...talents);
  const forbiddenLore = archeotechRank
    ? [{ specKey: "archeotech", specialty: "Археотех", rank: archeotechRank }]
    : [];
  return {
    name: "Сигиллит", type: "character",
    system: {
      characteristics: { int: { total: int, bonus: intBonus } },
      psyker: { rating: psyRating, currentRating: psyRating, class: "bound" },
      groupSkills: { forbiddenLore },
      sigilliteRunes: { value: runes, max: 0 },
      wounds, charDamage
    },
    items: Object.assign(items.slice(), { contents: items })
  };
}

const power = pr => ({ name: "Психосила", system: { prRequired: pr } });

/** Психосила с полем Руны (wdbc-exjp) и, при желании, дисциплиной. */
const powerOf = ({ prRequired = 2, discipline = "", runeLearned = false } = {}) =>
  ({ name: "Психосила", system: { prRequired, discipline, runeLearned } });

describe("Руны Сигиллитов — доступ к Пути", () => {
  it("Черта «Магия Сигиллитов» открывает Путь", () => {
    expect(hasRuneMagic(actorOf())).toBe(true);
  });

  it("без Черты Путь закрыт — и вся арифметика молчит", () => {
    const plain = actorOf({ runeMagic: false, archeotechRank: "expert",
      talents: [talent("Rune Library"), talent("Rune Calculator")] });
    expect(hasRuneMagic(plain)).toBe(false);
    expect(runeMax(plain)).toBe(0);
    expect(runeGainPerTurn(plain)).toBe(0);
    expect(runeStartOfCombat(plain)).toBe(0);
    expect(runeCalculatorBonus(plain)).toBe(0);
    expect(runeStrikeMax(plain, power(2))).toBe(0);
    expect(runeUpdate(plain, +5)).toBeNull();
  });
});

describe("Ступени Forbidden Lore (Archeotech)", () => {
  it("нет навыка — нет ступеней", () => {
    expect(archeotechSteps(actorOf())).toBe(0);
  });

  it("«Знает» = 1, «+10» = 2, «+20» = 3, «+30» = 4", () => {
    expect(archeotechSteps(actorOf({ archeotechRank: "knows"   }))).toBe(1);
    expect(archeotechSteps(actorOf({ archeotechRank: "trained" }))).toBe(2);
    expect(archeotechSteps(actorOf({ archeotechRank: "veteran" }))).toBe(3);
    expect(archeotechSteps(actorOf({ archeotechRank: "expert"  }))).toBe(4);
  });

  it("+30 и Талант Mastery по Археотеху дают книжные +5", () => {
    const a = actorOf({ archeotechRank: "expert",
      talents: [talent("Mastery / Мастерство", { specialization: "Forbidden Lore (Archeotech)" })] });
    expect(archeotechSteps(a)).toBe(5);
  });

  it("Mastery без +30 пятой ступени не даёт", () => {
    const a = actorOf({ archeotechRank: "veteran",
      talents: [talent("Mastery / Мастерство", { specialization: "Forbidden Lore (Archeotech)" })] });
    expect(archeotechSteps(a)).toBe(3);
  });

  it("Mastery по чужому навыку не считается", () => {
    const a = actorOf({ archeotechRank: "expert",
      talents: [talent("Mastery / Мастерство", { specialization: "Forbidden Lore (Warp)" })] });
    expect(archeotechSteps(a)).toBe(4);
  });

  it("другая специализация Запретных знаний ступеней не даёт", () => {
    const a = actorOf();
    a.system.groupSkills.forbiddenLore = [{ specKey: "warp", specialty: "Варп", rank: "expert" }];
    expect(archeotechSteps(a)).toBe(0);
  });
});

describe("Максимум Рун", () => {
  it("базово 20", () => {
    expect(runeMax(actorOf())).toBe(RUNE_BASE_MAX);
  });

  it("«Библиотека Рун»: +I.b и +1 за ступень, за каждое взятие", () => {
    // I.b 4, Археотех «+20» = 3 ступени → +7 за взятие.
    const one = actorOf({ archeotechRank: "veteran", talents: [talent("Библиотека Рун")] });
    expect(runeMax(one)).toBe(20 + 7);
    const three = actorOf({ archeotechRank: "veteran",
      talents: [talent("Rune Library"), talent("Rune Library"), talent("Rune Library")] });
    expect(runeMax(three)).toBe(20 + 21);
  });

  it("больше трёх взятий не считаются — книжный потолок «до 3 раз»", () => {
    const four = actorOf({ talents: Array.from({ length: 4 }, () => talent("Rune Library")) });
    expect(talentTakes(four, ["Rune Library", "Библиотека Рун"])).toBe(3);
    expect(runeMax(four)).toBe(20 + 3 * 4);
  });
});

describe("Начисление Рун", () => {
  it("в начале Хода — бPR плюс ступени Археотеха", () => {
    expect(runeGainPerTurn(actorOf({ psyRating: 5, archeotechRank: "trained" }))).toBe(7);
  });

  it("в начале боя — ровно бPR, и не выше максимума", () => {
    expect(runeStartOfCombat(actorOf({ psyRating: 6 }))).toBe(6);
    const weak = actorOf({ psyRating: 60 });   // абсурдный бPR упирается в 20
    expect(runeStartOfCombat(weak)).toBe(20);
  });

  it("«Вычислитель Рун» даёт +I.b за взятие, до трёх", () => {
    expect(runeCalculatorBonus(actorOf({ talents: [talent("Rune Calculator")] }))).toBe(4);
    expect(runeCalculatorBonus(actorOf({
      talents: Array.from({ length: 5 }, () => talent("Вычислитель Рун")) }))).toBe(12);
  });

  it("без «Вычислителя» первый Ход ничего не добавляет", () => {
    expect(runeCalculatorBonus(actorOf())).toBe(0);
  });
});

describe("Цена манифестации", () => {
  it("бPR психосилы × 2", () => {
    expect(runeCostForPower(power(1))).toBe(2);
    expect(runeCostForPower(power(4))).toBe(8);
  });

  it("сила без требования PR всё равно стоит пару Рун", () => {
    expect(runeCostForPower(power(0))).toBe(2);
  });

  it("«Рунный Удар»: каждые +1 эPR стоят четыре Руны сверху", () => {
    expect(runeCostTotal(power(3), 0)).toBe(6);
    expect(runeCostTotal(power(3), 2)).toBe(6 + 2 * RUNE_STRIKE_COST);
  });

  it("сколько эPR по карману — считается по остатку после базовой цены", () => {
    // 20 Рун, сила бPR 2 → база 4, остаток 16 → четыре шага по 4.
    const a = actorOf({ runes: 20, talents: [talent("Rune Strike")] });
    expect(runeStrikeMax(a, power(2))).toBe(4);
  });

  it("без Таланта «Рунный Удар» усиления нет даже при полном пуле", () => {
    expect(runeStrikeMax(actorOf({ runes: 20 }), power(2))).toBe(0);
  });

  it("если Рун не хватает даже на базовую цену — усилений ноль", () => {
    const a = actorOf({ runes: 3, talents: [talent("Rune Strike")] });
    expect(runeStrikeMax(a, power(2))).toBe(0);
  });

  it("провал «Рунного Удара» возвращает I.b Рун", () => {
    expect(runeStrikeRefund(actorOf({ intBonus: 5 }))).toBe(5);
  });
});

// ── wdbc-p2it: Заготовленная Руна — выбор на бой + скидка I.b на первую
// манифестацию именно ЭТОЙ Руны, пока скидка не потрачена ─────────────────
describe("Заготовленная Руна (wdbc-p2it)", () => {
  /** Подставные getFlag/setFlag ровно под один флаг "preparedRune". */
  function withFlags(actor, initial = null) {
    let store = initial;
    actor.getFlag = (_ns, key) => (key === "preparedRune" ? store : undefined);
    actor.setFlag = async (_ns, key, value) => { if (key === "preparedRune") store = value; };
    return actor;
  }

  it("без Таланта скидки нет, даже если Руна выбрана и не потрачена", () => {
    const a = withFlags(actorOf(), { itemId: "p1", used: false });
    expect(preparedRuneDiscount(a, { id: "p1" })).toBe(0);
  });

  it("с Талантом, но без выбора на этот бой — скидки нет", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG] }));
    expect(preparedRuneDiscount(a, { id: "p1" })).toBe(0);
  });

  it("выбрана ДРУГАЯ Руна — скидки нет", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG] }), { itemId: "other", used: false });
    expect(preparedRuneDiscount(a, { id: "p1" })).toBe(0);
  });

  it("выбрана эта Руна, первая манифестация ещё не потрачена — скидка I.b", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG], intBonus: 5 }), { itemId: "p1", used: false });
    expect(preparedRuneDiscount(a, { id: "p1" })).toBe(5);
    expect(preparedRuneChoiceId(a)).toBe("p1");
    expect(isPreparedRuneUsed(a)).toBe(false);
  });

  it("выбрана эта Руна, но скидка уже потрачена в этом бою — скидки нет", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG] }), { itemId: "p1", used: true });
    expect(preparedRuneDiscount(a, { id: "p1" })).toBe(0);
    expect(isPreparedRuneUsed(a)).toBe(true);
  });

  it("runeCostForPower с actor вычитает I.b из цены, но не ниже 1", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG], intBonus: 4 }), { itemId: "p1", used: false });
    // бPR 1 → база 2, скидка 4 упёрлась бы в 0 — держим пол в 1.
    expect(runeCostForPower({ id: "p1", system: { prRequired: 1 } }, a)).toBe(1);
    // бPR 4 → база 8, скидка 4 → 4.
    expect(runeCostForPower({ id: "p1", system: { prRequired: 4 } }, a)).toBe(4);
  });

  it("без actor (все старые вызовы системы) скидка не считается вовсе", () => {
    expect(runeCostForPower({ id: "p1", system: { prRequired: 1 } })).toBe(2);
  });

  it("runeCostTotal учитывает скидку, когда actor передан третьим аргументом", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG], intBonus: 4 }), { itemId: "p1", used: false });
    // бPR 3 → база 6, скидка 4 → 2, плюс Рунный Удар не участвует (0).
    expect(runeCostTotal({ id: "p1", system: { prRequired: 3 } }, 0, a)).toBe(2);
  });

  it("вторая манифестация той же Руны в том же бою — скидки уже нет", () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG], intBonus: 4 }), { itemId: "p1", used: false });
    const power = { id: "p1", system: { prRequired: 3 } };
    expect(runeCostForPower(power, a)).toBe(2);   // первая: 6 − 4
    a.setFlag("warhammer-dbc", "preparedRune", { itemId: "p1", used: true });
    expect(runeCostForPower(power, a)).toBe(6);   // вторая: полная цена
  });

  it("markPreparedRuneUsed отмечает выбранную Руну потраченной, id сохраняется", async () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG] }), { itemId: "p1", used: false });
    await markPreparedRuneUsed(a);
    expect(isPreparedRuneUsed(a)).toBe(true);
    expect(preparedRuneChoiceId(a)).toBe("p1");
  });

  it("markPreparedRuneUsed без выбора на бой — ничего не делает", async () => {
    const a = withFlags(actorOf({ extraCaps: [PREPARED_RUNE_FLAG] }), null);
    await markPreparedRuneUsed(a);
    expect(preparedRuneChoiceId(a)).toBeNull();
  });
});

describe("Запись пула", () => {
  it("трата уменьшает значение", () => {
    const a = actorOf({ runes: 10 });
    expect(runeUpdate(a, -6)).toEqual({ "system.sigilliteRunes.value": 4 });
  });

  it("ниже нуля не уходит", () => {
    const a = actorOf({ runes: 3 });
    expect(runeUpdate(a, -9)).toEqual({ "system.sigilliteRunes.value": 0 });
  });

  it("выше максимума не поднимается", () => {
    const a = actorOf({ runes: 18 });
    expect(runeUpdate(a, +9)).toEqual({ "system.sigilliteRunes.value": 20 });
  });

  it("когда менять нечего — обновления нет вовсе", () => {
    const a = actorOf({ runes: 20 });
    expect(runeUpdate(a, +5)).toBeNull();
    expect(runeUpdate(actorOf({ runes: 0 }), -5)).toBeNull();
  });

  it("начало боя ставит значение, а не прибавляет", () => {
    const a = actorOf({ runes: 17, psyRating: 4 });
    expect(runeUpdate(a, 0, { set: runeStartOfCombat(a) }))
      .toEqual({ "system.sigilliteRunes.value": 4 });
  });

  it("текущее значение читается из пула", () => {
    expect(runeValue(actorOf({ runes: 7 }))).toBe(7);
    expect(runeValue({})).toBe(0);
  });
});

// ── wdbc-exjp: список изученных Рун + два зависимых Таланта ──────────────────
describe("Изученные Руны — состояние на психосиле", () => {
  it("по умолчанию не изучена", () => {
    expect(isRuneLearned(powerOf())).toBe(false);
  });

  it("runeLearned:true на предмете — изучена", () => {
    expect(isRuneLearned(powerOf({ runeLearned: true }))).toBe(true);
  });

  it("предмет без system — не изучена, не падает", () => {
    expect(isRuneLearned(null)).toBe(false);
    expect(isRuneLearned({})).toBe(false);
  });
});

describe("«кроме Божественных и Либрариума» — запрещённые дисциплины", () => {
  it("Божественные дисциплины (Слаанеш/Нургл/Тзинч) — запрещены", () => {
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "slaanesh" }))).toBe(true);
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "nurgle" }))).toBe(true);
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "tzeentch" }))).toBe(true);
  });

  it("Либрариум — запрещён (своя дисциплина, не «Божественная» группа)", () => {
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "librarium" }))).toBe(true);
  });

  it("обычная дисциплина (Телекинез и т.п.) — разрешена", () => {
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "telekinesis" }))).toBe(false);
  });

  it("пустая/неизвестная дисциплина не считается запрещённой", () => {
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "" }))).toBe(false);
    expect(isForbiddenRuneDiscipline(powerOf({ discipline: "неведомая" }))).toBe(false);
  });
});

describe("Improvised Rune / Prometheus Fire — возможности", () => {
  it("нет Талантов — обеих возможностей нет", () => {
    const a = actorOf();
    expect(hasImprovisedRune(a)).toBe(false);
    expect(hasPrometheusFire(a)).toBe(false);
  });

  it("Improvised Rune выдаёт свою возможность и только её", () => {
    const a = actorOf({ extraCaps: [IMPROVISED_RUNE_FLAG] });
    expect(hasImprovisedRune(a)).toBe(true);
    expect(hasPrometheusFire(a)).toBe(false);
  });

  it("Prometheus Fire выдаёт свою возможность и только её", () => {
    const a = actorOf({ extraCaps: [PROMETHEUS_FIRE_FLAG] });
    expect(hasPrometheusFire(a)).toBe(true);
    expect(hasImprovisedRune(a)).toBe(false);
  });
});

describe("Цена и допустимость изучения Руны (runeLearnInfo)", () => {
  it("обычная дисциплина, бPR хватает — 50 опыта, разрешено", () => {
    const a = actorOf({ psyRating: 4 });
    const info = runeLearnInfo(a, powerOf({ prRequired: 3, discipline: "telekinesis" }));
    expect(info).toEqual({ cost: RUNE_LEARN_COST, forbidden: false, allowed: true, prBlocked: false });
  });

  it("Божественная дисциплина без Prometheus Fire — запрещено", () => {
    const a = actorOf();
    const info = runeLearnInfo(a, powerOf({ discipline: "tzeentch" }));
    expect(info.forbidden).toBe(true);
    expect(info.allowed).toBe(false);
  });

  it("Божественная дисциплина с Prometheus Fire — разрешено, цена 50+50", () => {
    const a = actorOf({ extraCaps: [PROMETHEUS_FIRE_FLAG] });
    const info = runeLearnInfo(a, powerOf({ discipline: "librarium" }));
    expect(info.allowed).toBe(true);
    expect(info.cost).toBe(RUNE_LEARN_COST + RUNE_LEARN_FORBIDDEN_EXTRA);
  });

  it("бPR ниже требования психосилы — prBlocked", () => {
    const a = actorOf({ psyRating: 2 });
    const info = runeLearnInfo(a, powerOf({ prRequired: 5 }));
    expect(info.prBlocked).toBe(true);
  });

  it("бPR равен требованию — не заблокировано (минимум включительно)", () => {
    const a = actorOf({ psyRating: 3 });
    const info = runeLearnInfo(a, powerOf({ prRequired: 3 }));
    expect(info.prBlocked).toBe(false);
  });
});

describe("Improvised Rune — цена манифестации неизученной Руны", () => {
  it("1 непоглощаемая Рана + 1 к Мод. S/A/W разом", () => {
    const a = actorOf({ wounds: { value: 10, max: 10, critical: 0 } });
    const patch = improvisedRuneCostUpdates(a);
    expect(patch["system.wounds.value"]).toBe(9);
    expect(patch["system.charDamage.s"]).toBe(-1);
    expect(patch["system.charDamage.ag"]).toBe(-1);
    expect(patch["system.charDamage.wp"]).toBe(-1);
  });

  it("копится поверх уже имеющегося Мод. характеристики", () => {
    const a = actorOf({ charDamage: { s: -2, ag: 0, wp: -1 } });
    const patch = improvisedRuneCostUpdates(a);
    expect(patch["system.charDamage.s"]).toBe(-3);
    expect(patch["system.charDamage.wp"]).toBe(-2);
  });

  it("Раны ниже нуля уходят в Критические, как любой другой прямой урон", () => {
    const a = actorOf({ wounds: { value: 0, max: 10, critical: 2 } });
    const patch = improvisedRuneCostUpdates(a);
    expect(patch["system.wounds.value"]).toBe(0);
    expect(patch["system.wounds.critical"]).toBe(3);
  });
});
