// module/rules/inspire-wrath.mjs
// ════════════════════════════════════════════════════════════════════════
//  Inspire Wrath / Вдохновить Гнев (Талант Слаанеш, стр. 90-91 core.json;
//  Sahara inspire-wrath-cannon-fodder, решение владельца 24.10.2026).
//
//  Книга: «За Полное Действие он может пройти тест на Charm+0, чтобы дать
//  своей аудитории Талант Hatred против определённой группы. Этот Талант
//  воздействует на до F.b×10 персонажей (F.b×100 с Талантом Demagogue).
//  Наполненная ненавистью толпа не всегда поддаётся контролю после того, как
//  её гнев пробудили…»
//
//  Текст в книге ОБРЫВАЕТСЯ: ни срока, ни порядка «выдачи» там нет. Принято
//  минимальное разумное чтение, записано здесь и в задаче:
//   • срок — до конца сцены (кнопка «🎬 Новая сцена» календаря, game-session.mjs);
//   • Hatred выдаётся ОТДЕЛЬНЫМ временным предметом «Hatred / Ненависть»: своя
//     Ненависть слушателя не трогается и не подменяется, цели складываются
//     (rules/predicates.mjs::hatredTargetsOf собирает цели всех Hatred актора);
//   • «не всегда поддаётся контролю» — совет столу, не правило: система ничего
//     не сдерживает и не бросает.
//
//  Чистый модуль: ни одного обращения к Foundry. Бросок и выдача —
//  combat/inspire-wrath.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";
import { itemHasName } from "./predicates.mjs";

/** Ключ Возможности (constants/capabilities.mjs). */
export const INSPIRE_WRATH_KEY = "social.core.inspireWrath";
/** Метка на выданной слушателю Ненависти: { sourceUuid, sourceName }. */
export const INSPIRED_WRATH_FLAG = "inspiredWrath";
/** Id шаблона Hatred в компендиуме талантов (packs-src/talents/Берсерк). */
export const HATRED_PACK_ID = "x4C4FheBkX5nS2Wt";
/** Множитель аудитории: F.b×10, с Demagogue — F.b×100. */
export const AUDIENCE_PER_BONUS = 10;
export const AUDIENCE_PER_BONUS_DEMAGOGUE = 100;

/** Предмет — Талант «Inspire Wrath»? (предметы у игроков — снимки, поэтому и по имени) */
export const isInspireWrathItem = item => itemIs(item, "talent", INSPIRE_WRATH_KEY, "Inspire Wrath");

/** Есть ли у актора Inspire Wrath (по ключу или по имени). */
export function hasInspireWrath(actor) {
  return [...(actor?.items ?? [])].some(isInspireWrathItem);
}

/** Есть ли у актора Талант Demagogue. */
export function hasDemagogue(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Demagogue"));
}

/** Сколько персонажей охватывает Талант: F.b × 10 (× 100 с Demagogue). */
export function inspireWrathAudience(actor) {
  const fb = Math.max(0, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
  return fb * (hasDemagogue(actor) ? AUDIENCE_PER_BONUS_DEMAGOGUE : AUDIENCE_PER_BONUS);
}

/** Выданная этим Талантом временная Ненависть? (предмет или сырые данные) */
export function isInspiredHatred(item) {
  if (item?.type !== "talent") return false;
  const viaFlag = item.getFlag?.("warhammer-dbc", INSPIRED_WRATH_FLAG);
  return !!(viaFlag ?? item.flags?.["warhammer-dbc"]?.[INSPIRED_WRATH_FLAG]);
}

/**
 * Данные временной Ненависти для слушателя. Шаблон (запись пака) даёт
 * описание и значок; без него — минимальный Талант. Цель одна, та же, что
 * назвал оратор; метка источника позволяет снять предмет в конце сцены.
 *
 * @param {object} target     цель Ненависти (rules/talent-targets.mjs)
 * @param {{uuid:string, name:string}} source  оратор
 * @param {?object} template  toObject() Hatred из компендиума
 */
export function inspiredHatredData(target, source, template = null) {
  const base = template ? foundryClone(template) : {
    name: "Hatred / Ненависть", type: "talent",
    img: "systems/warhammer-dbc/assets/item-icons/talent.svg", system: {}, flags: {}
  };
  delete base._id;
  delete base._stats;
  delete base.ownership;
  delete base.folder;
  base.type = "talent";
  base.name = `Hatred / Ненависть (${target?.name || target?.ref || target?.value || "толпа"})`;
  base.system = {
    ...(base.system ?? {}),
    targets: [target],
    specialization: target?.name || "",
    purchased: false,
    granted: false,
    cost: 0
  };
  base.flags = {
    ...(base.flags ?? {}),
    "warhammer-dbc": {
      ...(base.flags?.["warhammer-dbc"] ?? {}),
      [INSPIRED_WRATH_FLAG]: { sourceUuid: source?.uuid ?? "", sourceName: source?.name ?? "" }
    }
  };
  return base;
}

function foundryClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Исход Charm+0: успех выдаёт Ненависть, провал — нет. */
export function inspireWrathOutcome({ success }) {
  return success ? "granted" : "failed";
}
