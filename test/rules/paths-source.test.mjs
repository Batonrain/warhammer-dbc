// test/rules/paths-source.test.mjs
//
// Фундамент под Пути Азуриан (wdbc-4e60): восьмой источник правил и условие по
// градации Пути.
//
// До него Путь не мог повлиять на правила НИКАК. Пути хранятся полем актора
// (system.paths — [{key, grade}]), предметами не являются, а возможности в этой
// системе раздают только источники правил — и источника по Путям среди семи
// зарегистрированных не было. Из 120 описанных градаций система считала сама
// лишь дюжину пассивных чисел (charBonus/corLimit), остальное держал в голове ГМ.
//
// Первый потребитель — Стрела Кхейна: «Персонаж, обладающий любым Путем Воина
// на уровне Следующий, может стрелять из этого оружия держа его в одной руке
// без траты в Rng» (Книга Аэльдари, Арсенал / Сюрикен оружие). Проверяется вся
// цепочка: градация → возможность → хват в бюджете рук.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { hasPathGrade, pathRules, AZURIANE_PATHS, PATH_GRADE_ORDER } from "../../module/constants/aeldari-paths.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { isPathOneHandedWeapon } from "../../module/rules/library/paths.mjs";
import { handsOccupied } from "../../module/rules/hands.mjs";

const warriorPathKeys = Object.entries(AZURIANE_PATHS)
  .filter(([, p]) => p.group === "Путь Воина").map(([k]) => k);

describe("hasPathGrade — условие по градации Пути", () => {
  it("группа: любой из десяти Путей Воина на уровне Следующий", () => {
    expect(warriorPathKeys.length).toBe(10);
    for (const key of warriorPathKeys) {
      expect(hasPathGrade([{ key, grade: "next" }], { group: "Путь Воина", grade: "next" }), key).toBe(true);
    }
  });

  it("«не ниже»: Мастер подходит там, где книга просит Следующего, Новичок — нет", () => {
    const want = { group: "Путь Воина", grade: "next" };
    expect(hasPathGrade([{ key: "banshee", grade: "master" }], want)).toBe(true);
    expect(hasPathGrade([{ key: "banshee", grade: "lost" }], want)).toBe(true);
    expect(hasPathGrade([{ key: "banshee", grade: "novice" }], want)).toBe(false);
  });

  it("чужая группа не подходит: Путь Видящих — не Путь Воина", () => {
    expect(hasPathGrade([{ key: "farseer", grade: "master" }], { group: "Путь Воина", grade: "next" })).toBe(false);
    expect(hasPathGrade([{ key: "farseer", grade: "master" }], { group: "Путь Видящих", grade: "next" })).toBe(true);
  });

  it("отбор по конкретному ключу — списком или одним", () => {
    const rows = [{ key: "scorpion", grade: "master" }];
    expect(hasPathGrade(rows, { key: "scorpion", grade: "novice" })).toBe(true);
    expect(hasPathGrade(rows, { key: ["banshee", "scorpion"], grade: "novice" })).toBe(true);
    expect(hasPathGrade(rows, { key: "banshee", grade: "novice" })).toBe(false);
  });

  it("мусор не роняет и не срабатывает: нет Путей, чужой ключ, чужая градация", () => {
    expect(hasPathGrade(undefined, { grade: "novice" })).toBe(false);
    expect(hasPathGrade([], { grade: "novice" })).toBe(false);
    expect(hasPathGrade([{ key: "нетакого", grade: "master" }], { grade: "novice" })).toBe(false);
    expect(hasPathGrade([{ key: "banshee", grade: "выдумка" }], { grade: "novice" })).toBe(false);
    expect(hasPathGrade([{ key: "banshee", grade: "master" }], { grade: "выдумка" })).toBe(false);
  });

  it("группа есть только у Путей Воина и Видящих — остальные пятнадцать самостоятельны", () => {
    // Это не пробел в данных: книга Аэльдари («II. ПУТИ АЗУРИАНА») объединяет
    // заголовками ровно две группы, остальные Пути стоят отдельными разделами.
    // Тест держит эту проверенную по книге картину: если у кого-то появится
    // группа, её должен был поставить человек, читавший книгу, а не догадка.
    const groups = {};
    for (const p of Object.values(AZURIANE_PATHS)) groups[p.group ?? "(без группы)"] = (groups[p.group ?? "(без группы)"] || 0) + 1;
    expect(groups).toEqual({ "Путь Воина": 10, "Путь Видящих": 5, "(без группы)": 15 });
  });
});

describe("предикат pathGradeMin", () => {
  const actor = paths => ({ system: { paths }, items: [] });

  it("читает system.paths актора", () => {
    expect(PREDICATES.pathGradeMin(actor([{ key: "banshee", grade: "next" }]), {},
      { group: "Путь Воина", grade: "next" })).toBe(true);
    expect(PREDICATES.pathGradeMin(actor([]), {}, { group: "Путь Воина", grade: "next" })).toBe(false);
  });
});

