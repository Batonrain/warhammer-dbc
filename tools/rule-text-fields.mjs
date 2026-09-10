// tools/rule-text-fields.mjs
// ════════════════════════════════════════════════════════════════════════
//  ПОЛЯ, ГДЕ ЖИВЁТ ТЕКСТ ПРАВИЛА — по типу документа (wdbc-dj0r).
//
//  Замер «карточка не несёт ни строки правил» (tools/card-description-from-
//  book.mjs, tools/faction-description-from-legions.mjs) раньше держал один
//  ПЛОСКИЙ список полей на ВСЕ типы документов и дважды завысил долг: у
//  оружия правило часто живёт в system.weaponProps (список свойств —
//  Blast/Tearing/Concussive и т.п.), у болезней — в incubation/symptoms/
//  vectors/cure, и ни того ни другого в списке не было.
//
//  Полной автоматизации «брать список из схемы module/data/» не вышло —
//  проверено (wdbc-dj0r): и прозаические поля (benefit/effect/incubation),
//  и короткие служебные (weaponClass/quality/damageType) объявлены ОДНИМ И
//  ТЕМ ЖЕ типом поля схемы (StringField) — схема сама их не различает, а
//  заводить новый признак поля разом в ~30 файлах module/data/ — отдельная,
//  более крупная работа. Здесь — карта «тип → доп. поля» вместо одного
//  плоского списка: точнее прежнего, но по-прежнему держится руками —
//  честно, не выдаётся за автоматизацию.
// ════════════════════════════════════════════════════════════════════════

/** Поля, где текст правила может жить у ЛЮБОГО типа документа. */
export const COMMON_TEXT_FIELDS =
  ["description", "benefit", "effect", "notes", "special", "reminder", "afterEffect"];

/**
 * Доп. поля сверх общих — только там, где правило живёт НЕ текстом
 * (список/структура), поэтому общий список его не видит вовсе.
 */
export const TEXT_FIELDS_BY_TYPE = {
  // Blast/Tearing/Concussive и т.п. — сама карточка их уже показывает
  // (module/sheets/sheet-helpers.mjs), общий текстовый список этого не знал.
  weapon: ["weaponProps"],
  // Обычные болезни несут правило четырьмя отдельными полями, не одним
  // текстовым — «Эффект»/«Описание» у них пустует по замыслу схемы.
  disease: ["incubation", "symptoms", "vectors", "cure"]
};

/** Все поля-кандидаты для этого типа документа: общие + свои. */
export function textFieldsFor(type) {
  return [...COMMON_TEXT_FIELDS, ...(TEXT_FIELDS_BY_TYPE[type] || [])];
}

/**
 * Несёт ли этот документ пака хоть одну непустую строку правила. Принимает
 * сырой JSON пака ({type, system}) — не документ Foundry.
 */
export function hasRuleText(doc) {
  const system = doc?.system;
  if (!system) return false;
  return textFieldsFor(doc.type).some(key => {
    const value = system[key];
    if (Array.isArray(value)) return value.length > 0;
    return String(value ?? "").replace(/<[^>]+>/g, "").trim() !== "";
  });
}
