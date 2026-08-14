// test/sheets/rituals-tab.test.mjs
//
// Раздел «Ритуалы» на вкладке Способности. Считается всё из предметов актора
// и таблицы RITUAL_ITEM_TYPES, поэтому заглушка Foundry в результат не входит.
//
// Проверяется ровно то, что раздел показывает: метка раздела книги, Запись,
// вилка ассистентов и признак «есть ли что раскрывать». Последний важен:
// у ритуалов, разложенных из пресетов, проза пустая, и без признака строка
// раскрывалась бы в пустоту вместо честного «описание не заполнено».

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { ritualsContext } from "../../module/sheets/tabs/rituals.mjs";

/** Актор с произвольным набором предметов. */
const actorWith = (...items) => ({ items });

/** Ритуал. flags — то, что вернёт getFlag: наборы групп-требований. */
const ritual = (id, name, system = {}, flags = {}) => ({
  id, name, type: "ritual", system,
  getFlag: (_scope, key) => flags[key]
});

/** Группа требований с одним заполненным условием по расе. */
const raceGroup = raceKey => ({
  id: "g", operator: "AND",
  entries: [{ id: "e", kind: "reqRace", raceKey }]
});

describe("раздел Ритуалов", () => {

  it("берёт только предметы-ритуалы", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Призыв Низшего Демона", { ritualType: "summon" }),
      { id: "t1", name: "Дознаватель", type: "talent", system: {} }
    ));

    expect(ctx.map(r => r.id)).toEqual(["r1"]);
  });

  it("переводит раздел книги в метку, неизвестный ключ оставляет как есть", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Круг", { ritualType: "circle" }),
      ritual("r2", "Странное", { ritualType: "нетТакого" }),
      ritual("r3", "Пустое", {})
    ));

    expect(ctx.map(r => r.typeLabel)).toEqual(["Круг", "нетТакого", "—"]);
  });

  it("вилка ассистентов: есть числа — показывает, нули — прочерк", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "С помощниками", { assistMin: 2, assistMax: 8 }),
      ritual("r2", "Только максимум", { assistMin: 0, assistMax: 4 }),
      ritual("r3", "В одиночку", { assistMin: 0, assistMax: 0 })
    ));

    expect(ctx.map(r => r.assistLabel)).toEqual(["2—8", "0—4", "—"]);
  });

  it("Запись читается числом, мусор считается нулём", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Третья запись", { record: 3 }),
      ritual("r2", "Без записи", {})
    ));

    expect(ctx.map(r => r.record)).toEqual([3, 0]);
  });

  it("признак раскрытия: хотя бы одно прозаическое поле заполнено", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Из пресета", { procedure: "", result: "", cost: "", failureCost: "" }),
      ritual("r2", "Вычитанный", { procedure: "", result: "Демон является", cost: "", failureCost: "" })
    ));

    expect(ctx.map(r => r.hasAnyText)).toEqual([false, true]);
  });

  it("механические Требования разбираются в строки текста", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "С требованиями", {}, {
        req:       [raceGroup("drukhari")],
        assistReq: [raceGroup("human")]
      })
    ));

    expect(ctx[0].reqLines).toEqual(["Раса: Друкхари"]);
    expect(ctx[0].assistReqLines).toEqual(["Раса: Человек"]);
  });

  it("незаполненные условия в строки не попадают", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Пустое условие", {}, { req: [raceGroup("")] })
    ));

    expect(ctx[0].reqLines).toEqual([]);
  });

  it("одни Требования без прозы всё равно считаются содержимым", () => {
    // Иначе строка показала бы разобранные требования И «описание не
    // заполнено» разом — так было в исходной ветке.
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Только требования", {}, { req: [raceGroup("drukhari")] })
    ));

    expect(ctx[0].hasAnyText).toBe(true);
  });
});
