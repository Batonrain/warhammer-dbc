// module/rules/crimson-angel.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дар «Crimson Angel / Багровый Ангел» (Кхорн, wdbc-1rno, d100 48…51):
//  «Когда в пределах видимости персонажа есть цель, к которой он имеет
//  талант Hatred, он может получить Трейт Flyer (A.b×2). Персонаж теряет
//  этот Трейт, если в свой Ход он не двигался к Ненавистному врагу и не
//  совершал по нему рукопашные атаки.»
//
//  Первый реальный потребитель rules/hatred.mjs::hatredTargetsOf вне самого
//  Таланта Ненависти — то же геометрическое приближение видимости
//  (дальность+сектор, без стен), что уже даёт rules/the-hunter.mjs для
//  «ближайший видимый псайкер» (Загонщик), только цель отбора другая.
//
//  Разбор пробела (12.09.2026, решение пользователя — делать ровно так):
//  выдача Трейта автоматизируема полностью (кнопка на предмете, module/apps/
//  item-script.mjs); СНЯТИЕ — нет. «Двигался К Ненавистному врагу» и «атаковал
//  ИМЕННО его» не читаются нигде: turn-flags.mjs::movedThisTurn — голый
//  булев («двигался хоть куда-то»), attackedThisTurn хранит только ID
//  оружия, не цель атаки. Кнопка снятия — рядом с кнопкой выдачи, решение
//  соблюдения условия остаётся на игроке/ГМ (та же стена, что уже нашёл
//  «Кровопомазанник», wdbc-egll).
// ════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";
import { isTokenInSight } from "./vision-target.mjs";
import { hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";

/**
 * Токены сцены, видимые чемпиону и подходящие хоть под одну цель хоть
 * одного его Таланта Ненависти — ближайший первым. Скрытые токены и сам
 * чемпион исключены.
 * @param {object} championToken TokenDocument-подобный (x,y,width,height,
 *   rotation,sight,elevation,parent=сцена)
 * @param {object} casterActor владелец Дара (чьи Таланты Ненависти сверяем)
 * @returns {{token:object, distance:number}[]}
 */
export function visibleHatredTargetsFrom(championToken, casterActor) {
  const scene = championToken?.parent;
  if (!scene) return [];
  const targets = hatredTargetsOf(casterActor);
  if (!targets.length) return [];
  const grid = scene.grid;
  return scene.tokens.contents
    .filter(t => t.id !== championToken.id && !t.hidden && !!t.actor)
    .filter(t => isTokenInSight(championToken, t, grid))
    .filter(t => anyTargetMatches(targets, { targetActor: t.actor }))
    .map(t => ({ token: t, distance: tokenDocDistance(championToken, t, grid) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Ближайшая видимая Ненавистная цель, или null — гейт «можно ли выдать Flyer». */
export function nearestVisibleHatredTarget(championToken, casterActor) {
  return visibleHatredTargetsFrom(championToken, casterActor)[0] ?? null;
}
