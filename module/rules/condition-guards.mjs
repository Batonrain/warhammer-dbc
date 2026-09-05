// module/rules/condition-guards.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИММУНИТЕТ и СМЯГЧЕНИЕ Состояний, заданные автором контента в Конструкторе
//  «МЕХАНИКА» (kind:"condition", режимы "immunity" и "mitigate", wdbc-tl0f).
//
//  До этого иммунитет в системе был ровно один и не к Состоянию, а к СВОЙСТВУ
//  ОРУЖИЯ (weaponPropertyImmunity.*, constants/capabilities.mjs) — и в самом
//  файле оговорено, что «другие пути наложить то же состояние этим иммунитетом
//  не гасятся». Здесь иммунитет привязан к самому Состоянию, поэтому гасит
//  ЛЮБОЙ путь наложения: единая точка (sheets/tabs/conditions.mjs —
//  conditionApplyFields/conditionAdjustFields) спрашивает эти функции перед
//  тем, как собрать патч.
//
//  ЖИВОЙ ЗАПРОС, как «Ландшафт» (combat/movement-terrain.mjs) и «Усталость»
//  (rules/fatigue-grace.mjs): запись ничего не пишет при получении предмета —
//  читается в момент наложения Состояния. Уйдёт предмет — иммунитет исчезнет
//  сам, откатывать нечего.
//
//  Живёт в module/rules/, а не в apps/mechanics.mjs, ровно по той же причине,
//  что fatigue-grace.mjs: потребитель — sheets/tabs/conditions.mjs и combat/*,
//  и тянуть ради двух функций весь Конструктор с его диалогами и Обозревателем
//  незачем. Чистые функции, без обращений к Foundry — проверяются без заглушки.
//
//  Смягчение (mitigate) само по себе ничего не считает: оно вытесняет книжное
//  правило Состояния из реестра (rules/library/conditions.mjs) и, в режиме
//  «половина», подставляет вместо него ополовиненную копию — это делает
//  rules/item-rules.mjs, а здесь только чтение «что автор написал».
// ════════════════════════════════════════════════════════════════════════════

import { entryWhenOk } from "./mech-when.mjs";
import { flattenMechEntries } from "./fatigue-grace.mjs";

const FLAG_SCOPE = "warhammer-dbc";

/** Режимы записи «Состояние». apply/remove разовые, immunity/mitigate — живые. */
export const CONDITION_MODES = ["apply", "remove", "immunity", "mitigate"];

/** Виды смягчения: снять штраф целиком или ополовинить. */
export const CONDITION_MITIGATIONS = ["ignore", "half"];

/** Механика предмета: и документ Foundry, и литерал теста. */
function mechanicsOf(item) {
  const viaFlag = item?.getFlag?.(FLAG_SCOPE, "mechanics");
  return viaFlag ?? item?.flags?.[FLAG_SCOPE]?.mechanics ?? [];
}

/** Заполнена ли запись «Состояние» настолько, чтобы что-то значить. */
export function isConditionEntry(entry) {
  return entry?.kind === "condition"
    && !!String(entry.condKey || "").trim()
    && CONDITION_MODES.includes(entry.condMode || "apply");
}

/**
 * Все записи «Состояние» актора в заданном режиме — с уже пройденным гейтом
 * «Когда» и (если передан isActive) с проверкой, включён ли источник.
 *
 * @param {object}   actor
 * @param {string}   mode      один из CONDITION_MODES
 * @param {Function} [isActive] (item) => boolean; по умолчанию «все активны»
 * @returns {Array<{entry: object, item: object}>}
 */
export function conditionEntriesOf(actor, mode, isActive = () => true) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (!isActive(item)) continue;
    for (const entry of flattenMechEntries(mechanicsOf(item))) {
      if (!isConditionEntry(entry)) continue;
      if ((entry.condMode || "apply") !== mode) continue;
      if (!entryWhenOk(actor, entry, item)) continue;
      out.push({ entry, item });
    }
  }
  return out;
}

/** Ключи Состояний, к которым актор невосприимчив. */
export function conditionImmunities(actor, isActive = () => true) {
  return new Set(conditionEntriesOf(actor, "immunity", isActive)
    .map(({ entry }) => String(entry.condKey).trim()));
}

/** Невосприимчив ли актор к этому Состоянию (гасит ЛЮБОЙ путь наложения). */
export function isImmuneToCondition(actor, key, isActive = () => true) {
  if (!actor || !key) return false;
  return conditionImmunities(actor, isActive).has(key);
}

/**
 * Как смягчён штраф этого Состояния у актора: "" (никак), "half" (половина)
 * или "ignore" (штрафа нет вовсе). Полное снятие сильнее половины — два
 * предмета, один из которых снимает штраф целиком, дают снятие, а не спор.
 */
export function conditionMitigation(actor, key, isActive = () => true) {
  if (!actor || !key) return "";
  let best = "";
  for (const { entry } of conditionEntriesOf(actor, "mitigate", isActive)) {
    if (String(entry.condKey).trim() !== key) continue;
    const mode = entry.condMitigate === "half" ? "half" : "ignore";
    if (mode === "ignore") return "ignore";
    best = "half";
  }
  return best;
}
