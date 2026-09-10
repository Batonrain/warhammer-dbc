// module/rules/the-hunter.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дар «The Hunter / Загонщик» (wdbc-1rno, Кхорн, стр. 453-460, d100 81…84):
//  «Если в пределах видимости чемпиона есть псайкер, он может за полное
//  действие потратить Очко Бесчестия и призвать Гончую Плоти в Истинной
//  Форме. Гончая действует в его инициативу и нападает на ближайшего
//  псайкера. Убив свою добычу, гончая возвращается в Варп.»
//
//  Разбор пробела (правило пользователя — сперва описание+варианты, потом
//  реализация) состоялся 09.09.2026, выбор пользователя по обеим развилкам:
//   • «Нападает на ближайшего псайкера» — в системе нет автоатак ни для
//     одного существа (весь боевой конвейер требует ручного клика), поэтому
//     здесь только ПОДСКАЗКА (кто ближайший видимый псайкер) в карточке
//     призыва — атаку всё равно проводит игрок/ГМ вручную обычной атакой.
//   • «Убив добычу, возвращается в Варп» — привязано к уже готовой кнопке
//     «Констатировать смерть» (module/combat/crit-effect-parser.mjs,
//     module/hooks.mjs): если смерть подтверждена от атаки ИМЕННО этой
//     Гончей, кнопка «Гончая возвращается в Варп» появляется в той же
//     карточке сама, а не заводится отдельной ручной процедурой.
//
//  «Видимость»/«ближайший» — то же геометрическое приближение (дальность +
//  сектор обзора, БЕЗ стен), что уже даёт module/rules/vision-target.mjs для
//  Иконы Богохульства; дистанция — переиспользует module/regions/auras.mjs::
//  tokenDocDistance (второй копии формулы замера в проекте быть не должно).
// ════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";
import { isTokenInSight } from "./vision-target.mjs";
import { itemIs } from "./item-marker.mjs";

const NAME = "The Hunter";
export const HOUND_NAME = "Гончая Плоти";
// На Акторе Гончей — {championUuid, itemId}: кто именно её призвал (Дар и
// его владелец), нужно только для точечной проверки «эта Гончая — ЧЬЯ»
// (кнопка возврата в Варп после подтверждения смерти жертвы).
export const HUNTER_HOUND_FLAG = "hunterHoundOf";

/** Это предмет-Дар «The Hunter / Загонщик»? */
export function isTheHunterItem(item) {
  return itemIs(item, "mutation", "gift.khorne.theHunter", NAME);
}

/**
 * Псайкеры сцены, видимые чемпиону — ближайший первым (стр. 453-460:
 * «нападает на ближайшего псайкера»). Скрытые (hidden) токены и сам
 * чемпион исключены; «псайкер» — system.isPsyker (тот же признак, что
 * module/combat/attack.mjs читает для forcePR-бонуса).
 * @param {object} championToken TokenDocument-подобный (x,y,width,height,
 *   rotation,sight,elevation,parent=сцена)
 * @returns {{token:object, distance:number}[]}
 */
export function visiblePsykersFrom(championToken) {
  const scene = championToken?.parent;
  if (!scene) return [];
  const grid = scene.grid;
  return scene.tokens.contents
    .filter(t => t.id !== championToken.id && !t.hidden && !!t.actor?.system?.isPsyker)
    .filter(t => isTokenInSight(championToken, t, grid))
    .map(t => ({ token: t, distance: tokenDocDistance(championToken, t, grid) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Ближайший видимый псайкер, или null — гейт «можно ли вообще призвать». */
export function nearestVisiblePsyker(championToken) {
  return visiblePsykersFrom(championToken)[0] ?? null;
}

/** {championUuid, itemId} записи призыва на Акторе Гончей, или null. */
export function hunterHoundInfo(houndActor) {
  return houndActor?.getFlag?.("warhammer-dbc", HUNTER_HOUND_FLAG) || null;
}

/** Этот Актор — Гончая, призванная ИМЕННО «Загонщиком» (любого чемпиона)? */
export function isHunterHoundActor(actor) {
  return !!hunterHoundInfo(actor);
}
