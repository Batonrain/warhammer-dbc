// test/documents/implant-code-bonus.test.mjs
//
// Отчёт игроков (wdbc-cy2): «даваемые свойства имплантов вшиты внутрь листа без
// видимых значений — просто пустой лист, но почему-то дающий бонус к статам».
//
// Источник — IMPLANT_MECH (constants/implant-mechanics.mjs): таблица regex по
// ИМЕНИ предмета, которую prepareDerivedData складывал напрямую. На листе она
// печаталась строкой-справкой «Авто:», править её было негде, и ни в эффектах,
// ни в Конструкторе предмета её не видно.
//
// Хуже того, у трёх имплантов пака ровно та же надбавка лежит и в
// system.effects — актор складывал обе, и бонус выходил двойной. Проверка
// №1 держит именно этот случай.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { IMPLANT_MECH, implantTableEffects } from "../../module/constants/implant-mechanics.mjs";
import { CHARACTERISTICS } from "../../module/constants/characteristics.mjs";
import { legacyEffectsToChanges, EFFECT_KEY_WHITELIST } from "../../module/constants/effect-keys.mjs";

/** Установленный имплант: цикл надбавок читает только это. */
function implant(name, effects = {}) {
  return { id: `implant-${name}`, name, type: "implant",
           system: { effects, category: "cybernetic" },
           getFlag: (_s, k) => (k === "installed" ? true : undefined) };
}

