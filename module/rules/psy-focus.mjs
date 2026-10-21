// module/rules/psy-focus.mjs
// ════════════════════════════════════════════════════════════════════════
//  Фокус Дисциплины (wdbc-l6zg, core.json стр.293): «Фокус Дисциплины
//  выбирается, как правило, при создании персонажа... Псайкер может изучать
//  психосилы дисциплины своего фокуса без всякого изучения». В системе пока
//  нет механизма «изучения» психосил вообще (drag-and-drop без гейта, см.
//  wdbc-1rno) — упрощать пока нечего, поэтому Фокус здесь ЧИСТО ДАННЫЕ:
//  выбор игрока (actor.system.psyker.focusDisciplines) плюс дисциплины,
//  дарованные способностями вроде Perfect Sorcerer, — видимые на вкладке
//  МИСТИКА (sheets/sheet-helpers.mjs → templates/actor/parts/tab-psy.hbs).
//  Когда появится механика изучения психосил, она читает отсюда же.
// ════════════════════════════════════════════════════════════════════════

import { perfectSorcererFocusDisciplines } from "./perfect-sorcerer.mjs";

/** Фокусы, дарованные актору способностями (в обход обычного выбора игрока). */
export function grantedFocusDisciplines(actor) {
  return perfectSorcererFocusDisciplines(actor);
}

/** Игроком выбранные Фокусы — сырое поле актора, без дарованных способностями. */
export function ownFocusDisciplines(actor) {
  const list = actor?.system?.psyker?.focusDisciplines;
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

/** Итоговый набор ключей дисциплин с Фокусом — выбор игрока ∪ дарованное способностями. */
export function effectiveFocusDisciplines(actor) {
  return Array.from(new Set([...ownFocusDisciplines(actor), ...grantedFocusDisciplines(actor)]));
}

/** Есть ли у актора Фокус дисциплины `key` (свой или дарованный). */
export function hasFocusDiscipline(actor, key) {
  return !!key && effectiveFocusDisciplines(actor).includes(key);
}

// ════════════════════════════════════════════════════════════════════════
//  Качество предмета-Психофокуса (Psy Focus / Психофокус, core.json стр.243)
//  — это НЕ «Фокус Дисциплины» выше, а вещь в руке/на теле, ради которой
//  Путь Силы «Психофокус» вообще работает.
//
//    Good.Q: «Резонирует с одной из Дисциплин и увеличивает бонус от
//            психофокуса на +5 для психосил этой дисциплины».
//    Best.Q: «Так же, как Good.Q, но также игнорирует штрафы от Крит. Провала
//            на психофокус».
//    Poor.Q: «работает только в руках псайкера» — механики нет, это и так
//            условие Пути («психофокус в руке/контакте с кожей»).
//
//  Какой предмет сейчас в деле, система сама не угадывает: игрок привязывает
//  его на вкладке МИСТИКА (actor.system.psyker.focusItemId), а Дисциплину
//  резонанса выбирает там же (…focusResonance) — на предмете такого поля нет,
//  а у Свинцовой Клети резонанс — «родная дисциплина псайкера», то есть тоже
//  выбор игрока.
//
//  «+5» прибавляется к УЖЕ полученному бонусу (+10 успех, +15 крит. успех):
//  на провале бонуса нет — увеличивать нечего (решение владельца).
// ════════════════════════════════════════════════════════════════════════

/** По чему опознаётся предмет, годный в Психофокусы (имя, описание, эффект). */
const FOCUS_ITEM_RE = /psy\s*focus|психофокус|lead\s*cage|свинцов\S*\s+клет/i;
const FOCUS_ITEM_TYPES = ["gear", "weapon"];

function stripTags(s) {
  return String(s ?? "").replace(/<[^>]*>/g, " ");
}

/** Выглядит ли предмет как Психофокус (по тексту; окончательно решает игрок выбором). */
export function isPsyFocusItem(item) {
  if (!item || !FOCUS_ITEM_TYPES.includes(item.type)) return false;
  const s = item.system ?? {};
  return FOCUS_ITEM_RE.test(`${item.name ?? ""} ${stripTags(s.description)} ${stripTags(s.effect)}`);
}

/** Привязанный игроком предмет-Психофокус или null (в т.ч. если предмет удалён). */
export function activeFocusItem(actor) {
  const id = actor?.system?.psyker?.focusItemId;
  return (id && actor?.items?.get?.(id)) || null;
}

/** Предметы для выпадающего списка привязки: опознанные по тексту + уже выбранный. */
export function psyFocusCandidates(actor) {
  const chosen = activeFocusItem(actor);
  const list = Array.from(actor?.items ?? []).filter(i => isPsyFocusItem(i) || i === chosen);
  return list;
}

/**
 * Что даёт привязанный предмет психотесту силы `power`.
 * @returns {{item: object|null, quality: string, resonates: boolean,
 *            bonus: number, ignoresCritFail: boolean}}
 */
export function focusQualityEffect(actor, power) {
  const item = activeFocusItem(actor);
  const quality = item?.system?.quality ?? "";
  const aboveCommon = quality === "good" || quality === "best";
  const resonance = actor?.system?.psyker?.focusResonance || "";
  const discipline = power?.system?.discipline || "";
  const resonates = aboveCommon && !!resonance && resonance === discipline;
  return {
    item, quality, resonates,
    bonus: resonates ? 5 : 0,
    ignoresCritFail: quality === "best"
  };
}

/**
 * Итог броска Психофокуса (W+0): модификатор к психотесту.
 * Без предмета (`effect.bonus` и `ignoresCritFail` нулевые) — прежние
 * +10 / +15 / 0 / −10.
 * @param {{pass: boolean, double: boolean}} roll
 * @param {{bonus: number, ignoresCritFail: boolean}} effect
 */
export function focusRollResult({ pass, double }, effect) {
  let base = 0;
  if (pass && double) base = 15;
  else if (pass)      base = 10;
  else if (double)    base = -10;
  const critFailIgnored = !pass && double && !!effect?.ignoresCritFail;
  if (critFailIgnored) base = 0;
  const itemBonus = pass ? (effect?.bonus || 0) : 0;
  return { mod: base + itemBonus, itemBonus, critFailIgnored };
}
