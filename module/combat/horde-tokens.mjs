// module/combat/horde-tokens.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОРДА НА СЦЕНЕ — что о ней говорит расстановка токенов.
//
//  Два правила Орды читаются прямо с карты:
//   • «Прячась в Орде» — токен персонажа наложен на токен союзной Орды, и
//     не-Избирательная стрелковая атака по нему частью попаданий уходит в толпу;
//   • «Орда против Орды» — в рукопашной чужая Орда считается за столько
//     персонажей, сколько клеток базового контакта у двух строёв.
//
//  Здесь только перевод токенов Foundry в клетки сетки; сам счёт по клеткам —
//  rules/horde-geometry.mjs, и он проверяется тестом без запуска Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { rectsOverlap, contactCells, hordeVsHordeTargets } from "../rules/horde-geometry.mjs";
import { hitsAbsorbedByHorde } from "../rules/horde-damage.mjs";

/** Типы акторов, которые могут прятаться в союзной Орде. */
export const HIDEABLE_TYPES = ["character", "daemon", "demonPrince"];

/** Актор токена — у placeable и у документа он лежит по-разному. */
function actorOf(token) {
  return token?.actor ?? token?.document?.actor ?? null;
}

/**
 * Прямоугольник токена в клетках сетки.
 * Токен хранит координаты в пикселях, а ширину/высоту — уже в клетках.
 */
export function tokenRect(token) {
  const doc  = token?.document ?? token;
  const size = canvas?.grid?.size || canvas?.scene?.grid?.size || 100;
  if (!doc || !size) return null;
  return {
    x: Math.round((Number(doc.x) || 0) / size),
    y: Math.round((Number(doc.y) || 0) / size),
    w: Math.max(1, Math.round(Number(doc.width)  || 1)),
    h: Math.max(1, Math.round(Number(doc.height) || 1))
  };
}

/** Все токены Орд на текущей сцене, кроме указанного. */
function hordeTokens(exclude = null) {
  return (canvas?.tokens?.placeables ?? [])
    .filter(t => t !== exclude && actorOf(t)?.type === "horde");
}

/**
 * Дружественна ли Орда персонажу. Прятаться можно только в СВОЕЙ толпе —
 * вражеская орда живым щитом не станет.
 *
 * Считаем по расположению токенов (disposition): у Орды ГМа она обычно
 * враждебная, у наёмников — дружественная. Иного признака «свои» в системе нет.
 */
function friendly(tokenA, tokenB) {
  const a = tokenA?.document ?? tokenA;
  const b = tokenB?.document ?? tokenB;
  return (a?.disposition ?? 0) === (b?.disposition ?? 0);
}

/**
 * Орда, в которой стоит этот токен (первая подходящая).
 * @returns {Token|null}
 */
export function hordeSheltering(token) {
  const rect = tokenRect(token);
  if (!rect) return null;
  const type = actorOf(token)?.type;
  if (!HIDEABLE_TYPES.includes(type)) return null;

  return hordeTokens(token).find(h => {
    const hRect = tokenRect(h);
    return hRect && rectsOverlap(rect, hRect) && friendly(token, h);
  }) ?? null;
}

/**
 * Раскладка попаданий по правилу «Прячась в Орде».
 *
 * Возвращает null, если правило не применяется: рукопашная (шквал в упор мимо
 * толпы не пройдёт), Избирательная атака (стрелок выцеливает именно персонажа),
 * цель не в Орде.
 *
 * @returns {{horde:Actor, hordeToken:Token, mask:boolean[], count:number}|null}
 */
export function hidingInHordeSplit(targetToken, { hitsCount = 0, rv = 0, burst = false,
                                                  isMelee = false, selective = false } = {}) {
  if (isMelee || selective || hitsCount <= 0) return null;
  const hordeToken = hordeSheltering(targetToken);
  if (!hordeToken) return null;

  const mask = hitsAbsorbedByHorde({ hitsCount, rv, burst });
  const count = mask.filter(Boolean).length;
  if (count === 0) return null;
  return { horde: actorOf(hordeToken), hordeToken, mask, count };
}

/**
 * Орды, соприкасающиеся с этой Ордой, и за сколько персонажей каждая считается.
 *
 * @returns {Array<{token:Token, actor:Actor, name:string, targets:number, ownCells:number}>}
 */
export function hordeContacts(token) {
  const rect = tokenRect(token);
  if (!rect) return [];

  return hordeTokens(token).flatMap(other => {
    const otherRect = tokenRect(other);
    if (!otherRect) return [];
    const targets = hordeVsHordeTargets(rect, otherRect);
    if (targets <= 0) return [];
    return [{
      token: other,
      actor: actorOf(other),
      name: other.name ?? other.document?.name ?? "Орда",
      targets,
      ownCells: contactCells(rect, otherRect).a
    }];
  });
}

/**
 * Сколько целей у Орды в рукопашной с учётом расстановки.
 *
 * По умолчанию Орда бьёт до Магнитуда/5 персонажей в базовом контакте. Против
 * другой Орды чужой строй считается за столько персонажей, сколько у него
 * клеток контакта, — но своё ограничение по Магнитуде никуда не девается.
 *
 * @returns {{targets:number, note:string}}
 */
export function hordeMeleeTargets(token, { magnitudeTargets = 1 } = {}) {
  const contacts = hordeContacts(token);
  if (!contacts.length) return { targets: magnitudeTargets, note: "" };

  const fromHordes = contacts.reduce((sum, c) => sum + c.targets, 0);
  const targets = Math.min(magnitudeTargets, fromHordes);
  const names = contacts.map(c => `${c.name} — ${c.targets}`).join(", ");
  return {
    targets,
    note: `Орда против Орды: клеток контакта даёт целей ${fromHordes} (${names}); по Магнитуде — ${magnitudeTargets}`
  };
}