/** Персонаж: Сила и Стойкость 40 (бонус 4 у обеих), без брони. */
function characterWith(items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.s.base = 40;
  system.characteristics.t.base = 40;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("числовая роспись IMPLANT_MECH больше не применяется из кода", () => {
  it("надбавка не задваивается с тем же бонусом из system.effects", () => {
    // Крукс Механикус: в таблице un {s:2,t:2}, и ровно то же в паке —
    // charBonuses [{s:2},{t:2}]. Складывались оба: S.b 4 → 8 вместо 6.
    const system = characterWith([
      implant("Crux Mechanicus / Крукс Механикус",
              { charBonuses: [{ stat: "s", value: 2 }, { stat: "t", value: 2 }] })
    ]);

    expect(system.characteristics.s.bonus).toBe(6);
    expect(system.characteristics.t.bonus).toBe(6);
  });

  it("имплант без старого поля из кода надбавку не получает", () => {
    // Синтемускул: в таблице un {s:2}, в паке пусто. Теперь число приезжает
    // эффектом (packs-src + миграция), а не именем предмета.
    const system = characterWith([implant("Synthmuscle / Синтемускул")]);

    expect(system.characteristics.s.bonus).toBe(4);
  });

  it("броня из таблицы тоже не начисляется мимо эффектов", () => {
    // Черепная Броня: в таблице ap {head:1}, в паке пусто.
    // Поглощение без брони = T.b, то есть 4.
    const system = characterWith([implant("Cranial Armour / Черепная Броня")]);

    expect(system.absorption.head).toBe(4);
  });

  it("надбавка к ЗНАЧЕНИЮ характеристики — тоже", () => {
    // Бионическое Сердце: в таблице val {t:1}, в паке пусто.
    const system = characterWith([implant("Bionic Heart / Бионическое Сердце")]);

    expect(system.characteristics.t.total).toBe(40);
  });
});

// Роспись осталась источником переноса для уже розданных копий, так что её
// ключи должны быть настоящими. Кортикальный Имплант писал в `i` — такой
// характеристики нет вовсе (она `int`), и Unnatural I (+2) не работал никогда:
// надбавка ложилась в несуществующее поле и молча пропадала.
// Жалоба игрока (bugfix-tech-wonders): «катушка потентия в Техночудесах
// заполняется от руки, сам не ставится» — базовый имплант Potentia Coil не
// нёс energyMax вовсе, и максимум Энергии приходилось вбивать вручную на
// вкладке ТЕХ, хотя книга задаёт его Качеством импланта (Poor 1/Common 3/
// Good 5/Best 7).
describe("Катушка Потенции: базовый максимум Энергии по Качеству", () => {
  function coil(quality) {
    return { id: `coil-${quality}`, name: "Potentia Coil / Потенциа Коил", type: "implant",
             system: { effects: {}, category: "cybernetic", quality },
             getFlag: (_s, k) => (k === "installed" ? true : undefined) };
  }

  it.each([
    ["poor", 1], ["common", 3], ["good", 5], ["best", 7]
  ])("Качество %s даёт maxTotal %i без ручного ввода", (quality, expected) => {
    const system = characterWith([coil(quality)]);

    expect(system.energy.maxTotal).toBe(expected);
  });

  it("Мотивные Банки складываются с базой Катушки Потенции", () => {
    const system = characterWith([
      coil("common"),
      { id: "banks", name: "Manipulus Motive Banks / Мотивные Банки Манипулюс", type: "implant",
        system: { effects: {}, category: "cybernetic", quality: "common" },
        getFlag: (_s, k) => (k === "installed" ? true : undefined) }
    ]);

    expect(system.energy.maxTotal).toBe(8); // 3 (Катушка, Common) + 5 (Банки)
  });
});

// Жалоба игрока: «абейянт заполняет 3 потенции в ход, вместо 2 когниции,
// 1 потенции» — обе строки generate шли в energy (⚡), хотя по книге (стр.
// 276) при подключении техножрец восстанавливает Когницию разово и Энергию
// по Ходу отдельно.
describe("Абейянт: генерация ресурсов по подключению", () => {
  it("разово даёт Когницию, а не Энергию", () => {
    const mech = IMPLANT_MECH.find(m => m.re.test("Abeyant / Абейянт"));

    const onConnect = mech.gen.find(g => g.action === "free");
    const perTurn   = mech.gen.find(g => g.action === "turn");

    expect(onConnect).toMatchObject({ res: "cognition", amount: 2 });
    expect(perTurn).toMatchObject({ res: "energy", amount: 1 });
  });
});

// wdbc-9bzv: energyMax/compensator/ironFocus раньше жили ТОЛЬКО в IMPLANT_MECH
// по имени — переименование импланта в паке молча обнуляло Энергию/
// Компенсатор/Технофокус. Теперь эти три директивы читаются в первую очередь
// со схемы самого предмета; таблица остаётся фоллбэком для немигрированных
// легаси-копий (последний тест ниже).
describe("energyMax/compensator/ironFocus: со схемы предмета, не по имени", () => {
  function implantSchema(name, extra = {}) {
    return { id: `implant-${name}`, name, type: "implant",
             system: { effects: {}, category: "cybernetic", quality: "common", ...extra },
             getFlag: (_s, k) => (k === "installed" ? true : undefined) };
  }

  it("energyMax в схеме работает даже при имени, не совпадающем ни с одной записью таблицы", () => {
    const system = characterWith([
      implantSchema("Renamed Potentia Coil", { energyMax: { poor: 0, common: 3, good: 0, best: 0 } })
    ]);
    expect(system.energy.maxTotal).toBe(3);
  });

  it("compensator в схеме работает даже при имени, не совпадающем ни с одной записью таблицы", () => {
    const system = characterWith([
      implantSchema("Renamed Infernia Coil", { compensator: { poor: 0, common: 10, good: 0, best: 0 } })
    ]);
    expect(system.techCompBonus).toBe(10);
  });

  it("ironFocus в схеме работает даже при имени, не совпадающем ни с одной записью таблицы", () => {
    const system = characterWith([implantSchema("Renamed EFM Circuits", { ironFocus: true })]);
    expect(system.techFocus).toHaveLength(1);
    expect(system.techFocus[0].name).toBe("Renamed EFM Circuits");
  });

  it("легаси-имплант без полей схемы всё ещё получает бонус по таблице (фоллбэк)", () => {
    const system = characterWith([implantSchema("Potentia Coil / Потенциа Коил")]);
    expect(system.energy.maxTotal).toBe(3); // common → 3 из таблицы IMPLANT_MECH
  });
});

describe("ключи числовой росписи", () => {
  it("каждая характеристика в un/val существует", () => {
    const bad = [];
    for (const entry of IMPLANT_MECH)
      for (const field of ["un", "val"])
        for (const stat of Object.keys(entry[field] || {}))
          if (!CHARACTERISTICS[stat]) bad.push(`${stat} в ${entry.re}`);

    expect(bad).toEqual([]);
  });

  it("каждая локация в ap известна переводу", () => {
    const known = ["all", "head", "body", "arms", "legs"];
    const bad = [];
    for (const entry of IMPLANT_MECH)
      for (const loc of Object.keys(entry.ap || {}))
        if (!known.includes(loc)) bad.push(`${loc} в ${entry.re}`);

    expect(bad).toEqual([]);
  });

  it("перевод в старый формат даёт ключи из вайтлиста эффектов", () => {
    // Обе ветки разом: Unnatural (un), значение (val), броня (ap).
    const changes = [
      ...legacyEffectsToChanges(implantTableEffects("Crux Mechanicus / Крукс Механикус")),
      ...legacyEffectsToChanges(implantTableEffects("Bionic Heart / Бионическое Сердце")),
      ...legacyEffectsToChanges(implantTableEffects("Subdermal Armour / Подкожная Броня"))
    ];

    expect(changes.length).toBeGreaterThan(0);
    expect(changes.filter(c => !EFFECT_KEY_WHITELIST.includes(c.key))).toEqual([]);
  });
});
