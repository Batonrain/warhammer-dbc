// test/data/bestiary-body-type.test.mjs
//
// Пол существ бестиария — поле «Телосложение» (system.bodyType: male / female /
// other, constants/body-map.mjs::BODY_TYPES) — task-5fe7, решение владельца
// 02.10.2026. Поле читает «Предначертание» (Странная Неуязвимость, субмутация 0,
// combat/strange-invulnerability.mjs::applyPredestined): оно срабатывает только на
// атакующего с полом male/female, а на «Другое», Демона, Орду и Технику — нет.
//
// До правки у всех 36 существ стояло умолчание «Мужской»: от мутации отскакивали
// удары лошади и Кровавой Невесты, а при выпавшем «женском» поле не срабатывала
// ни на одно существо бестиария.
//
// Решение владельца: зверям, демонам без пола и прочим нелюдям — «Другое»;
// гуманоидам с явным полом в книге/записи — как там. Остальных гуманоидов
// (книга пол не называет) НЕ трогаем: они остаются «Мужской» и перечислены ниже
// поимённо — это не «так задумано», а открытый вопрос, и тест не даст
// превратить его в молчаливое решение.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { BODY_TYPES } from "../../module/constants/body-map.mjs";

/** Английская половина двуязычного имени. */
const en = (doc) => doc.name.split("/")[0].trim();

const BESTIARY = allPackDocuments("bestiary")
  .map(({ doc, file }) => ({ doc, file: String(file).replaceAll("\\", "/") }))
  .filter(({ doc }) => doc.system && Object.hasOwn(doc.system, "bodyType"));

const BY_NAME = new Map(BESTIARY.map(({ doc }) => [en(doc), doc.system.bodyType]));

/** Звери и ездовые существа — пол в книге не задан и ни на что не влияет. */
const BEASTS = [
  // Звери Укротителя (Друкхари)
  "Barghesi", "Clawed Fiend", "Hellspider", "Khymera", "Razorwing",
  // Скакуны
  "Drake", "Grox", "Horse", "Kriegsteed", "Marru", "Mukaali", "Pounder", "Raptor",
  "Serberys", "Ursir", "Warhorse"
];

/**
 * Нелюди без пола. Медуза — варп-паразит без хоста («Прислужник … варп-паразит из
 * свиты Архонтов — питается эмоциями», Книга Аэльдари: Ответвления, «Медузы
 * являются … паразитами»): имя женского рода, но это не женщина.
 */
const NONHUMAN = ["Medusae"];

/**
 * Явно женские. Кровавая Невеста — Книга Аэльдари: Ответвления, «Элитные
 * архетипы Друкхари» (стр. 53): «Требования: 2 Таланта Ведьмы, Женщина».
 */
const FEMALE = ["Bloodbride"];

/**
 * Гуманоиды, у которых ни книга, ни запись пол не называют. Остаются «Мужской» по
 * умолчанию схемы — ОТКРЫТЫЙ ВОПРОС (см. отчёт task-5fe7). Заполнили пол в книге —
 * переносите имя отсюда в FEMALE/NONHUMAN и правьте данные.
 *
 * Культист Ведьма здесь сознательно: «Ведьма» в Книге Хаоса (стр. 48) — псайкер
 * культа вообще («охотники на ведьм», «ведьмы … колдуны»), пол книга не называет;
 * женский род в слове «почитаемая» из записи согласован с существительным, а не с
 * полом. Если владелец решит «Женский» — перенести в FEMALE и поправить данные.
 */
const UNSPECIFIED_HUMANOIDS = [
  "Sybarite", "Trueborn", "Wrack", "Klaivex", "Mandrake",
  "Cultist Demagogue", "Cultist Devotee", "Cultist Militant", "Cultist Mutant", "Cultist Priest",
  "Cultist Rabble", "Cultist Scout", "Cultist Witch", "Cultist Zealot",
  "Master Servant", "Porter", "Slave", "Valet"
];

describe("Бестиарий: поле «Телосложение» (task-5fe7)", () => {
  it("найдено ровно 36 существ с полем — перечни выше покрывают всех", () => {
    const listed = [...BEASTS, ...NONHUMAN, ...FEMALE, ...UNSPECIFIED_HUMANOIDS].sort();
    expect([...BY_NAME.keys()].sort()).toEqual(listed);
    expect(BESTIARY.length).toBe(36);
  }, PACK_SCAN_TIMEOUT);

  it("значение у каждого — допустимый вариант списка «Телосложение»", () => {
    for (const [name, v] of BY_NAME) expect(Object.keys(BODY_TYPES), name).toContain(v);
  }, PACK_SCAN_TIMEOUT);

  it("звери и ездовые существа — «Другое»", () => {
    for (const name of BEASTS) expect(BY_NAME.get(name), name).toBe("other");
  }, PACK_SCAN_TIMEOUT);

  it("нелюди без пола — «Другое»", () => {
    for (const name of NONHUMAN) expect(BY_NAME.get(name), name).toBe("other");
  }, PACK_SCAN_TIMEOUT);

  it("явно женские — «Женский»", () => {
    for (const name of FEMALE) expect(BY_NAME.get(name), name).toBe("female");
  }, PACK_SCAN_TIMEOUT);

  it("гуманоиды без пола в книге — не тронуты (остаются «Мужской»)", () => {
    for (const name of UNSPECIFIED_HUMANOIDS) expect(BY_NAME.get(name), name).toBe("male");
  }, PACK_SCAN_TIMEOUT);
});
