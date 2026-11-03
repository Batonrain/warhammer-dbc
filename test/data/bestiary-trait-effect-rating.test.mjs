// test/data/bestiary-trait-effect-rating.test.mjs
//
// Встроенная в существо Черта с рейтингом несёт эффект, и число в эффекте обязано
// совпадать с рейтингом в её названии: Unnatural S (4) — +4 к Бонусу Силы,
// Daemonic (2) — +2 к Бонусу Стойкости, Machine (2) / Natural Armour (2) — броня 2,
// Size (1) — Размер +1, Fear (2) — рейтинг Страха 2.
//
// Эффект при встраивании копируется с предмета-донора из пака Черт БЕЗ пересчёта под
// рейтинг существа. Так вышло 03.11.2026 (живая проверка): у Твари Ночи Daemonic (2)
// нёс эффект донора +1 (T.b 9 вместо 8), у Тех-Тралла Machine (2) — броню 3 (у шаблона
// Machine (3)). Тест ловит класс ошибки по ВСЕМУ бестиарию, а не двух конкретных
// существ: число эффекта берётся из того места, откуда его читает код
// (module/rules/character.mjs): у предмета с флагом migratedEffect — из встроенного
// ActiveEffect (system.changes), у остальных — из system.effects.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

// Черты, у которых рейтинг в названии = число эффекта. «Unnatural Senses (N)» не входит:
// это дальность в метрах, а не бонус Характеристики. Armament/Presence/Incorporeal —
// другие Черты с похожим началом имени и без числового эффекта по рейтингу.
const RATED = /^(Daemonic|Unnatural [A-Za-zСс]+|Machine|Natural Armour|Size|Fear)(?:\s*\/|\s*\(|\s*$)/;
const NOT_RATED_EFFECT = /Senses|Armament|Presence|Incorporeal|Dread/;

// Рейтинг есть, а эффекта нет — только с цитатой книги.
const NO_EFFECT_ALLOWED = {
  // Книга (aeldari-branches.json, Khymera): «T 35 +7 … T.b: 7 | Погл.: 7/7/7/7» при Unnatural T (4)
  // и Daemonic (4): 7 = 3 + 4, печатный профиль без Daemonic. Решение владельца 03.11.2026.
  "Khymera::Daemonic": "T.b 7 как напечатано в книге"
};

const en = (name) => String(name).split("/")[0].trim();
const present = (v) => !(v === "" || v == null || v === 0 || v === false || (Array.isArray(v) && !v.length));

/** Числа эффекта Черты — там, откуда их читает расчёт Характеристик. */
function effectNumbers(item) {
  const migrated = !!item.flags?.["warhammer-dbc"]?.migratedEffect;
  const fromAE = (item.effects ?? []).flatMap(e => (e.system?.changes ?? e.changes ?? []).map(c => Number(c.value)));
  if (migrated) return fromAE;
  const fx = item.system?.effects ?? {};
  const nums = [];
  for (const cb of fx.charBonuses ?? []) if (present(cb?.value)) nums.push(Number(cb.value));
  for (const k of ["charBonusValue", "armourAll", "sizeMod", "fearRating"]) if (present(fx[k])) nums.push(Number(fx[k]));
  return nums.concat(fromAE);
}

describe("бестиарий: число эффекта встроенной Черты = её рейтинг", () => {
  const docs = allPackDocuments("bestiary").map(({ doc }) => doc).filter(d => Array.isArray(d.items));
  const traits = docs.flatMap(d => d.items.filter(i => i.type === "trait" && RATED.test(en(i.name)) && !NOT_RATED_EFFECT.test(i.name))
    .map(i => ({ actor: en(d.name), item: i, trait: en(i.name) })));

  it("скан находит Черты с рейтингом во всех видах (иначе зелёный от пустоты)", () => {
    expect(traits.length).toBeGreaterThan(150);
    for (const stem of ["Daemonic", "Unnatural S", "Unnatural T", "Machine", "Natural Armour", "Size", "Fear"])
      expect(traits.some(t => t.trait.startsWith(stem)), stem).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("значение эффекта равно рейтингу в названии, эффект не пропал (исключения — с цитатой книги)", () => {
    const bad = [];
    const seen = new Set();
    for (const { actor, item, trait } of traits) {
      // Рейтинг стоит в конце ПОЛНОГО названия: «Machine / Машина (2)», «Daemonic (4)».
      const rating = (item.name.match(/\((\d+)\)(?!.*\(\d+\))/) || [])[1];
      if (rating == null) continue;
      const nums = effectNumbers(item);
      const key = `${actor}::${trait.replace(/\s*\(.*$/, "").replace(/\s*\/.*$/, "")}`;
      if (!nums.length) {
        if (key in NO_EFFECT_ALLOWED) seen.add(key);
        else bad.push(`${actor}: ${item.name} — рейтинг ${rating}, а эффекта нет`);
        continue;
      }
      const wrong = nums.filter(v => v !== Number(rating));
      if (wrong.length) bad.push(`${actor}: ${item.name} — эффект ${[...new Set(nums)].join("/")} ≠ рейтинг ${rating}`);
    }
    expect([...seen].sort(), "исключение без существа — уберите его из списка").toEqual(Object.keys(NO_EFFECT_ALLOWED).sort());
    expect(bad, bad.join("\n")).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});
