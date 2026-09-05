// Срок Состояния штатной Duration эффекта (wdbc-uqco).
//
// Переписано после живой проверки (wdbc-xjce/wdbc-8ij2): первая версия
// считала остаток срока сама, по полям {rounds, startRound, seconds,
// startTime}. Такой формы в Foundry v14 НЕТ — схема duration это
// {value, units, expiry, expired}, а остаток (remaining/secondsRemaining) и
// момент начала (effect.start) ведёт ядро. Поэтому здесь проверяется перевод
// «что выбрал автор» → {value, units} и ЧТЕНИЕ готового остатка обратно,
// а не своя арифметика — своей больше нет.

import { describe, it, expect } from "vitest";
import { SECONDS_PER_ROUND, DURATION_UNITS, durationLabel, durationDataFor,
         remainingOf, isDurationExpired, remainingRounds, remainingLabel,
         conditionEntryTerm, conditionHasLevelInput }
  from "../../module/rules/condition-duration.mjs";

/** Подготовленный ядром объект duration — та форма, что видит наш код. */
const prepared = (over = {}) => ({ value: 3, units: "rounds", expired: false, remaining: 3, ...over });

describe("durationLabel: русское согласование", () => {
  it("раунды", () => {
    expect(durationLabel(1, "rounds")).toBe("1 раунд");
    expect(durationLabel(2, "rounds")).toBe("2 раунда");
    expect(durationLabel(5, "rounds")).toBe("5 раундов");
    expect(durationLabel(11, "rounds")).toBe("11 раундов");
    expect(durationLabel(21, "rounds")).toBe("21 раунд");
  });

  it("минуты и часы", () => {
    expect(durationLabel(1, "minutes")).toBe("1 минута");
    expect(durationLabel(3, "minutes")).toBe("3 минуты");
    expect(durationLabel(12, "hours")).toBe("12 часов");
  });

  it("нет срока — пустая подпись, а не «0 раундов»", () => {
    expect(durationLabel(0, "rounds")).toBe("");
    expect(durationLabel(3, "")).toBe("");
    expect(durationLabel(3, "неизвестно")).toBe("");
  });
});

describe("durationDataFor: срок автора → duration эффекта", () => {
  it("единицы автора — это единицы Foundry, переводить нечего", () => {
    // Свой перевод единиц и был причиной обоих багов живой проверки:
    // считать самим то, что считает ядро, — способ разойтись с ядром.
    expect(durationDataFor(2, "rounds")).toEqual({ value: 2, units: "rounds" });
    expect(durationDataFor(10, "minutes")).toEqual({ value: 10, units: "minutes" });
    expect(durationDataFor(1, "hours")).toEqual({ value: 1, units: "hours" });
    expect(durationDataFor(1, "days")).toEqual({ value: 1, units: "days" });
  });

  it("момент начала НЕ проставляется — его пишет ядро при создании эффекта", () => {
    const d = durationDataFor(2, "rounds");
    expect(Object.keys(d).sort()).toEqual(["units", "value"]);
  });

  it("нет срока — null: Состояние висит до ручного снятия, как раньше", () => {
    expect(durationDataFor(2, "")).toBeNull();
    expect(durationDataFor(0, "rounds")).toBeNull();
    expect(durationDataFor("", "rounds")).toBeNull();
    expect(durationDataFor(2, "недели")).toBeNull();
  });

  it("все единицы списка UI разбираются (кроме «без срока»)", () => {
    for (const u of DURATION_UNITS.filter(x => x.key)) {
      expect(durationDataFor(1, u.key)).not.toBeNull();
    }
  });
});

describe("remainingOf: остаток берётся у ядра", () => {
  it("конечный остаток отдаётся как есть", () => {
    expect(remainingOf(prepared({ remaining: 2 }))).toBe(2);
    expect(remainingOf(prepared({ remaining: -1 }))).toBe(-1);
  });

  it("бесконечный и отсутствующий — null", () => {
    expect(remainingOf(prepared({ remaining: Infinity }))).toBeNull();
    expect(remainingOf({})).toBeNull();
    expect(remainingOf(null)).toBeNull();
  });
});