describe("pathRules — правила достигнутых градаций собираются кумулятивно", () => {
  it("Мастер несёт и то, что дали Новичок и Следующий", () => {
    // Данных `rules` у градаций пока нет ни одной (машинная часть 108 градаций
    // ещё не написана) — проверяем на подставном Пути, что механизм работает и
    // что нижние градации не теряются.
    const fake = { key: "тест", grades: {
      novice: { rules: [{ id: "a", effects: [] }] },
      next:   { rules: [{ id: "b", effects: [] }] },
      master: { rules: [{ id: "c", effects: [] }] }
    } };
    // Подмена экспортируемой таблицы — сознательная и на один тест: другого
    // входа у pathRules() нет, она читает AZURIANE_PATHS по ключу записи.
    // Ключ заведомо не книжный, прежнее значение восстанавливается в finally.
    const had = Object.hasOwn(AZURIANE_PATHS, "__test");
    AZURIANE_PATHS.__test = fake;
    try {
      const got = pathRules([{ key: "__test", grade: "next" }]).map(r => r.id);
      expect(got).toEqual(["path.__test.novice.a", "path.__test.next.b"]);
      expect(PATH_GRADE_ORDER.indexOf("master")).toBeGreaterThan(PATH_GRADE_ORDER.indexOf("next"));
    } finally {
      if (!had) delete AZURIANE_PATHS.__test;
    }
  });

  it("сбор по каждому книжному Пути не падает и отдаёт правила с уникальными id", () => {
    // НЕ «сбор пуст»: сегодня поле `rules` у градаций не заполнено ни у кого,
    // но заполнить его — ровно то, ради чего pathRules() и написан. Тест,
    // требующий пустоты, покраснел бы от первой же честной записи данных.
    for (const key of Object.keys(AZURIANE_PATHS)) {
      const rules = pathRules([{ key, grade: "lost" }]);
      expect(Array.isArray(rules), key).toBe(true);
      expect(new Set(rules.map(r => r.id)).size, key).toBe(rules.length);
      for (const r of rules) expect(r.label, `${key}: правило без подписи`).toBeTruthy();
    }
  });
});

describe("Стрела Кхейна: возможность и хват", () => {
  // hudGrip "1р" — выбор игрока в окне атаки. Он УЧИТЫВАЕТСЯ, только если такой
  // хват вообще доступен: собственный грип Стрелы — «2р», и «1р» появляется в
  // списке только от возможности. Без неё выбор молча откатывается к «2р» —
  // ровно поэтому проверяется именно этот случай, а не хват по умолчанию.
  const weapon = (id, name) => ({
    id, name, type: "weapon",
    system: { weaponClass: "basic", grips: "2р", equipped: true, weaponProps: [] },
    getFlag: (ns, key) => (key === "hudGrip" ? "1р" : undefined)
  });
  const arrow  = weapon("w1", "Стрела Кхейна");
  const lasgun = weapon("w2", "Лазган / Lasgun");
  const hero = (paths, items) => {
    const list = [...items];
    list.get = id => list.find(i => i.id === id) ?? null;
    list.contents = list;
    return { system: { paths, conditions: {}, characteristics: { s: { bonus: 4 } } }, items: list };
  };

  it("опознаётся по любой половине имени, чужое оружие — нет", () => {
    expect(isPathOneHandedWeapon(arrow)).toBe(true);
    expect(isPathOneHandedWeapon({ name: "Khaine's Arrow" })).toBe(true);
    expect(isPathOneHandedWeapon(lasgun)).toBe(false);
  });

  it("Путь Воина уровня Следующий выдаёт возможность, Новичок — нет", () => {
    expect(hasRuleFlag(hero([{ key: "banshee", grade: "next" }], []), "weapon.oneHandedWarriorPath")).toBe(true);
    expect(hasRuleFlag(hero([{ key: "banshee", grade: "novice" }], []), "weapon.oneHandedWarriorPath")).toBe(false);
    expect(hasRuleFlag(hero([{ key: "farseer", grade: "lost" }], []), "weapon.oneHandedWarriorPath")).toBe(false);
  });

  it("бюджет рук: Стрела занимает одну руку у адепта и две у всех остальных", () => {
    const withPath = hero([{ key: "banshee", grade: "next" }], [arrow]);
    const without  = hero([{ key: "banshee", grade: "novice" }], [arrow]);
    expect(handsOccupied(withPath).used).toBe(1);   // выбранный «1р» доступен
    expect(handsOccupied(without).used).toBe(2);   // «1р» недоступен — откат к «2р»
  });

  it("возможность не делает одноручным чужое оружие того же класса", () => {
    const withPath = hero([{ key: "banshee", grade: "next" }], [lasgun]);
    expect(handsOccupied(withPath).used).toBe(2);
  });
});
