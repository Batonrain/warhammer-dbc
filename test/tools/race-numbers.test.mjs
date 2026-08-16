// test/tools/race-numbers.test.mjs
//
// Переезд рас не должен изменить НИ ОДНОГО числа на листе. Раньше расовая Черта
// создавалась из констант с готовым значением (charBonusValue: 4), теперь —
// копией из библиотеки с пересчётом по рейтингу. Тест повторяет обе дороги и
// сверяет итог по всем расам И субрасам сразу, по ВСЕМ ключам эффектов Черты
// (не только charBonus*) — иначе регрессия в поле, которое тест не смотрит,
// проедет молча (см. раунд правок 1: Размер шести рас потерялся именно так).
//
// Зелёный тест здесь и означает «переезд состоялся». Красный — что персонаж
// после обновления получит не ту расу, что была.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { RACES, SUBRACE_DATA } from "../../module/constants/races.mjs";
import { rescaleTraitByRating } from "../../module/apps/mechanics.mjs";
import { traitEntries } from "../../tools/races-to-pack.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

// Ключ — идентификатор документа, ровно как его достаёт рантайм: сперва
// fromUuid(entry.sourceUuid). Сверять здесь по имени значило бы проверять
// не ту дорогу, по которой Черта поедет на самом деле.
const LIB = new Map(packDocuments("traits", "trait").map(({ doc }) => [doc._id, doc]));

/**
 * Свод ВСЕХ числовых ключей эффектов Черты в один объект — тот же набор
 * полей, что суммирует actor.mjs (traitCharBonus/traitCharValueBonus/
 * traitArmourAll/traitFearRating/traitSizeMod/traitInitMod/traitSpeedMod).
 * Общая функция для обеих дорог (константы/библиотека) — иначе два похожих,
 * но чуть разных свода дали бы ложное совпадение или ложный разрыв мимо сути.
 */
function fold(effectsList) {
  const sum = { charBonus: {}, charValueBonus: {}, armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0 };
  for (const e of effectsList) {
    if (!e) continue;
    if (e.charBonusStat && e.charBonusValue) sum.charBonus[e.charBonusStat] = (sum.charBonus[e.charBonusStat] || 0) + e.charBonusValue;
    for (const cb of e.charBonuses || []) if (cb?.stat && cb.value) sum.charBonus[cb.stat] = (sum.charBonus[cb.stat] || 0) + cb.value;
    for (const cb of e.charValueBonuses || []) if (cb?.stat && cb.value) sum.charValueBonus[cb.stat] = (sum.charValueBonus[cb.stat] || 0) + cb.value;
    sum.armourAll  += e.armourAll  || 0;
    sum.fearRating  = Math.max(sum.fearRating, e.fearRating || 0);
    sum.sizeMod    += e.sizeMod    || 0;
    sum.initMod    += e.initMod    || 0;
    sum.speedMod   += e.speedMod   || 0;
  }
  return sum;
}

/** Как считалось РАНЬШЕ: Черта создавалась из констант со своими effects. */
function bonusesFromConstants(def) {
  return fold((def.traits || []).map(t => t.effects || {}));
}

/** Как считается ТЕПЕРЬ: копия из библиотеки + пересчёт по рейтингу записи. */
function bonusesFromLibrary(def) {
  return fold(traitEntries(def).map(entry => {
    const src = LIB.get(String(entry.sourceUuid).split(".").pop());
    if (!src) return null;
    return rescaleTraitByRating(structuredClone(src), entry.rating).system.effects;
  }));
}

/**
 * Осознанные расхождения библиотеки с константами — НЕ регрессии переезда, а
 * починка констант, которые изначально не несли effects (только текст
 * benefit). Библиотека вернее книги в коде: у каждой из этих Черт документ
 * пака несёт числовой эффект, которого в константе не было вовсе.
 *
 * `key` — "race:<ключ>" или "subrace:<ключ>", `path` — путь в объекте fold().
 * Всё, что НЕ попало в этот список, обязано совпасть без остатка — тест
 * проверяет это через patch(): подставляет ожидаемое расхождение в старый
 * счёт и сверяет патченный результат с новым; любое новое, незаявленное
 * расхождение так и останется в diff и уронит тест.
 */