describe("isDurationExpired", () => {
  it("остаток кончился — истёк", () => {
    expect(isDurationExpired(prepared({ remaining: 0 }))).toBe(true);
    expect(isDurationExpired(prepared({ remaining: -3 }))).toBe(true);
  });

  it("остаток есть — не истёк, даже если флаг expired почему-то стоит", () => {
    // Остаток ядро пересчитывает на каждой подготовке данных, флаг ведёт
    // отдельный механизм слежения — верим более свежему источнику.
    expect(isDurationExpired(prepared({ remaining: 1, expired: true }))).toBe(false);
  });

  it("остатка нет ВОВСЕ (сырые данные, не подготовленные ядром) — верим флагу", () => {
    // Это единственный случай, где флаг остаётся единственным источником: у
    // документа, который ядро ещё не готовило, поля remaining просто нет.
    expect(isDurationExpired({ value: 2, units: "rounds", expired: true })).toBe(true);
  });

  it("НЕСЧИТАЕМЫЙ остаток не истекает — даже когда ядро подняло флаг (wdbc-tr02)", () => {
    // Срок в РАУНДАХ вне боя: ядро не может посчитать остаток (Infinity) и при
    // этом само поднимает expired на любой тик мирового времени — вне боя оно
    // считает удовлетворённым любое боевое событие истечения
    // (client/documents/active-effect.mjs::isExpiryEvent). Доверять флагу в
    // этот момент значит снимать «Оглушение на 2 раунда» ДО начала боя.
    expect(isDurationExpired({ value: 2, units: "rounds", remaining: Infinity, expired: true })).toBe(false);
  });

  it("посчитанный остаток важнее флага в обе стороны", () => {
    expect(isDurationExpired({ value: 2, units: "rounds", remaining: 0, expired: false })).toBe(true);
    expect(isDurationExpired({ value: 2, units: "rounds", remaining: 2, expired: true })).toBe(false);
  });

  it("бессрочное не истекает НИКОГДА — иначе подметание сняло бы всё разом", () => {
    expect(isDurationExpired({})).toBe(false);
    expect(isDurationExpired(null)).toBe(false);
    expect(isDurationExpired({ value: null, units: "seconds", expired: true })).toBe(false);
    expect(isDurationExpired(prepared({ remaining: Infinity }))).toBe(false);
  });
});

describe("remainingRounds: то число, что видит игрок вместо прежнего счётчика", () => {
  it("раундовый срок отдаётся как есть", () => {
    expect(remainingRounds(prepared({ units: "rounds", remaining: 2 }))).toBe(2);
    expect(remainingRounds(prepared({ units: "turns", remaining: 4 }))).toBe(4);
  });

  it("время переводится в Раунды ВВЕРХ — неполный Раунд ещё идёт, а не пропал", () => {
    const d = (secs) => prepared({ units: "minutes", remaining: 1, secondsRemaining: secs });
    expect(remainingRounds(d(60))).toBe(60 / SECONDS_PER_ROUND);
    // 55 секунд осталось — это ещё целых 10 Раундов, а не 9
    expect(remainingRounds(d(55))).toBe(10);
    expect(remainingRounds(d(1))).toBe(1);
  });

  it("отрицательный остаток не уходит в минус", () => {
    expect(remainingRounds(prepared({ remaining: -5 }))).toBe(0);
  });

  it("срока нет вовсе — null, а не 0", () => {
    expect(remainingRounds({})).toBeNull();
    expect(remainingRounds(null)).toBeNull();
  });
});

describe("remainingLabel: остаток словами", () => {
  it("показывается СВОИМИ единицами, а не сотнями Раундов", () => {
    expect(remainingLabel(prepared({ units: "hours", remaining: 1 }))).toBe("1 час");
    expect(remainingLabel(prepared({ units: "minutes", remaining: 30 }))).toBe("30 минут");
    expect(remainingLabel(prepared({ units: "rounds", remaining: 2 }))).toBe("2 раунда");
  });

  it("бессрочное и истёкшее — пустая строка", () => {
    expect(remainingLabel({})).toBe("");
    expect(remainingLabel(prepared({ remaining: 0 }))).toBe("");
  });
});

describe("conditionEntryTerm: срок из записи Конструктора", () => {
  it("явный срок читается как задан", () => {
    expect(conditionEntryTerm({ condKey: "stunned", condDurationValue: "10", condDurationUnit: "minutes" }))
      .toEqual({ value: "10", unit: "minutes" });
  });

  it("пустая единица у НОВОЙ записи — срока нет (wdbc-5zu5)", () => {
    // Ключ есть и пуст — автор срока не просил. Раньше это принималось за
    // «старую запись», и предмет тихо навешивал жертве ровно 1 раунд.
    expect(conditionEntryTerm({ condKey: "stunned", condLevel: "1", condDurationUnit: "" }))
      .toEqual({ value: "1", unit: "" });
  });

  it("запись БЕЗ ключа единицы — старая, её condLevel и был сроком в раундах", () => {
    expect(conditionEntryTerm({ condKey: "stunned", condLevel: "2" }))
      .toEqual({ value: "2", unit: "rounds" });
  });

  it("старая запись у Состояния без счётчика «раунды» срока не получает", () => {
    expect(conditionEntryTerm({ condKey: "prone", condLevel: "2" })).toEqual({ value: 0, unit: "" });
    expect(conditionEntryTerm({ condKey: "bleeding", condLevel: "2" })).toEqual({ value: 0, unit: "" });
  });
});

describe("conditionHasLevelInput", () => {
  it("сила есть у счётчиков «уровни/штуки», а «раунды» — это срок", () => {
    expect(conditionHasLevelInput("bleeding")).toBe(true);
    expect(conditionHasLevelInput("stunned")).toBe(false);
    expect(conditionHasLevelInput("prone")).toBe(false);
  });
});
