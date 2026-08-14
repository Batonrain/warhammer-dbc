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
import { ritualsContext, ritualTestContext } from "../../module/sheets/tabs/rituals.mjs";

/** Актор с произвольным набором предметов. */
const actorWith = (...items) => ({ items });

/** Ритуал. flags — то, что вернёт getFlag: наборы групп-требований. */
const ritual = (id, name, system = {}, flags = {}) => ({
  id, name, type: "ritual", system,
  getFlag: (_scope, key) => flags[key]
});

/** Группа требований по расам: operator задаёт И/ИЛИ между ними. */
const raceGroup = (operator, ...raceKeys) => ({
  id: "g", operator,
  entries: raceKeys.map((raceKey, n) => ({ id: `e${n}`, kind: "reqRace", raceKey }))
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
        req:       [raceGroup("AND", "drukhari")],
        assistReq: [raceGroup("AND", "human")]
      })
    ));

    expect(ctx[0].reqLines).toEqual(["Раса: Друкхари"]);
    expect(ctx[0].assistReqLines).toEqual(["Раса: Человек"]);
  });

  it("ИЛИ-группа показывается как выбор, а не как список обязательных", () => {
    // Схлопывание групп в один плоский список переворачивало смысл ИЛИ на
    // противоположный: альтернативы читались как обязательные разом.
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Или то, или это", {}, { req: [raceGroup("OR", "drukhari", "human")] })
    ));

    expect(ctx[0].reqLines).toEqual(["одно из: Раса: Друкхари / Раса: Человек"]);
  });

  it("И-группа перечисляет условия через точку с запятой", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "И то, и это", {}, { req: [raceGroup("AND", "drukhari", "human")] })
    ));

    expect(ctx[0].reqLines).toEqual(["Раса: Друкхари; Раса: Человек"]);
  });

  it("группы между собой — отдельными строками", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Две группы", {}, {
        req: [raceGroup("AND", "drukhari"), raceGroup("OR", "human")]
      })
    ));

    expect(ctx[0].reqLines).toHaveLength(2);
  });

  it("незаполненные условия в строки не попадают, пустая группа не даёт строки", () => {
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Пустое условие", {}, { req: [raceGroup("AND", "")] })
    ));

    expect(ctx[0].reqLines).toEqual([]);
  });

  it("одни Требования без прозы всё равно считаются содержимым", () => {
    // Иначе строка показала бы разобранные требования И «описание не
    // заполнено» разом — так было в исходной ветке.
    const ctx = ritualsContext(actorWith(
      ritual("r1", "Только требования", {}, { req: [raceGroup("AND", "drukhari")] })
    ));

    expect(ctx[0].hasAnyText).toBe(true);
  });

  // Путь проведения лежал в схеме с настоящими данными пресетов, но лист его
  // не рисовал: игрок не видел, каким Навыком кидается ритуал и что у него
  // −20, а Мастер не мог исправить ошибку (wdbc-lla). Список навыков зависит
  // от вида: обычный и групповой — разные наборы, и один список на оба дал бы
  // ключ, которого у актора не бывает.
  describe("поля теста на листе предмета", () => {
    it("вид «групповой» даёт групповые навыки и отмечает выбранный", () => {
      const ctx = ritualTestContext(ritual("r1", "Зов", {
        testSkillScope: "group", testSkillKey: "forbiddenLore", testChar: "wp"
      }));

      expect(ctx.isGroupSkill).toBe(true);
      expect(ctx.skills.find(s => s.key === "forbiddenLore")?.selected).toBe(true);
      expect(ctx.skills.some(s => s.key === "awareness")).toBe(false);
    });

    it("вид «обычный» даёт обычные навыки", () => {
      const ctx = ritualTestContext(ritual("r1", "Круг", {
        testSkillScope: "plain", testSkillKey: "awareness"
      }));

      expect(ctx.isGroupSkill).toBe(false);
      expect(ctx.skills.find(s => s.key === "awareness")?.selected).toBe(true);
      expect(ctx.skills.some(s => s.key === "forbiddenLore")).toBe(false);
    });

    it("характеристика теста отмечается, по умолчанию Интеллект", () => {
      const chosen = ritualTestContext(ritual("r1", "Зов", { testChar: "wp" }));
      expect(chosen.chars.find(c => c.key === "wp")?.selected).toBe(true);

      const empty = ritualTestContext(ritual("r1", "Зов", {}));
      expect(empty.chars.find(c => c.key === "int")?.selected).toBe(true);
    });
  });

  it("общее Описание предмета тоже показывается и считается содержимым", () => {
    // ОПИСАНИЕ есть у любого типа предмета и правится на листе; без него
    // заполненный текст был бы недостижим с листа актора.
    const ctx = ritualsContext(actorWith(
      ritual("r1", "С описанием", { description: "Круг чертится мелом" })
    ));

    expect(ctx[0].description).toBe("Круг чертится мелом");
    expect(ctx[0].hasAnyText).toBe(true);
  });
});