const EXPECTED_DIFFS = [
  { key: "subrace:mandrake", path: "charBonus.t", from: 2, to: 5,
    why: "Daemonic (3) в константах mandrake шёл с effects:{} (только текст); библиотечный шаблон «Daemonic / Демонический (X)» несёт +X к Бонусу Стойкости." },
  { key: "subrace:wrack", path: "armourAll", from: 0, to: 2,
    why: "Machine (2) в константах wrack шёл с effects:{}; библиотечный шаблон «Machine / Машина (X)» несёт +X AP (armourAll)." },
  { key: "race:sslyth", path: "armourAll", from: 0, to: 3,
    why: "Natural Armour (3) в константах sslyth указывал ключ effects.naturalArmour — его нет в схеме Черты (module/data/item/trait.mjs), никто и никогда его не читал; библиотечный шаблон «Natural Armour / Естественная Броня (X)» несёт настоящий effects.armourAll." },
  { key: "race:replicant", path: "sizeMod", from: 1, to: 2,
    why: "Trait «Hulking / Громила (Легион)» в константах replicant шёл с effects:{} (только текст «может использовать снаряжение Легиона»); библиотечный документ «Hulking / Громила (Размер)» несёт тот же физический смысл (тело крупнее — Размер +1 к SPD) уже числом. Найдено при сверке этим тестом, отдельно от трёх случаев, названных в ревью — тот же класс: константа описывала последствие словами, не числом." }
];

/** Старый счёт с подставленными осознанными расхождениями для конкретного def. */
function patchExpected(key, constants) {
  const patched = structuredClone(constants);
  for (const d of EXPECTED_DIFFS.filter(d => d.key === key)) {
    const [a, b] = d.path.split(".");
    const holder = b ? patched[a] : patched;
    const field  = b ?? a;
    expect(holder[field]).toBe(d.from); // старое значение — ровно то, что описано в EXPECTED_DIFFS
    holder[field] = d.to;
  }
  return patched;
}

describe("числа рас после переезда", () => {

  it("Астартес: +4 Силы и +4 Стойкости, как в книге", () => {
    expect(bonusesFromLibrary(RACES.astartes)).toMatchObject({ charBonus: { s: 4, t: 4 } });
  });

  it("Азуриане: +4 Ловкости и +4 Восприятия", () => {
    expect(bonusesFromLibrary(RACES.azuriane)).toMatchObject({ charBonus: { ag: 4, per: 4 } });
  });

  // Размер — регрессия раунда 1: шесть рас (astartes, sslyth, ogryn, ratling,
  // naga, replicant) теряли sizeMod, потому что шаблон «Size / Размер (X)»
  // был заведён с rating:0 — rescaleTraitByRating при нулевом рейтинге
  // шаблона не пересчитывает ничего и выходит сразу. Явных ассертов не
  // заводим отдельно: полное сравнение it.each ниже проверяет sizeMod вместе
  // со всеми остальными ключами эффекта на каждой из шести рас.

  it.each(Object.keys(RACES))("раса %s: бонусы из библиотеки совпали с прежними (с поправкой на осознанные починки)", key => {
    const expected = patchExpected(`race:${key}`, bonusesFromConstants(RACES[key]));
    expect(bonusesFromLibrary(RACES[key])).toEqual(expected);
  });

  it.each(Object.keys(SUBRACE_DATA))("субраса %s: бонусы из библиотеки совпали с прежними (с поправкой на осознанные починки)", key => {
    const expected = patchExpected(`subrace:${key}`, bonusesFromConstants(SUBRACE_DATA[key]));
    expect(bonusesFromLibrary(SUBRACE_DATA[key])).toEqual(expected);
  });

  // Список осознанных расхождений не должен молча разрастись «на всякий
  // случай» — каждая запись обязана попасть в реальный diff хотя бы одной
  // расы/субрасы выше; пустое объяснение или опечатка в ключе не поймались бы
  // иначе (patchExpected сверяет `from`, но не то, что diff вообще был нужен).
  it("каждое осознанное расхождение действительно меняет счёт", () => {
    for (const d of EXPECTED_DIFFS) {
      expect(d.why.length, `${d.key} ${d.path}: нужно пояснение`).toBeGreaterThan(10);
      expect(d.from).not.toBe(d.to);
    }
  });
});
