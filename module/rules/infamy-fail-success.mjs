// module/rules/infamy-fail-success.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Провалил тест — потратил Очко Бесчестия — вместо этого преуспел на 1
//  Успех». Одна и та же форма у нескольких Черт Архетипов главы I, разница
//  только в том, КАКИЕ тесты она покрывает:
//    • Serpent's Tongue / Змеиный Язык (Отступник) — тест социального
//      взаимодействия, командования или допроса.
//  (Survivor/Выживальщик Дикаря и Legion Surgery Астартес — той же формы;
//  их строка добавляется сюда же, без нового механизма.)
//
//  Здесь только отбор: по контексту уже брошенного теста и набору
//  возможностей актора — какие Черты предлагают такую трату. Кнопка в
//  карточке теста — sheets/actor-sheet.mjs::_runTest, сама трата —
//  apps/infamy-fail-success.mjs. Foundry не нужен: тестируется на литералах.
// ════════════════════════════════════════════════════════════════════════

import { isSocialSkill } from "./resolve-test.mjs";

/**
 * Реестр источников. `capability` — имя возможности, которую выдаёт запись
 * Конструктора на самой Черте (kind:"capability"), `applies(ctx)` — покрывает
 * ли Черта этот тест.
 */
export const INFAMY_FAIL_SUCCESS_SOURCES = [
  {
    capability: "trait.serpentSTongue",
    label: "Змеиный Язык",
    // [книга] «тест социального взаимодействия, командования или допроса».
    // Командование (Command) и Допрос (Interrogate) в таблице навыков сами
    // помечены социальными (constants/skills.mjs, apt2:"social") — отдельно их
    // перечислять незачем. [допущение] Голый тест Общительности (без навыка)
    // — тоже социальное взаимодействие: книга не называет навык, а «убедить
    // словом» за столом часто бросается чистой F.
    applies: ctx => isSocialSkill(ctx?.skill) || (!ctx?.skill && ctx?.char === "fel")
  }
];

/**
 * Какие источники предлагают заменить ЭТОТ провал успехом.
 *
 * @param {(flag:string) => boolean} hasFlag есть ли у актора возможность
 * @param {{skill?:string, char?:string, success?:boolean}} ctx исход теста
 * @returns {{capability:string, label:string}[]} пусто — кнопки нет
 */
export function infamyFailSuccessOptions(hasFlag, ctx = {}) {
  if (ctx?.success) return [];
  return INFAMY_FAIL_SUCCESS_SOURCES
    .filter(s => s.applies(ctx) && hasFlag(s.capability))
    .map(({ capability, label }) => ({ capability, label }));
}

/** Источник по имени возможности (для обработчика кнопки). */
export function infamyFailSuccessSource(capability) {
  return INFAMY_FAIL_SUCCESS_SOURCES.find(s => s.capability === capability) ?? null;
}

/**
 * Надбавки к трате Очка Бесчестия на «Усиление» (+10 до броска, корбук 438).
 * [книга] Змеиный Язык: «При трате дополнительных Очков Бесчестия даёт +1
 * Успех к Усилению на социальные взаимодействия». Усиление тратится кнопкой
 * полосы Бесчестия ДО броска и с конкретным тестом не связано — поэтому
 * система не прибавляет Успех сама, а пишет напоминание в карточку траты.
 */
export const INFAMY_BOOST_NOTES = [
  {
    capability: "trait.serpentSTongue",
    note: "Змеиный Язык: если это тест социального взаимодействия — при успехе ещё +1 Успех."
  }
];

/** Строки-напоминания для карточки «Усиления» (пусто — надбавок нет). */
export function infamyBoostNotes(hasFlag) {
  return INFAMY_BOOST_NOTES.filter(n => hasFlag(n.capability)).map(n => n.note);
}
