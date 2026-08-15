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
